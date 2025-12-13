import mongoose, { Schema, Document, Model } from 'mongoose';
import { IAdSet } from './ad-set';
import { ICampaign } from './campaign';

export type AdStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DRAFT';
export type AdEffectiveStatus = 'ACTIVE' | 'PAUSED' | 'DISAPPROVED' | 'PENDING_REVIEW' | 'ARCHIVED' | 'DELETED' | 'ADSET_PAUSED' | 'CAMPAIGN_PAUSED';

const AD_STATUS_VALUES: AdStatus[] = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT'];
const AD_EFFECTIVE_STATUS_VALUES: AdEffectiveStatus[] = ['ACTIVE', 'PAUSED', 'DISAPPROVED', 'PENDING_REVIEW', 'ARCHIVED', 'DELETED', 'ADSET_PAUSED', 'CAMPAIGN_PAUSED'];

export interface IAdIssue {
  errorCode?: string;
  errorMessage: string;
  errorSummary?: string;
  level: 'ERROR' | 'WARNING';
}

export interface IAdCreative {
  creativeId?: string;
  type?: string;
  headline?: string;
  body?: string;
  callToAction?: string;
  linkUrl?: string;
  metadata?: Record<string, any>;
}

export interface IAd extends Document {
  adId: string;
  adSetId: string;
  campaignId: string;
  accountId: string;
  tenantId: string;
  name: string;
  status: AdStatus;
  creative: IAdCreative;
  effectiveStatus: AdEffectiveStatus;
  issues?: IAdIssue[];
  createdAt: Date;
  updatedAt: Date;
}

const AdIssueSchema = new Schema<IAdIssue>({
  errorCode: { type: String },
  errorMessage: { type: String, required: true },
  errorSummary: { type: String },
  level: { type: String, required: true },
}, { _id: false });

const AdCreativeSchema = new Schema<IAdCreative>({
  creativeId: { type: String },
  type: { type: String },
  headline: { type: String },
  body: { type: String },
  callToAction: { type: String },
  linkUrl: { type: String },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const AdSchema = new Schema<IAd>({
  adId: { type: String, required: true },
  adSetId: { type: String, required: true },
  campaignId: { type: String, required: true },
  accountId: { type: String, required: true },
  tenantId: { type: String },
  name: { type: String, required: true },
  status: { type: String, required: true, enum: AD_STATUS_VALUES },
  creative: { type: AdCreativeSchema, required: true },
  effectiveStatus: { type: String, required: true, enum: AD_EFFECTIVE_STATUS_VALUES },
  issues: { type: [AdIssueSchema], default: [] },
}, { timestamps: true });

// Indexes
AdSchema.index({ adId: 1 }, { unique: true });
AdSchema.index({ adSetId: 1, status: 1 });
AdSchema.index({ campaignId: 1, status: 1 });
AdSchema.index({ accountId: 1, status: 1 });
AdSchema.index({ effectiveStatus: 1 });
AdSchema.index({ 'creative.creativeId': 1 });

export const AdModel: Model<IAd> =
  mongoose.models.Ad || mongoose.model<IAd>('Ad', AdSchema);

export default AdModel;
