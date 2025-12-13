/**
 * Next.js API Route: Facebook OAuth Callback
 * 
 * GET /api/auth/callback/facebook
 * 
 * Handles the OAuth callback from Facebook after user authorization.
 * Exchanges authorization code for access token and saves to database.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getUserInfo,
  saveMetaConnection,
  debugToken,
} from '../../../../lib/services/meta-oauth/oauth-service';
import { connectDB } from '../../../../lib/db/client';
import logger from '../../../../lib/utils/logger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Connect to database
    await connectDB();

    // Get OAuth parameters from query
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors (user denied, etc.)
    if (error) {
      logger.error('OAuth error from Facebook', { error, error_description });
      return res.redirect(`/auth/error?error=${error}&description=${error_description}`);
    }

    // Validate required parameters
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'Missing state parameter' });
    }

    // Verify CSRF token (state parameter)
    // In production, retrieve stored state from session/database
    // Example: const storedState = await redis.get(`oauth:state:${state}`);
    // For demo, we'll use cookie
    const cookies = parseCookies(req.headers.cookie || '');
    const storedState = cookies.oauth_state;
    const tenantId = cookies.oauth_tenant || 'default-tenant';

    if (state !== storedState) {
      logger.error('State mismatch - possible CSRF attack', { 
        received: state, 
        expected: storedState 
      });
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    logger.info('OAuth callback received', { tenantId });

    // Step 1: Exchange authorization code for short-lived access token
    const shortLivedToken = await exchangeCodeForToken(code);

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longLivedToken = await exchangeForLongLivedToken(shortLivedToken.access_token);

    // Step 3: Debug token to get metadata and validate
    const tokenData = await debugToken(longLivedToken.access_token);

    logger.info('Token obtained and validated', {
      userId: tokenData.user_id,
      scopes: tokenData.scopes,
      expiresAt: new Date(tokenData.expires_at * 1000),
    });

    // Step 4: Get user information
    const userInfo = await getUserInfo(longLivedToken.access_token);

    // Step 5: Save connection to database (also fetches and saves ad accounts)
    await saveMetaConnection(
      tenantId,
      longLivedToken.access_token,
      userInfo.id,
      userInfo.name,
      userInfo.email,
      tokenData.scopes
    );

    logger.info('Meta connection saved successfully', { tenantId, userId: userInfo.id });

    // Clear OAuth cookies
    res.setHeader('Set-Cookie', [
      'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      'oauth_tenant=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
    ]);

    // Redirect to success page
    res.redirect('/dashboard?connected=true');

  } catch (error) {
    logger.error('OAuth callback error', { error });
    console.error('OAuth callback error:', error);
    
    res.redirect(`/auth/error?message=${encodeURIComponent(
      error instanceof Error ? error.message : 'Failed to complete OAuth flow'
    )}`);
  }
}

/**
 * Parse cookie header string into object
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as Record<string, string>);
}
