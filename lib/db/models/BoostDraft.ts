import mongoose, { Document, Schema } from 'mongoose';

export interface IBoostDraft extends Document {
  sessionId: string;
  tenantId?: string;
  url: string;
  title?: string;
  description?: string;
  usp?: string;
  images: string[];
  brandColors: string[];
  pageSpeed?: {
    score: 'fast' | 'medium' | 'slow';
    loadTime: number;
  };
  pixel: {
    detected: boolean;
    pixelId: string | null;
    initEvents: string[];
  };
  adCopy: Array<{
    headline: string;
    primaryText: string;
    description: string;
    callToAction: string;
    angle: string;
    hook: string;
  }>;
  targetAudience?: {
    interests: string[];
    ageRange: { min: number; max: number };
    gender: string;
    demographics: string[];
  };
  productCategory?: string;
  selectedAdIndex: number;
  selectedImageUrl?: string;
  headline?: string;
  primaryText?: string;
  cta: string;
  targeting?: {
    interests: string[];
    ageMin: number;
    ageMax: number;
    gender: string;
    countries: string[];
  };
  budget: number;
  duration: number;
  status: 'draft' | 'launched' | 'failed';
  launchedCampaignId?: string;
  launchedCampaignUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BoostDraftSchema = new Schema<IBoostDraft>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, index: true },
    url: { type: String, required: true },
    title: String,
    description: String,
    usp: String,
    images: { type: [String], default: [] },
    brandColors: { type: [String], default: [] },
    pageSpeed: {
      score: { type: String, enum: ['fast', 'medium', 'slow'] },
      loadTime: Number,
    },
    pixel: {
      detected: { type: Boolean, default: false },
      pixelId: { type: String, default: null },
      initEvents: { type: [String], default: [] },
    },
    adCopy: [{
      headline: String,
      primaryText: String,
      description: String,
      callToAction: String,
      angle: String,
      hook: String,
    }],
    targetAudience: {
      interests: [String],
      ageRange: {
        min: Number,
        max: Number,
      },
      gender: String,
      demographics: [String],
    },
    productCategory: String,
    selectedAdIndex: { type: Number, default: 0 },
    selectedImageUrl: String,
    headline: String,
    primaryText: String,
    cta: { type: String, default: 'LEARN_MORE' },
    targeting: {
      interests: [String],
      ageMin: Number,
      ageMax: Number,
      gender: String,
      countries: [String],
    },
    budget: { type: Number, default: 10 },
    duration: { type: Number, default: 7 },
    status: { type: String, enum: ['draft', 'launched', 'failed'], default: 'draft', index: true },
    launchedCampaignId: String,
    launchedCampaignUrl: String,
    errorMessage: String,
  },
  {
    timestamps: true,
  }
);

export const BoostDraftModel = mongoose.model<IBoostDraft>('BoostDraft', BoostDraftSchema);
