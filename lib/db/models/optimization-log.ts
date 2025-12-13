import mongoose, { Schema, Document, Model } from 'mongoose';

export type OptimizationEntity = 'CAMPAIGN' | 'AD_SET' | 'AD' | 'ACCOUNT';

export interface IOptimizationLog extends Document {
  message: string; // User-friendly message
  severity: 'INFO' | 'WARNING' | 'ACTION' | 'ERROR';
  action: string;
  entityType: OptimizationEntity;
  entityId: string;
  accountId: string; // Linking to the Ad Account
  ruleId?: string;
  reason: string;
  previousValue: string;
  newValue: string;
  performedBy: string;
  performedAt: Date;
  success: boolean;
  executedAt: Date;
  details?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const OptimizationLogSchema = new Schema<IOptimizationLog>(
  {
    message: { type: String, required: true },
    severity: { type: String, enum: ['INFO', 'WARNING', 'ACTION', 'ERROR'], default: 'INFO' },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    accountId: { type: String, required: true, index: true },
    ruleId: { type: String },
    reason: { type: String, required: true },
    previousValue: { type: String },
    newValue: { type: String },
    performedBy: { type: String, default: 'system' },
    performedAt: { type: Date, default: Date.now },
    success: { type: Boolean, required: true },
    executedAt: { type: Date, required: true, index: true },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Explicit indexes
OptimizationLogSchema.index({ entityType: 1, entityId: 1, executedAt: 1 });
OptimizationLogSchema.index({ ruleId: 1 });
OptimizationLogSchema.index({ success: 1, executedAt: 1 });

export const OptimizationLogModel: Model<IOptimizationLog> =
  mongoose.models.OptimizationLog ||
  mongoose.model<IOptimizationLog>('OptimizationLog', OptimizationLogSchema);

export default OptimizationLogModel;
