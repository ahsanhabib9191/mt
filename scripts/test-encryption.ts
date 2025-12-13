import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db/client';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { TenantModel } from '../lib/db/models/Tenant';
import { decrypt } from '../lib/utils/crypto';

dotenv.config();

async function run() {
  await connectDB();

  // Setup: create a tenant
  const tenantId = 'tenant-test-' + Math.random().toString(36).slice(2);
  const tenant = await TenantModel.create({ tenantId, name: 'Test Tenant', plan: 'FREE' });

  // Test MetaConnection encryption
  const plainAccess = 'access-token-plain-' + Math.random().toString(36).slice(2);
  const plainRefresh = 'refresh-token-plain-' + Math.random().toString(36).slice(2);
  const mc = await MetaConnectionModel.create({ tenantId, adAccountId: 'act_123', accessToken: plainAccess, refreshToken: plainRefresh, status: 'ACTIVE' });

  // Reload raw to inspect storage
  const stored = await MetaConnectionModel.findById(mc._id).lean();
  if (!stored) throw new Error('Stored MetaConnection not found');

  // Ensure ciphertext differs from plaintext
  if (stored.accessToken === plainAccess) throw new Error('accessToken was not encrypted at rest');
  if (stored.refreshToken === plainRefresh) throw new Error('refreshToken was not encrypted at rest');

  // Use instance helpers to get decrypted values
  const mcLoaded = await MetaConnectionModel.findById(mc._id);
  if (!mcLoaded) throw new Error('MetaConnection doc missing');
  const decA = decrypt(mcLoaded.accessToken as any);
  const decR = mcLoaded.refreshToken ? decrypt(mcLoaded.refreshToken as any) : undefined;
  if (decA !== plainAccess) throw new Error('Decrypted accessToken mismatch');
  if (decR !== plainRefresh) throw new Error('Decrypted refreshToken mismatch');

  // Test updating tokens also encrypts
  const newAccess = 'new-access-token-' + Math.random().toString(36).slice(2);
  // Use class helper to ensure encryption on update
  const updated = await (await import('../lib/db/models/MetaConnection')).MetaConnection.updateTokens(tenantId, 'act_123', { accessToken: newAccess });
  const afterUpdate = await MetaConnectionModel.findById(mc._id).lean();
  if (!afterUpdate) throw new Error('After-update doc missing');
  if (afterUpdate.accessToken === newAccess) throw new Error('Updated accessToken was not encrypted');

  // Tenant API key issue/verify
  const apiKey = await Tenant.issueApiKey(tenantId);
  const ok = await Tenant.verifyApiKey(tenantId, apiKey);
  if (!ok) throw new Error('API key verification failed');

  // Increment counters
  await Tenant.incrementRequestCounts(tenantId, 2, 3);
  const t2 = await TenantModel.findOne({ tenantId }).lean();
  if (!t2?.requestCounts || t2.requestCounts.daily < 2 || t2.requestCounts.monthly < 3) {
    throw new Error('Request counters did not increment as expected');
  }

  console.log('Encryption and Tenant API key tests passed');
  await disconnectDB();
}

// Minimal static Tenant wrapper import workaround
import { Tenant } from '../lib/db/models/Tenant';

run().catch(async (err) => {
  console.error(err);
  try { await disconnectDB(); } catch {}
  process.exit(1);
});
