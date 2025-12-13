import { z, ZodSchema } from 'zod';

export const urlSchema = z.string().url({ message: 'Invalid URL' }).refine((u) => /^(https?:)\/\//.test(u), {
  message: 'URL must start with http or https'
});

export function validateUrl(url: string): boolean {
  return urlSchema.safeParse(url).success;
}

export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // remove common tracking params
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((p) => u.searchParams.delete(p));
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

export const emailSchema = z.string().email({ message: 'Invalid email address' });
export function validateEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export const metaAdAccountIdSchema = z.string().regex(/^act_\d{6,}$/,{ message: 'Invalid Meta Ad Account ID (expected act_XXXXXXXXXX)' });
export const metaPixelIdSchema = z.string().regex(/^\d+$/,{ message: 'Invalid Meta Pixel ID (numeric string expected)' });
export const metaPageIdSchema = z.string().regex(/^\d+$/,{ message: 'Invalid Meta Page ID (numeric string expected)' });

export const industrySchema = z.enum(['ecommerce','saas','education','healthcare','finance','agency','other']);
export const objectiveSchema = z.enum(['OUTCOME_AWARENESS','OUTCOME_TRAFFIC','OUTCOME_SALES','OUTCOME_ENGAGEMENT','OUTCOME_LEADS']);
export const budgetSchema = z.number().min(1, { message: 'Budget must be at least 1' }).max(1000000, { message: 'Budget exceeds max allowed' });

export function validateAndParse<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeValidate<T>(schema: ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } {
  const res = schema.safeParse(data);
  if (res.success) return { success: true, data: res.data };
  return { success: false, errors: res.error.errors.map((e) => e.message) };
}
