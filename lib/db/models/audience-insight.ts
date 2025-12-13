import mongoose, { Schema, Document, Model } from 'mongoose';

export type InsightEntity = 'CAMPAIGN' | 'AD_SET' | 'AD';
export type InsightDimension = 'AGE' | 'GENDER' | 'LOCATION' | 'INTEREST' | 'PLACEMENT' | 'DEVICE';

export interface IAudienceInsight extends Document {
  entityType: InsightEntity;
  entityId: string;
  dimension: InsightDimension;
  value: string; // e.g., "25-34", "Female", "California"
  date: Date;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AudienceInsightSchema = new Schema<IAudienceInsight>(
  {
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    dimension: { type: String, required: true },
    value: { type: String, required: true },
    date: { type: Date, required: true },
    impressions: { type: Number, required: true, min: 0 },
    clicks: { type: Number, required: true, min: 0 },
    conversions: { type: Number, required: true, min: 0 },
    spend: { type: Number, required: true, min: 0 },
    revenue: { type: Number, min: 0 },
  },
  { timestamps: true }
);

// Explicit indexes
AudienceInsightSchema.index({ entityType: 1, entityId: 1, dimension: 1, value: 1, date: 1 }, { unique: true });
AudienceInsightSchema.index({ date: 1 });

export const AudienceInsightModel: Model<IAudienceInsight> =
  mongoose.models.AudienceInsight ||
  mongoose.model<IAudienceInsight>('AudienceInsight', AudienceInsightSchema);

export default AudienceInsightModel;
