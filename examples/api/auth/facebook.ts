/**
 * Next.js API Route: Facebook OAuth Initiation
 * 
 * GET /api/auth/facebook
 * 
 * Initiates the OAuth flow by redirecting user to Facebook authorization page.
 * User will be prompted to grant permissions to the app.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { generateAuthorizationUrl } from '../../../lib/services/meta-oauth/oauth-service';
import { META_ALL_SCOPES } from '../../../lib/utils/meta-scopes';
import crypto from 'crypto';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get tenant ID from session or query parameter
    // In production, get this from authenticated session
    const tenantId = req.query.tenant as string || 'default-tenant';

    // Generate CSRF token for security
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in session or database with tenantId
    // This is crucial for security - verify this in callback
    // Example: await redis.setex(`oauth:state:${state}`, 600, tenantId);

    // For demo purposes, we'll use a cookie
    res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
    res.setHeader('Set-Cookie', `oauth_tenant=${tenantId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);

    // Generate authorization URL with all required scopes
    const authUrl = generateAuthorizationUrl(state, [...META_ALL_SCOPES]);

    // Redirect user to Facebook authorization page
    res.redirect(authUrl);

  } catch (error) {
    console.error('OAuth initiation error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate OAuth flow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
