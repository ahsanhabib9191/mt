import mongoose, { Schema, Document, Model } from 'mongoose';
import { hashApiKey, generateApiKey } from '../../utils/crypto';

export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export interface ITenant extends Document {
  tenantId: string; // unique identifier
  name: string;
  primaryDomain?: string;
  plan: PlanTier;
  settings?: Record<string, any>;
  apiKeyHash?: string;
  requestCounts?: {
    daily: number;
    monthly: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>({
  tenantId: { type: String, required: true },
  name: { type: String, required: true },
  primaryDomain: { type: String },
  plan: { type: String, required: true },
  settings: { type: Schema.Types.Mixed },
  apiKeyHash: { type: String },
  requestCounts: {
    daily: { type: Number, default: 0 },
    monthly: { type: Number, default: 0 },
  },
}, { timestamps: true });

// Indexes
TenantSchema.index({ tenantId: 1 }, { unique: true });
TenantSchema.index({ primaryDomain: 1 }, { sparse: true });
TenantSchema.index({ apiKeyHash: 1 }, { sparse: true }); // Used in API key authentication

export const TenantModel: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);

export class Tenant {
  static async create(data: Partial<ITenant>): Promise<ITenant> {
    return TenantModel.create(data);
  }
  static async findById(id: string): Promise<ITenant | null> {
    return TenantModel.findById(id).exec();
  }
  static async findByTenantId(tenantId: string): Promise<ITenant | null> {
    return TenantModel.findOne({ tenantId }).exec();
  }
  static async updateByTenantId(tenantId: string, data: Partial<ITenant>): Promise<ITenant | null> {
    return TenantModel.findOneAndUpdate({ tenantId }, data, { new: true }).exec();
  }
  static async incrementRequestCounts(tenantId: string, dailyInc = 1, monthlyInc = 1): Promise<void> {
    await TenantModel.updateOne(
      { tenantId },
      { $inc: { 'requestCounts.daily': dailyInc, 'requestCounts.monthly': monthlyInc } }
    ).exec();
  }
  static async issueApiKey(tenantId: string): Promise<string> {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    await TenantModel.updateOne({ tenantId }, { apiKeyHash }).exec();
    return apiKey;
  }
  static async verifyApiKey(tenantId: string, apiKey: string): Promise<boolean> {
    const t = await TenantModel.findOne({ tenantId }).select('apiKeyHash').lean();
    if (!t || !t.apiKeyHash) return false;
    return t.apiKeyHash === hashApiKey(apiKey);
  }
}

export default TenantModel;
