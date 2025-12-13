import { connectDB, disconnectDB } from './client';
import { CampaignModel } from './models/campaign';
import { OptimizationLogModel } from './models/optimization-log';
import { TenantModel } from './models/Tenant';
import { MetaConnectionModel } from './models/MetaConnection';
import { WebsiteAuditModel } from './models/WebsiteAudit';
import { GeneratedCopyModel } from './models/GeneratedCopy';
import { AdSetModel } from './models/ad-set';
import { AdModel } from './models/ad';
import { PerformanceSnapshotModel } from './models/performance-snapshot';
import { BoostDraftModel } from './models/BoostDraft';

const models = [
  CampaignModel,
  OptimizationLogModel,
  TenantModel,
  MetaConnectionModel,
  WebsiteAuditModel,
  GeneratedCopyModel,
  AdSetModel,
  AdModel,
  PerformanceSnapshotModel,
  BoostDraftModel,
];

export async function initializeDatabase(): Promise<void> {
  await connectDB();

  // Drop existing indexes to avoid duplicate/auto-named conflicts, then sync declared indexes.
  for (const m of models) {
    try {
      await m.collection.dropIndexes();
    } catch (err: any) {
      // Ignore if no indexes exist yet
      if (err?.codeName !== 'NamespaceNotFound' && err?.code !== 26) {
        console.warn(`Index drop warning for ${m.modelName}:`, err?.message || err);
      }
    }
    await m.syncIndexes();
  }

  console.log('✅ Database initialized with all required models and indexes');
}

// Re-export connection functions
export { connectDB, disconnectDB };
