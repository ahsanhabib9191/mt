import mongoose, { Document, Schema } from 'mongoose';

export interface ICreativeAsset extends Document {
  assetId: string;           // Unique ID for our system (UUID)
  tenantId?: string;         // Allowing undefined for simple single-tenant setups
  accountId: string;         // Meta Ad Account ID this asset belongs to

  originalUrl: string;       // Where we found it
  storageUrl?: string;       // Where we stored it (if we had S3, for now nullable)

  metaImageHash?: string;    // The critical hash from Meta
  metaAdImageId?: string;    // Sometimes Meta gives an ID for the image object

  type: 'IMAGE' | 'VIDEO';
  status: 'DISCOVERED' | 'PROCESSING' | 'READY' | 'FAILED';

  specs?: {
    width: number;
    height: number;
    size: number;
    format: string;
  };

  metadata?: {
    source: 'SCRAPED' | 'UPLOADED';
    scrapedFrom?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const CreativeAssetSchema = new Schema<ICreativeAsset>({
  assetId: { type: String, required: true, unique: true, index: true },
  tenantId: { type: String, index: true },
  accountId: { type: String, required: true, index: true },

  originalUrl: { type: String, required: true },
  storageUrl: { type: String },

  metaImageHash: { type: String }, // Used to check if we already uploaded it
  metaAdImageId: { type: String },

  type: { type: String, enum: ['IMAGE', 'VIDEO'], default: 'IMAGE' },
  status: { type: String, enum: ['DISCOVERED', 'PROCESSING', 'READY', 'FAILED'], default: 'DISCOVERED' },

  specs: {
    width: Number,
    height: Number,
    size: Number,
    format: String
  },

  metadata: {
    source: { type: String, enum: ['SCRAPED', 'UPLOADED'] },
    scrapedFrom: String
  }
}, {
  timestamps: true
});

// Index to quickly find if we already have this URL for this account
CreativeAssetSchema.index({ accountId: 1, originalUrl: 1 });

export const CreativeAssetModel = mongoose.model<ICreativeAsset>('CreativeAsset', CreativeAssetSchema);
