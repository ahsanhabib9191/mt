import { Router, Request, Response, NextFunction } from 'express';
import { generateAuthorizationUrl, exchangeCodeForToken, getUserAdAccounts, getUserInfo, getUserPages } from '../../lib/services/meta-oauth/oauth-service';
import { logger } from '../../lib/utils/logger';
import { MetaConnectionModel, MetaConnection } from '../../lib/db/models/MetaConnection';
import { TenantModel, Tenant } from '../../lib/db/models/Tenant';
import crypto from 'crypto';

const router = Router();

router.get('/meta/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const state = crypto.randomBytes(32).toString('hex');

    const authUrl = generateAuthorizationUrl(state);

    res.json({
      authUrl,
      state,
      message: 'Redirect user to authUrl to connect their Meta account'
    });
  } catch (error) {
    next(error);
  }
});

// GET handler - Facebook redirects here, then we redirect to frontend
router.get('/meta/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Build the frontend callback URL with all params
    // TODO: Move this to an environment variable FRONTEND_URL
    const isLocal = req.get('host')?.includes('localhost') || req.get('host')?.includes('127.0.0.1');
    const protocol = isLocal ? 'http' : 'https';
    // If we are local, assume frontend is on port 5173 (standard Vite), otherwise assume same host
    // Previous code assumed 5001, but the user is running on 5173.
    const frontendHost = isLocal ? 'localhost:5173' : req.get('host');

    const frontendCallbackUrl = new URL('/oauth-callback', `${protocol}://${frontendHost}`);

    if (error) {
      frontendCallbackUrl.searchParams.set('error', error as string);
      if (error_description) {
        frontendCallbackUrl.searchParams.set('error_description', error_description as string);
      }
    } else if (code) {
      frontendCallbackUrl.searchParams.set('code', code as string);
      if (state) {
        frontendCallbackUrl.searchParams.set('state', state as string);
      }
    }

    res.redirect(frontendCallbackUrl.toString());
  } catch (error) {
    next(error);
  }
});

// POST handler - Frontend calls this to exchange code for token
router.post('/meta/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, tenantId, adAccountId } = req.body;

    if (!code || !tenantId) {
      return res.status(400).json({ error: 'code and tenantId are required' });
    }

    const tenantIdStr = String(tenantId);

    // DEMO MODE: If we are running without real credentials, mock the connection
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
      logger.warn('Running in DEMO MODE: Mocking Meta connection');

      const demoAccountId = 'act_123456789';

      // Check if we already have this connection to avoid duplicates
      let connection = await MetaConnection.findByTenantAndAccount(tenantIdStr, demoAccountId);

      if (!connection) {
        // Create a dummy connection
        connection = await MetaConnection.create({
          tenantId: tenantIdStr,
          adAccountId: demoAccountId,
          accessToken: 'mock_access_token_' + Date.now(),
          refreshToken: undefined,
          status: 'ACTIVE',
          permissions: ['ads_management', 'ads_read'],
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          lastSyncedAt: new Date()
        });
      }

      return res.json({
        data: {
          connectionId: connection._id,
          adAccountId: demoAccountId,
          adAccountIdPrefixed: demoAccountId,
          adAccountName: 'Demo Ad Account (Simulated)',
          availableAccounts: [{
            id: demoAccountId,
            account_id: '123456789',
            name: 'Demo Ad Account (Simulated)',
            currency: 'USD',
            timezone_name: 'America/Los_Angeles',
            account_status: 1
          }],
        },
        message: 'Meta account connected successfully (DEMO)'
      });
    }

    const tokenResponse = await exchangeCodeForToken(code);

    const userInfo = await getUserInfo(tokenResponse.access_token);
    const adAccounts = await getUserAdAccounts(tokenResponse.access_token, userInfo.id);

    if (adAccounts.length === 0) {
      return res.status(400).json({ error: 'No ad accounts found for this user' });
    }

    const selectedAccount = adAccountId
      ? adAccounts.find(a => a.account_id === adAccountId || a.id === adAccountId) || adAccounts[0]
      : adAccounts[0];

    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const pages = await getUserPages(tokenResponse.access_token, userInfo.id);
    const defaultPageId = pages.length > 0 ? pages[0].id : undefined;
    const pageName = pages.length > 0 ? pages[0].name : undefined;

    const connection = await MetaConnection.create({
      tenantId: tenantIdStr,
      adAccountId: selectedAccount.account_id,
      accessToken: tokenResponse.access_token,
      refreshToken: undefined,
      status: 'ACTIVE',
      permissions: [],
      tokenExpiresAt: expiresAt,
      pages: pages,
      metadata: {
        defaultPageId,
        pageName
      }
    });

    logger.info('Meta connection created', {
      tenantId: tenantIdStr,
      adAccountId: selectedAccount.account_id
    });

    res.json({
      data: {
        connectionId: connection._id,
        adAccountId: selectedAccount.account_id,
        adAccountIdPrefixed: selectedAccount.id,
        adAccountName: selectedAccount.name,
        availableAccounts: adAccounts,
      },
      message: 'Meta account connected successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/meta/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken } = req.query;

    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken is required' });
    }

    const userInfo = await getUserInfo(accessToken as string);
    const adAccounts = await getUserAdAccounts(accessToken as string, userInfo.id);

    res.json({ data: adAccounts });
  } catch (error) {
    next(error);
  }
});

router.get('/connections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const connections = await MetaConnectionModel.find({ tenantId: String(tenantId) }).sort({ createdAt: -1 });

    const safeConnections = connections.map(c => ({
      id: c._id,
      tenantId: c.tenantId,
      adAccountId: c.adAccountId,
      status: c.status,
      permissions: c.permissions,
      tokenExpiresAt: c.tokenExpiresAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    res.json({ data: safeConnections });
  } catch (error) {
    next(error);
  }
});

router.delete('/connections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Note: We use findOneAndUpdate instead of storage.updateMetaConnection
    const connection = await MetaConnectionModel.findByIdAndUpdate(
      req.params.id,
      { status: 'REVOKED' },
      { new: true }
    );

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    logger.info('Meta connection revoked', { connectionId: req.params.id });
    res.json({ message: 'Connection revoked successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/tenant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, tenantId } = req.body;

    if (!name || (!email && !tenantId)) {
      return res.status(400).json({ error: 'name and (email or tenantId) are required' });
    }

    // Ensure we have a tenantId (either provided or from email)
    const tid = tenantId || email;

    const existingTenant = await Tenant.findByTenantId(tid);
    if (existingTenant) {
      return res.status(409).json({ error: 'Tenant with this ID/email already exists' });
    }

    const tenant = await Tenant.create({
      tenantId: tid,
      name,
      plan: 'FREE',
      // If email was provided as ID, we might want to store it in settings or schema if available, 
      // but the Schema primarily requires tenantId and name.
      primaryDomain: email // Using email as domain/identifier if needed
    });

    logger.info('Tenant created', { tenantId: tenant.tenantId });
    res.status(201).json({ data: tenant });
  } catch (error) {
    next(error);
  }
});

router.get('/tenant/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await Tenant.findByTenantId(req.params.id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ data: tenant });
  } catch (error) {
    next(error);
  }
});

export default router;
