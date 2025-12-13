import mongoose, { Schema, Model } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

export type CopyContext = 'AD' | 'LANDING_PAGE' | 'EMAIL' | 'SOCIAL_POST' | 'UNKNOWN';

export interface IUsedByRef {
  entityType: 'CAMPAIGN' | 'AD_SET' | 'AD';
  entityId: string;
}

export interface IGeneratedCopy {
  tenantId: string;
  context: CopyContext;
  inputBrief: string;
  outputText: string;
  model?: string; // e.g., 'gpt-4o'
  qualityScore?: number;
  tags?: string[];
  usedBy?: IUsedByRef[];
  createdAt?: Date;
  updatedAt?: Date;
}

const UsedByRefSchema = new Schema<IUsedByRef>({
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
}, { _id: false });

const GeneratedCopySchema = new Schema<IGeneratedCopy>({
  tenantId: { type: String, required: true },
  context: { type: String, required: true },
  inputBrief: { type: String, required: true },
  outputText: { type: String, required: true },
  model: { type: String },
  qualityScore: { type: Number },
  tags: { type: [String], default: [] },
  usedBy: { type: [UsedByRefSchema], default: [] },
}, { timestamps: true });

// Indexes
GeneratedCopySchema.index({ tenantId: 1, context: 1, createdAt: -1 });
GeneratedCopySchema.index({ tags: 1 });

export type GeneratedCopyDoc = HydratedDocument<IGeneratedCopy>;

export const GeneratedCopyModel: Model<GeneratedCopyDoc> =
  mongoose.models.GeneratedCopy || mongoose.model<IGeneratedCopy>('GeneratedCopy', GeneratedCopySchema);

export class GeneratedCopy {
  static async create(data: Partial<IGeneratedCopy>): Promise<GeneratedCopyDoc> {
    return GeneratedCopyModel.create(data);
  }
  static async findByTenant(tenantId: string): Promise<GeneratedCopyDoc[]> {
    return GeneratedCopyModel.find({ tenantId }).sort({ createdAt: -1 }).exec();
  }
  static async appendUsage(id: string, ref: IUsedByRef): Promise<GeneratedCopyDoc | null> {
    return GeneratedCopyModel.findByIdAndUpdate(id, { $push: { usedBy: ref } }, { new: true }).exec();
  }
}

export default GeneratedCopyModel;
