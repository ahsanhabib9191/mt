import dotenv from 'dotenv';
import {
  validateUrl,
  sanitizeUrl,
  validateEmail,
  validateAndParse,
  safeValidate,
  urlSchema,
  emailSchema,
  metaAdAccountIdSchema,
  metaPixelIdSchema,
  metaPageIdSchema,
  industrySchema,
  objectiveSchema,
  budgetSchema
} from '../lib/utils/validators';

dotenv.config();

async function run() {
  console.log('Testing validators...');

  // Test URL validation
  if (!validateUrl('https://example.com')) throw new Error('Valid HTTPS URL failed validation');
  if (!validateUrl('http://example.com')) throw new Error('Valid HTTP URL failed validation');
  if (validateUrl('ftp://example.com')) throw new Error('FTP URL should not validate');
  if (validateUrl('not-a-url')) throw new Error('Invalid URL should not validate');
  if (validateUrl('')) throw new Error('Empty URL should not validate');

  // Test URL sanitization
  const dirtyUrl = 'https://example.com/page?utm_source=test&utm_campaign=fall&id=123#section';
  const clean = sanitizeUrl(dirtyUrl);
  if (clean.includes('utm_source') || clean.includes('utm_campaign')) {
    throw new Error('UTM parameters should be removed from URL');
  }
  if (clean.includes('#section')) throw new Error('Hash should be removed from URL');
  if (!clean.includes('id=123')) throw new Error('Non-UTM parameters should be preserved');

  // Test email validation
  if (!validateEmail('test@example.com')) throw new Error('Valid email failed validation');
  if (!validateEmail('user+tag@domain.co.uk')) throw new Error('Email with + and subdomain failed');
  if (validateEmail('invalid.email')) throw new Error('Invalid email should not validate');
  if (validateEmail('@example.com')) throw new Error('Email without username should not validate');
  if (validateEmail('user@')) throw new Error('Email without domain should not validate');

  // Test Meta ID schemas
  if (!metaAdAccountIdSchema.safeParse('act_123456').success) {
    throw new Error('Valid Meta Ad Account ID failed validation');
  }
  if (!metaAdAccountIdSchema.safeParse('act_1234567890').success) {
    throw new Error('Long Meta Ad Account ID failed validation');
  }
  if (metaAdAccountIdSchema.safeParse('123456').success) {
    throw new Error('Ad Account ID without act_ prefix should not validate');
  }
  if (metaAdAccountIdSchema.safeParse('act_123').success) {
    throw new Error('Ad Account ID with too few digits should not validate');
  }

  if (!metaPixelIdSchema.safeParse('123456789').success) {
    throw new Error('Valid Meta Pixel ID failed validation');
  }
  if (metaPixelIdSchema.safeParse('abc123').success) {
    throw new Error('Pixel ID with letters should not validate');
  }

  if (!metaPageIdSchema.safeParse('987654321').success) {
    throw new Error('Valid Meta Page ID failed validation');
  }
  if (metaPageIdSchema.safeParse('page_123').success) {
    throw new Error('Page ID with letters should not validate');
  }

  // Test enum schemas
  const validIndustries = ['ecommerce', 'saas', 'education', 'healthcare', 'finance', 'agency', 'other'];
  for (const industry of validIndustries) {
    if (!industrySchema.safeParse(industry).success) {
      throw new Error(`Valid industry "${industry}" failed validation`);
    }
  }
  if (industrySchema.safeParse('invalid-industry').success) {
    throw new Error('Invalid industry should not validate');
  }

  const validObjectives = ['OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_SALES', 'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS'];
  for (const objective of validObjectives) {
    if (!objectiveSchema.safeParse(objective).success) {
      throw new Error(`Valid objective "${objective}" failed validation`);
    }
  }
  if (objectiveSchema.safeParse('INVALID_OBJECTIVE').success) {
    throw new Error('Invalid objective should not validate');
  }

  // Test budget schema
  if (!budgetSchema.safeParse(100).success) throw new Error('Valid budget failed validation');
  if (!budgetSchema.safeParse(1).success) throw new Error('Minimum budget (1) failed validation');
  if (!budgetSchema.safeParse(1000000).success) throw new Error('Maximum budget failed validation');
  if (budgetSchema.safeParse(0).success) throw new Error('Zero budget should not validate');
  if (budgetSchema.safeParse(-100).success) throw new Error('Negative budget should not validate');
  if (budgetSchema.safeParse(1000001).success) throw new Error('Budget exceeding max should not validate');

  // Test validateAndParse (should throw on invalid data)
  try {
    validateAndParse(emailSchema, 'invalid-email');
    throw new Error('validateAndParse should throw on invalid data');
  } catch (err: any) {
    if (!err.message.includes('Invalid')) {
      throw new Error('validateAndParse should throw Zod validation error');
    }
  }

  const validEmail = validateAndParse(emailSchema, 'test@example.com');
  if (validEmail !== 'test@example.com') throw new Error('validateAndParse should return parsed data');

  // Test safeValidate
  const invalidResult = safeValidate(emailSchema, 'bad-email');
  if (invalidResult.success) throw new Error('safeValidate should return success=false for invalid data');
  if (!invalidResult.errors || invalidResult.errors.length === 0) {
    throw new Error('safeValidate should return errors for invalid data');
  }

  const validResult = safeValidate(emailSchema, 'good@example.com');
  if (!validResult.success) throw new Error('safeValidate should return success=true for valid data');
  if (validResult.data !== 'good@example.com') throw new Error('safeValidate should return parsed data');

  // Test complex validation scenarios
  const complexUrl = 'https://sub.domain.example.com:8080/path/to/page?valid=param&utm_source=remove#hash';
  const sanitized = sanitizeUrl(complexUrl);
  if (sanitized.includes('utm_')) throw new Error('Complex URL should have UTM params removed');
  if (sanitized.includes('#')) throw new Error('Complex URL should have hash removed');

  // Test edge cases
  try {
    sanitizeUrl('not-a-valid-url-at-all');
    // Should return original if parsing fails
  } catch (err) {
    // This is acceptable behavior
  }

  console.log('✅ All validator tests passed');
}

run().catch((err) => {
  console.error('❌ Validator tests failed:', err.message);
  process.exit(1);
});