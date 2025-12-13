import mongoose, { Schema, Document, Model } from 'mongoose';

export type AdAccountStatus = 1 | 2 | 3 | 7 | 9; // Aligns with Meta status codes

export interface IAdAccount extends Document {
  accountId: string;
  name: string;
  currency: string;
  timezone: string;
  status: AdAccountStatus; // 1=Active, 2=Disabled, 3=Unsettled, 7=Pending Review, 9=Closed
  spendingLimit?: number;
  businessId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdAccountSchema = new Schema<IAdAccount>(
  {
    accountId: { type: String, required: true },
    name: { type: String, required: true },
    currency: { type: String, required: true },
    timezone: { type: String, required: true },
    status: { type: Number, required: true },
    spendingLimit: { type: Number },
    businessId: { type: String },
  },
  { timestamps: true }
);

// Explicit indexes (removed redundant inline index: true definitions)
AdAccountSchema.index({ accountId: 1 }, { unique: true });
AdAccountSchema.index({ status: 1 });
AdAccountSchema.index({ businessId: 1 }, { sparse: true });

export const AdAccountModel: Model<IAdAccount> =
  mongoose.models.AdAccount || mongoose.model<IAdAccount>('AdAccount', AdAccountSchema);

export default AdAccountModel;
