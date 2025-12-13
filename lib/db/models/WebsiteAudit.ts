import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface IAuditIssue {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  path?: string;
}

export interface IWebsiteAudit extends Document {
  tenantId: string;
  url: string;
  status: AuditStatus;
  issues: IAuditIssue[];
  metrics?: Record<string, any>;
  lastRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuditIssueSchema = new Schema<IAuditIssue>({
  code: { type: String, required: true },
  severity: { type: String, required: true },
  message: { type: String, required: true },
  path: { type: String },
}, { _id: false });

const WebsiteAuditSchema = new Schema<IWebsiteAudit>({
  tenantId: { type: String, required: true },
  url: { type: String, required: true },
  status: { type: String, required: true },
  issues: { type: [AuditIssueSchema], default: [] },
  metrics: { type: Schema.Types.Mixed },
  lastRunAt: { type: Date },
}, { timestamps: true });

// Indexes
WebsiteAuditSchema.index({ tenantId: 1, url: 1 }, { unique: true });
WebsiteAuditSchema.index({ status: 1 });
WebsiteAuditSchema.index({ lastRunAt: 1 }, { sparse: true });

export const WebsiteAuditModel: Model<IWebsiteAudit> =
  mongoose.models.WebsiteAudit || mongoose.model<IWebsiteAudit>('WebsiteAudit', WebsiteAuditSchema);

export class WebsiteAudit {
  static async create(data: Partial<IWebsiteAudit>): Promise<IWebsiteAudit> {
    return WebsiteAuditModel.create(data);
  }
  static async findByTenantAndUrl(tenantId: string, url: string): Promise<IWebsiteAudit | null> {
    return WebsiteAuditModel.findOne({ tenantId, url }).exec();
  }
  static async updateStatus(tenantId: string, url: string, status: AuditStatus): Promise<IWebsiteAudit | null> {
    return WebsiteAuditModel.findOneAndUpdate({ tenantId, url }, { status }, { new: true }).exec();
  }
}

export default WebsiteAuditModel;
