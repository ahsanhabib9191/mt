import jwt from 'jsonwebtoken';
import type { IncomingMessage } from 'http';
import { TenantModel } from '../db/models/Tenant';
import { hashApiKey } from '../utils/crypto';
import type { PlanTier } from '../db/models/Tenant';

export interface AuthUser {
  userId: string;
  tenantId: string;
  email: string;
  plan: PlanTier;
}

function getTokenFromHeaders(req: IncomingMessage): string | null {
  const auth = (req.headers['authorization'] || '') as string;
  if (auth && auth.startsWith('Bearer ')) return auth.substring(7);
  return null;
}

export async function verifyAuth(req: IncomingMessage): Promise<AuthUser | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const token = getTokenFromHeaders(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret) as any;
    if (!payload?.userId || !payload?.tenantId || !payload?.email) return null;
    // Only select the plan field for efficiency
    const tenant = await TenantModel.findOne({ tenantId: payload.tenantId }).select('plan').lean();
    if (!tenant) return null;
    return { userId: payload.userId, tenantId: payload.tenantId, email: payload.email, plan: tenant.plan };
  } catch {
    return null;
  }
}

// Minimal handler types to avoid Next.js dependency
type MinimalHandler = (req: IncomingMessage & { [key: string]: any }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body?: any) => void }) => any | Promise<any>;

export function requireAuth(handler: MinimalHandler): MinimalHandler {
  return async (req, res) => {
    const user = await verifyAuth(req);
    if (!user) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' }));
      return;
    }
    (req as any).user = user;
    return handler(req, res);
  };
}

export async function verifyApiKey(req: IncomingMessage): Promise<AuthUser | null> {
  const apiKey = (req.headers['x-api-key'] || '') as string;
  if (!apiKey) return null;
  const hash = hashApiKey(apiKey);
  // Only select the required fields for efficiency
  const tenant = await TenantModel.findOne({ apiKeyHash: hash }).select('tenantId plan').lean();
  if (!tenant) return null;
  return { userId: tenant.tenantId, tenantId: tenant.tenantId, email: '', plan: tenant.plan };
}
