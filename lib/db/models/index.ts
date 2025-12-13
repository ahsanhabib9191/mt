export { CampaignModel } from './campaign';
export type { ICampaign, CampaignStatus, CampaignObjective } from './campaign';

export { AdSetModel } from './ad-set';
export type { IAdSet, AdSetStatus, LearningPhaseStatus, ITargeting } from './ad-set';

export { AdModel } from './ad';
export type { IAd, AdStatus, AdEffectiveStatus, IAdCreative, IAdIssue } from './ad';

export { OptimizationLogModel } from './optimization-log';
export type { IOptimizationLog, OptimizationEntity } from './optimization-log';

export { PerformanceSnapshotModel } from './performance-snapshot';
export type { IPerformanceSnapshot, EntityType } from './performance-snapshot';

export { TenantModel, Tenant } from './Tenant';
export type { ITenant, PlanTier } from './Tenant';

export { MetaConnectionModel, MetaConnection } from './MetaConnection';
export type { IMetaConnection, ConnectionStatus } from './MetaConnection';

export { WebsiteAuditModel, WebsiteAudit } from './WebsiteAudit';
export type { IWebsiteAudit, AuditStatus } from './WebsiteAudit';

export { GeneratedCopyModel, GeneratedCopy } from './GeneratedCopy';
export type { IGeneratedCopy, CopyContext, IUsedByRef } from './GeneratedCopy';
