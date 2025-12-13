import { MetaConnectionModel } from '../../db/models/MetaConnection';
import { encrypt, decrypt } from '../../utils/crypto';
import logger from '../../utils/logger';
import { META_REQUIRED_SCOPES } from '../../utils/meta-scopes';

// Treat default placeholders as undefined to trigger Demo Mode
const META_APP_ID = process.env.META_APP_ID === 'your_meta_app_id' ? undefined : process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET === 'your_meta_app_secret' ? undefined : process.env.META_APP_SECRET;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/facebook';
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';

if (!META_APP_ID || !META_APP_SECRET) {
  logger.error('META_APP_ID and META_APP_SECRET must be configured for OAuth flow');
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface DebugTokenResponse {
  data: {
    app_id: string;
    type: string;
    application: string;
    data_access_expires_at: number;
    expires_at: number;
    is_valid: boolean;
    issued_at: number;
    scopes: string[];
    user_id: string;
  };
}

interface UserData {
  id: string;
  name: string;
  email?: string;
}

interface AdAccountData {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number;
}

/**
 * Generate OAuth authorization URL for user to authorize the app
 */
export function generateAuthorizationUrl(state: string, scopes?: string[]): string {
  // DEMO MODE: If credentials missing, return immediate redirect
  if (!META_APP_ID) {
    logger.warn('Running in DEMO MODE: Returning mock auth URL');
    // Redirect straight to frontend callback with fake code
    const mockCallback = new URL('http://localhost:5173/oauth-callback');
    mockCallback.searchParams.set('code', 'mock_auth_code_' + Date.now());
    mockCallback.searchParams.set('state', state);
    return mockCallback.toString();
  }

  const authUrl = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);

  authUrl.searchParams.set('client_id', META_APP_ID);
  authUrl.searchParams.set('redirect_uri', META_REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', (scopes || META_REQUIRED_SCOPES).join(','));
  authUrl.searchParams.set('response_type', 'code');

  logger.info('Generated OAuth authorization URL', { state, scopes: scopes?.length || META_REQUIRED_SCOPES.length });

  return authUrl.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('META_APP_ID and META_APP_SECRET must be configured');
  }

  const tokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set('client_id', META_APP_ID);
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
  tokenUrl.searchParams.set('redirect_uri', META_REDIRECT_URI);
  tokenUrl.searchParams.set('code', code);

  logger.info('Exchanging authorization code for access token');

  const response = await fetch(tokenUrl.toString());

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to exchange code for token', {
      status: response.status,
      error: errorText
    });
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  const tokenData = await response.json() as TokenResponse;

  logger.info('Successfully exchanged code for access token', {
    expires_in: tokenData.expires_in
  });

  return tokenData;
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<TokenResponse> {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('META_APP_ID and META_APP_SECRET must be configured');
  }

  const tokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
  tokenUrl.searchParams.set('client_id', META_APP_ID);
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
  tokenUrl.searchParams.set('fb_exchange_token', shortLivedToken);

  logger.info('Exchanging short-lived token for long-lived token');

  const response = await fetch(tokenUrl.toString());

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to exchange for long-lived token', {
      status: response.status,
      error: errorText
    });
    throw new Error(`Long-lived token exchange failed: ${response.status} ${errorText}`);
  }

  const tokenData = await response.json() as TokenResponse;

  logger.info('Successfully exchanged for long-lived token', {
    expires_in: tokenData.expires_in
  });

  return tokenData;
}

/**
 * Debug token to get metadata and validate
 */
export async function debugToken(accessToken: string): Promise<DebugTokenResponse['data']> {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('META_APP_ID and META_APP_SECRET must be configured');
  }

  // Get app access token for debugging
  const appTokenUrl = new URL(`https://graph.facebook.com/oauth/access_token`);
  appTokenUrl.searchParams.set('client_id', META_APP_ID);
  appTokenUrl.searchParams.set('client_secret', META_APP_SECRET);
  appTokenUrl.searchParams.set('grant_type', 'client_credentials');

  const appTokenResponse = await fetch(appTokenUrl.toString());
  const appTokenData = await appTokenResponse.json() as TokenResponse;

  // Debug the user token
  const debugUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/debug_token`);
  debugUrl.searchParams.set('input_token', accessToken);
  debugUrl.searchParams.set('access_token', appTokenData.access_token);

  logger.info('Debugging access token');

  const response = await fetch(debugUrl.toString());

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to debug token', {
      status: response.status,
      error: errorText
    });
    throw new Error(`Token debug failed: ${response.status} ${errorText}`);
  }

  const debugData = await response.json() as DebugTokenResponse;

  logger.info('Token debug successful', {
    valid: debugData.data.is_valid,
    scopes: debugData.data.scopes?.length
  });

  return debugData.data;
}

/**
 * Get user information
 */
export async function getUserInfo(accessToken: string): Promise<UserData> {
  const userUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/me`);
  userUrl.searchParams.set('fields', 'id,name,email');
  userUrl.searchParams.set('access_token', accessToken);

  logger.info('Fetching user information');

  const response = await fetch(userUrl.toString());

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch user info', {
      status: response.status,
      error: errorText
    });
    throw new Error(`Failed to fetch user info: ${response.status} ${errorText}`);
  }

  const userData = await response.json() as UserData;

  logger.info('User info fetched successfully', { userId: userData.id });

  return userData;
}

/**
 * Get user's ad accounts
 */
export async function getUserAdAccounts(accessToken: string, userId: string): Promise<AdAccountData[]> {
  const accountsUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/${userId}/adaccounts`);
  accountsUrl.searchParams.set('fields', 'id,account_id,name,currency,timezone_name,account_status');
  accountsUrl.searchParams.set('access_token', accessToken);

  logger.info('Fetching user ad accounts', { userId });

  const response = await fetch(accountsUrl.toString());

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch ad accounts', {
      status: response.status,
      error: errorText
    });
    throw new Error(`Failed to fetch ad accounts: ${response.status} ${errorText}`);
  }

  const accountsData = await response.json() as { data: AdAccountData[] };

  logger.info('Ad accounts fetched successfully', {
    count: accountsData.data.length
  });

  return accountsData.data;
}

interface PageData {
  id: string;
  name: string;
  access_token?: string;
}

/**
 * Get user's pages
 */
export async function getUserPages(accessToken: string, userId: string): Promise<PageData[]> {
  const pagesUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/${userId}/accounts`);
  pagesUrl.searchParams.set('fields', 'id,name,access_token');
  pagesUrl.searchParams.set('access_token', accessToken);

  logger.info('Fetching user pages', { userId });

  const response = await fetch(pagesUrl.toString());

  if (!response.ok) {
    const errorText = await response.text();
    logger.warn('Failed to fetch user pages', {
      status: response.status,
      error: errorText
    });
    return []; // Return empty array rather than failing the whole auth
  }

  const pagesData = await response.json() as { data: PageData[] };

  logger.info('User pages fetched successfully', {
    count: pagesData.data.length
  });

  return pagesData.data;
}

/**
 * Save Meta connection to database with encrypted token
 */
export async function saveMetaConnection(
  tenantId: string,
  accessToken: string,
  userId: string,
  userName: string,
  userEmail?: string,
  scopes?: string[]
): Promise<void> {
  logger.info('Saving Meta connection', { tenantId, userId });

  // Calculate token expiry (60 days for long-lived tokens)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);

  // Get ad accounts
  const adAccounts = await getUserAdAccounts(accessToken, userId);

  // Get first ad account ID (or use a specific one)
  const adAccountId = adAccounts.length > 0 ? adAccounts[0].account_id : 'none';

  // Save connection (token will be auto-encrypted by pre-save hook)
  await MetaConnectionModel.findOneAndUpdate(
    { tenantId, adAccountId },
    {
      tenantId,
      adAccountId,
      accessToken: accessToken, // Will be encrypted by pre-save hook
      tokenExpiresAt: expiresAt,
      permissions: scopes || META_REQUIRED_SCOPES,
      status: 'ACTIVE',
      lastSyncedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  logger.info('Meta connection saved successfully', {
    tenantId,
    userId,
    adAccountCount: adAccounts.length
  });
}

/**
 * Get decrypted access token for a tenant
 */
export async function getAccessToken(tenantId: string, adAccountId?: string): Promise<string> {
  const query: any = { tenantId, status: 'ACTIVE' };
  if (adAccountId) {
    query.adAccountId = adAccountId;
  }

  const connection = await MetaConnectionModel.findOne(query);

  if (!connection) {
    throw new Error(`No active Meta connection found for tenant: ${tenantId}`);
  }

  // Check if token is expired
  if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
    throw new Error('Access token has expired. User needs to re-authenticate.');
  }

  // Use the model's getAccessToken method (handles decryption)
  const accessToken = connection.getAccessToken();

  logger.info('Retrieved access token for tenant', { tenantId, adAccountId });

  return accessToken;
}

/**
 * Refresh connection - validates token and updates ad accounts
 */
export async function refreshConnection(tenantId: string, adAccountId?: string): Promise<void> {
  logger.info('Refreshing Meta connection', { tenantId, adAccountId });

  const accessToken = await getAccessToken(tenantId, adAccountId);

  // Validate token
  const debugData = await debugToken(accessToken);

  if (!debugData.is_valid) {
    throw new Error('Access token is no longer valid');
  }

  // Get updated ad accounts
  const adAccounts = await getUserAdAccounts(accessToken, debugData.user_id);

  // Update connection
  const query: any = { tenantId };
  if (adAccountId) {
    query.adAccountId = adAccountId;
  }

  await MetaConnectionModel.findOneAndUpdate(
    query,
    {
      lastSyncedAt: new Date(),
      status: 'ACTIVE',
    }
  );

  logger.info('Meta connection refreshed successfully', {
    tenantId,
    adAccountId,
    adAccountCount: adAccounts.length
  });
}

/**
 * Revoke connection - marks as inactive
 */
export async function revokeConnection(tenantId: string, adAccountId?: string): Promise<void> {
  logger.info('Revoking Meta connection', { tenantId, adAccountId });

  const query: any = { tenantId };
  if (adAccountId) {
    query.adAccountId = adAccountId;
  }

  await MetaConnectionModel.findOneAndUpdate(
    query,
    { status: 'REVOKED' }
  );

  logger.info('Meta connection revoked', { tenantId, adAccountId });
}
