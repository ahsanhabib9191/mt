import mongoose, { Schema, Document, Model } from 'mongoose';

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DRAFT' | 'LEARNING' | 'LEARNING_LIMITED';
export type CampaignObjective = 'OUTCOME_AWARENESS' | 'OUTCOME_TRAFFIC' | 'OUTCOME_SALES' | 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEADS';

export interface ICampaign extends Document {
  campaignId: string;
  accountId: string;
  tenantId: string;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  budget: number; // Daily budget
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    campaignId: { type: String, required: true },
    accountId: { type: String, required: true },
    tenantId: { type: String },
    name: { type: String, required: true },
    objective: { type: String, required: true },
    status: { type: String, required: true },
    budget: { type: Number, required: true, min: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

// Explicit indexes
CampaignSchema.index({ campaignId: 1 }, { unique: true });
CampaignSchema.index({ accountId: 1, status: 1 });
CampaignSchema.index({ objective: 1 });

export const CampaignModel: Model<ICampaign> =
  mongoose.models.Campaign || mongoose.model<ICampaign>('Campaign', CampaignSchema);

export default CampaignModel;
