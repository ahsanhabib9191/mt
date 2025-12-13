import crypto from 'crypto';
import bcrypt from 'bcrypt';

const IV_LENGTH = 16; // 16 bytes for AES-GCM
const ALGO = 'aes-256-gcm';

// Cache the encryption key to avoid parsing on every encrypt/decrypt call
let cachedKey: Buffer | null = null;
let cachedKeyEnv: string | undefined = undefined;

function getKey(): Buffer {
  const currentKeyEnv = process.env.ENCRYPTION_KEY;
  
  // Clear cache if environment variable changed
  if (cachedKey && currentKeyEnv !== cachedKeyEnv) {
    cachedKey = null;
  }
  
  if (cachedKey) {
    return cachedKey;
  }
  
  const keyHex = currentKeyEnv || '';
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars).');
  }
  cachedKey = Buffer.from(keyHex, 'hex');
  cachedKeyEnv = currentKeyEnv;
  return cachedKey;
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store: [IV(16)] [AUTH_TAG(16)] [CIPHERTEXT]
  const payload = Buffer.concat([iv, authTag, encrypted]);
  return payload.toString('base64');
}

export function decrypt(encryptedText: string): string {
  try {
    const payload = Buffer.from(encryptedText, 'base64');
    if (payload.length < IV_LENGTH * 2) {
      throw new Error('Invalid encrypted payload.');
    }
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH * 2);
    const ciphertext = payload.subarray(IV_LENGTH * 2);
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error('Failed to decrypt payload: ' + (err as Error).message);
  }
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
