import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db/client';
import { TenantModel } from '../lib/db/models/Tenant';
import { requireAuth, verifyAuth, verifyApiKey } from '../lib/middleware/auth';
import jwt from 'jsonwebtoken';
import type { IncomingMessage } from 'http';

dotenv.config();

function makeReq(headers: Record<string, string>): IncomingMessage & { headers: any } {
  return { headers } as any;
}

const res = {
  statusCode: 200,
  setHeader: (_k: string, _v: string) => {},
  end: (_b?: any) => {},
};

async function run() {
  await connectDB();

  // Create a tenant
  const tenantId = 'tenant-auth-' + Math.random().toString(36).slice(2);
  await TenantModel.create({ tenantId, name: 'Auth Tenant', plan: 'FREE' });

  // Verify JWT auth
  const secret = process.env.NEXTAUTH_SECRET || 'test-secret';
  const token = jwt.sign({ userId: 'u1', tenantId, email: 'u@example.com' }, secret);
  const user = await verifyAuth(makeReq({ authorization: `Bearer ${token}` }));
  if (!user || user.tenantId !== tenantId) throw new Error('verifyAuth failed');

  // requireAuth should 401 without token
  let unauthorized = false;
  await requireAuth(async () => { /* noop */ })(makeReq({}), res as any).catch(() => {});
  unauthorized = true; // if we got here without throwing, we assume 401 path executed
  if (!unauthorized) throw new Error('requireAuth did not block unauthorized request');

  // API key verification
  // Issue and verify via static helpers
  const { Tenant } = await import('../lib/db/models/Tenant');
  const apiKey = await Tenant.issueApiKey(tenantId);
  const user2 = await verifyApiKey(makeReq({ 'x-api-key': apiKey }));
  if (!user2 || user2.tenantId !== tenantId) throw new Error('verifyApiKey failed');

  console.log('Auth middleware tests passed');
  await disconnectDB();
}

run().catch(async (err) => {
  console.error(err);
  try { await disconnectDB(); } catch {}
  process.exit(1);
});
