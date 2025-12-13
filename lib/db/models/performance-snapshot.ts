import mongoose, { Schema, Document, Model } from 'mongoose';

export type EntityType = 'CAMPAIGN' | 'AD_SET' | 'AD';

export interface IPerformanceSnapshot extends Document {
  entityType: EntityType;
  entityId: string;
  date: Date; // Day granularity
  impressions: number;
  clicks: number;
  spend: number; // in account currency
  conversions: number;
  accountId: string;
  revenue?: number; // optional revenue
  reach: number;
  frequency: number;
  cpm: number;
  cpc: number;
  ctr: number;
  cpa: number;
  roas: number;
  createdAt: Date;
  updatedAt: Date;
}

const PerformanceSnapshotSchema = new Schema<IPerformanceSnapshot>(
  {
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    date: { type: Date, required: true },
    impressions: { type: Number, required: true, min: 0 },
    clicks: { type: Number, required: true, min: 0 },
    spend: { type: Number, required: true, min: 0 },
    conversions: { type: Number, required: true, min: 0 },
    accountId: { type: String, required: true, index: true },
    revenue: { type: Number, min: 0 },
    reach: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },
    cpm: { type: Number, default: 0 },
    cpc: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    cpa: { type: Number, default: 0 },
    roas: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Explicit indexes
PerformanceSnapshotSchema.index({ entityType: 1, entityId: 1, date: 1 }, { unique: true });
PerformanceSnapshotSchema.index({ date: 1 });

export const PerformanceSnapshotModel: Model<IPerformanceSnapshot> =
  mongoose.models.PerformanceSnapshot ||
  mongoose.model<IPerformanceSnapshot>('PerformanceSnapshot', PerformanceSnapshotSchema);

export default PerformanceSnapshotModel;
