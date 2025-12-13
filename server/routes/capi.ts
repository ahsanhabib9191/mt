import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../../lib/utils/logger';
import crypto from 'crypto';

const router = Router();

const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaApiResponse {
  data?: any[];
  error?: { message: string; code?: number };
  events_received?: number;
  messages?: string[];
  fbtrace_id?: string;
  event_match_quality?: number;
  [key: string]: any;
}

async function metaApiRequest(endpoint: string, accessToken: string, method: string = 'GET', body?: any): Promise<MetaApiResponse> {
  const url = `${META_API_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    if (method === 'GET') {
      const separator = url.includes('?') ? '&' : '?';
      const fullUrl = `${url}${separator}access_token=${accessToken}`;
      const response = await fetch(fullUrl, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null) as MetaApiResponse | null;
        return { error: { message: errorData?.error?.message || `HTTP ${response.status}`, code: response.status } };
      }
      return response.json() as Promise<MetaApiResponse>;
    } else {
      const separator = endpoint.includes('?') ? '&' : '?';
      const fullUrl = `${url}${separator}access_token=${accessToken}`;
      options.body = JSON.stringify(body);
      const response = await fetch(fullUrl, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null) as MetaApiResponse | null;
        return { error: { message: errorData?.error?.message || `HTTP ${response.status}`, code: response.status } };
      }
      return response.json() as Promise<MetaApiResponse>;
    }
  } catch (err) {
    return { error: { message: 'Network error connecting to Meta API' } };
  }
}

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

async function getValidatedConnection(tenantId: number, adAccountId: string) {
  const connection = await storage.getMetaConnection(Number(tenantId), adAccountId as string);
  if (!connection || connection.status !== 'ACTIVE') {
    return null;
  }
  return connection;
}

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, adAccountId, pixelId } = req.query;

    if (!tenantId || !adAccountId || !pixelId) {
      return res.status(400).json({ error: 'tenantId, adAccountId, and pixelId are required' });
    }

    const connection = await getValidatedConnection(Number(tenantId), adAccountId as string);
    if (!connection) {
      return res.status(404).json({ error: 'No active Meta connection found for this account' });
    }

    const pixelResponse = await metaApiRequest(
      `/${pixelId}?fields=id,name,is_unavailable,data_use_setting`,
      connection.accessToken
    );

    if (pixelResponse.error) {
      return res.status(400).json({ error: pixelResponse.error.message });
    }

    const now = Math.floor(Date.now() / 1000);
    const last24h = now - (24 * 60 * 60);

    const statsResponse = await metaApiRequest(
      `/${pixelId}/stats?start_time=${last24h}&end_time=${now}&aggregation=event`,
      connection.accessToken
    );

    let serverEvents = 0;
    let browserEvents = 0;

    if (statsResponse.data) {
      for (const event of statsResponse.data) {
        if (event.value) {
          const count = Number(event.value) || 0;
          if (event.data_source_type === 'SERVER') {
            serverEvents += count;
          } else {
            browserEvents += count;
          }
        }
      }
    }

    const capiStatus = serverEvents > 0 ? 'ACTIVE' : 'INACTIVE';
    const deduplicationRate = (serverEvents > 0 && browserEvents > 0)
      ? Math.round((Math.min(serverEvents, browserEvents) / Math.max(serverEvents, browserEvents)) * 100)
      : 0;

    res.json({
      data: {
        pixelId,
        pixelName: pixelResponse.name,
        capiStatus,
        serverEvents24h: serverEvents,
        browserEvents24h: browserEvents,
        deduplicationRate: `${deduplicationRate}%`,
        isPixelAvailable: !pixelResponse.is_unavailable,
        dataUseSetting: pixelResponse.data_use_setting,
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, adAccountId, pixelId, events, testEventCode } = req.body;

    if (!tenantId || !adAccountId || !pixelId || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'tenantId, adAccountId, pixelId, and events array are required' });
    }

    const connection = await getValidatedConnection(Number(tenantId), adAccountId as string);
    if (!connection) {
      return res.status(404).json({ error: 'No active Meta connection found for this account' });
    }

    const formattedEvents = events.map((event: any) => {
      const formattedEvent: any = {
        event_name: event.eventName || event.event_name,
        event_time: event.eventTime || event.event_time || Math.floor(Date.now() / 1000),
        action_source: event.actionSource || event.action_source || 'website',
        event_source_url: event.eventSourceUrl || event.event_source_url,
        user_data: {},
      };

      if (event.eventId || event.event_id) {
        formattedEvent.event_id = event.eventId || event.event_id;
      }

      const userData = event.userData || event.user_data || {};

      if (userData.email) {
        formattedEvent.user_data.em = [hashValue(userData.email)];
      }
      if (userData.phone) {
        const cleanPhone = userData.phone.replace(/\D/g, '');
        formattedEvent.user_data.ph = [hashValue(cleanPhone)];
      }
      if (userData.firstName) {
        formattedEvent.user_data.fn = [hashValue(userData.firstName)];
      }
      if (userData.lastName) {
        formattedEvent.user_data.ln = [hashValue(userData.lastName)];
      }
      if (userData.city) {
        formattedEvent.user_data.ct = [hashValue(userData.city.replace(/\s/g, ''))];
      }
      if (userData.state) {
        formattedEvent.user_data.st = [hashValue(userData.state.toLowerCase().trim())];
      }
      if (userData.zipCode) {
        formattedEvent.user_data.zp = [hashValue(userData.zipCode.replace(/\s/g, ''))];
      }
      if (userData.country) {
        formattedEvent.user_data.country = [userData.country.toLowerCase().trim()];
      }
      if (userData.externalId) {
        formattedEvent.user_data.external_id = [hashValue(userData.externalId)];
      }
      if (userData.gender) {
        formattedEvent.user_data.ge = [hashValue(userData.gender.charAt(0))];
      }
      if (userData.dateOfBirth) {
        formattedEvent.user_data.db = [hashValue(userData.dateOfBirth.replace(/\D/g, ''))];
      }
      if (userData.clientIpAddress) {
        formattedEvent.user_data.client_ip_address = userData.clientIpAddress;
      }
      if (userData.clientUserAgent) {
        formattedEvent.user_data.client_user_agent = userData.clientUserAgent;
      }
      if (userData.fbc) {
        formattedEvent.user_data.fbc = userData.fbc;
      }
      if (userData.fbp) {
        formattedEvent.user_data.fbp = userData.fbp;
      }

      if (event.customData || event.custom_data) {
        formattedEvent.custom_data = event.customData || event.custom_data;
      }

      return formattedEvent;
    });

    const payload: any = {
      data: formattedEvents,
      partner_agent: 'shothik-capi-1.0'
    };

    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

    const response = await metaApiRequest(
      `/${pixelId}/events`,
      connection.accessToken,
      'POST',
      payload
    );

    if (response.error) {
      logger.warn('CAPI error sending events', { pixelId, eventCount: events.length });
      return res.status(400).json({ error: response.error.message });
    }

    logger.info('CAPI events sent successfully', {
      pixelId,
      eventCount: events.length,
      eventsReceived: response.events_received
    });

    res.json({
      data: {
        success: true,
        eventsReceived: response.events_received,
        messages: response.messages || [],
        fbTraceId: response.fbtrace_id,
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/event-match-quality', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, adAccountId, pixelId } = req.query;

    if (!tenantId || !adAccountId || !pixelId) {
      return res.status(400).json({ error: 'tenantId, adAccountId, and pixelId are required' });
    }

    const connection = await getValidatedConnection(Number(tenantId), adAccountId as string);
    if (!connection) {
      return res.status(404).json({ error: 'No active Meta connection found for this account' });
    }

    const pixelResponse = await metaApiRequest(
      `/${pixelId}?fields=id,name,enable_automatic_matching,automatic_matching_fields`,
      connection.accessToken
    );

    if (pixelResponse.error) {
      return res.status(400).json({ error: pixelResponse.error.message });
    }

    const automaticMatchingEnabled = pixelResponse.enable_automatic_matching || false;
    const matchingFields = pixelResponse.automatic_matching_fields || [];

    let estimatedScore = 3;
    if (automaticMatchingEnabled) estimatedScore += 2;
    if (matchingFields.includes('em')) estimatedScore += 1;
    if (matchingFields.includes('ph')) estimatedScore += 1;
    if (matchingFields.includes('fn') && matchingFields.includes('ln')) estimatedScore += 1;
    if (matchingFields.includes('external_id')) estimatedScore += 1;
    if (matchingFields.includes('country')) estimatedScore += 1;
    estimatedScore = Math.min(estimatedScore, 10);

    const recommendations = [];

    if (!automaticMatchingEnabled) {
      recommendations.push('Enable Advanced Matching on your pixel to improve match quality');
    }
    if (!matchingFields.includes('em')) {
      recommendations.push('Include email (em) - hash with SHA-256 before sending');
    }
    if (!matchingFields.includes('ph')) {
      recommendations.push('Include phone number (ph) - hash with SHA-256 before sending');
    }
    if (!matchingFields.includes('external_id')) {
      recommendations.push('Include external_id to match users across devices');
    }
    recommendations.push('Always include fbc and fbp cookies from the browser');
    recommendations.push('Include client_ip_address and client_user_agent for better matching');

    res.json({
      data: {
        pixelId,
        pixelName: pixelResponse.name,
        automaticMatchingEnabled,
        automaticMatchingFields: matchingFields,
        estimatedMatchQuality: `${estimatedScore}/10`,
        note: 'Event Match Quality score is available in Events Manager after sending events',
        recommendations,
        parameters: {
          required: ['event_name', 'event_time', 'user_data', 'action_source'],
          hashRequired: ['email (em)', 'phone (ph)', 'first_name (fn)', 'last_name (ln)', 'city (ct)', 'state (st)', 'zip (zp)', 'external_id', 'gender (ge)', 'date_of_birth (db)'],
          noHash: ['country (2-letter ISO code)', 'client_ip_address', 'client_user_agent', 'fbc', 'fbp'],
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/test-event', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, adAccountId, pixelId, testEventCode, eventName, userData } = req.body;

    if (!tenantId || !adAccountId || !pixelId || !testEventCode) {
      return res.status(400).json({ error: 'tenantId, adAccountId, pixelId, and testEventCode are required' });
    }

    const connection = await getValidatedConnection(Number(tenantId), adAccountId as string);
    if (!connection) {
      return res.status(404).json({ error: 'No active Meta connection found for this account' });
    }

    const testEvent: any = {
      event_name: eventName || 'TestEvent',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: 'https://test.example.com',
      event_id: `test_${Date.now()}`,
      user_data: {
        client_ip_address: '0.0.0.0',
        client_user_agent: 'Mozilla/5.0 (Test)',
      },
    };

    if (userData?.email) {
      testEvent.user_data.em = [hashValue(userData.email)];
    }
    if (userData?.phone) {
      testEvent.user_data.ph = [hashValue(userData.phone.replace(/\D/g, ''))];
    }

    const payload = {
      data: [testEvent],
      test_event_code: testEventCode,
      partner_agent: 'shothik-capi-1.0'
    };

    const response = await metaApiRequest(
      `/${pixelId}/events`,
      connection.accessToken,
      'POST',
      payload
    );

    if (response.error) {
      logger.warn('CAPI test event error', { pixelId, testEventCode });
      return res.status(400).json({ error: response.error.message });
    }

    logger.info('CAPI test event sent', { pixelId, testEventCode });

    res.json({
      data: {
        success: true,
        message: 'Test event sent successfully. Check Events Manager to verify.',
        eventsReceived: response.events_received,
        testEventCode,
        eventId: testEvent.event_id,
        instructions: [
          '1. Go to Facebook Events Manager',
          '2. Select your pixel',
          '3. Click "Test Events" tab',
          `4. Your test event with code "${testEventCode}" should appear`,
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/diagnostics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, adAccountId, pixelId } = req.query;

    if (!tenantId || !adAccountId || !pixelId) {
      return res.status(400).json({ error: 'tenantId, adAccountId, and pixelId are required' });
    }

    const connection = await getValidatedConnection(Number(tenantId), adAccountId as string);
    if (!connection) {
      return res.status(404).json({ error: 'No active Meta connection found for this account' });
    }

    const pixelResponse = await metaApiRequest(
      `/${pixelId}?fields=id,name,is_unavailable,data_use_setting,first_party_cookie_status,automatic_matching_fields,enable_automatic_matching`,
      connection.accessToken
    );

    if (pixelResponse.error) {
      return res.status(400).json({ error: pixelResponse.error.message });
    }

    const now = Math.floor(Date.now() / 1000);
    const last24h = now - (24 * 60 * 60);
    const last7Days = now - (7 * 24 * 60 * 60);

    const [stats24h, stats7d] = await Promise.all([
      metaApiRequest(
        `/${pixelId}/stats?start_time=${last24h}&end_time=${now}&aggregation=event`,
        connection.accessToken
      ),
      metaApiRequest(
        `/${pixelId}/stats?start_time=${last7Days}&end_time=${now}&aggregation=event`,
        connection.accessToken
      ),
    ]);

    let serverEvents24h = 0;
    let browserEvents24h = 0;
    let serverEvents7d = 0;
    let browserEvents7d = 0;

    if (stats24h.data) {
      for (const event of stats24h.data) {
        const count = Number(event.value) || 0;
        if (event.data_source_type === 'SERVER') {
          serverEvents24h += count;
        } else {
          browserEvents24h += count;
        }
      }
    }

    if (stats7d.data) {
      for (const event of stats7d.data) {
        const count = Number(event.value) || 0;
        if (event.data_source_type === 'SERVER') {
          serverEvents7d += count;
        } else {
          browserEvents7d += count;
        }
      }
    }

    const issues = [];
    const recommendations = [];

    if (serverEvents24h === 0) {
      issues.push({
        severity: 'HIGH',
        issue: 'No server events received in last 24 hours',
        recommendation: 'Check your CAPI integration and ensure events are being sent',
      });
    }

    if (browserEvents24h > 0 && serverEvents24h === 0) {
      issues.push({
        severity: 'MEDIUM',
        issue: 'Browser pixel is firing but no CAPI events',
        recommendation: 'Implement Conversions API to improve event reliability and iOS 14+ tracking',
      });
    }

    if (serverEvents24h > 0 && browserEvents24h > 0) {
      const matchRate = Math.min(serverEvents24h, browserEvents24h) / Math.max(serverEvents24h, browserEvents24h);
      if (matchRate < 0.8) {
        issues.push({
          severity: 'MEDIUM',
          issue: 'Low deduplication rate between browser and server events',
          recommendation: 'Ensure you are sending matching event_id for both browser and server events',
        });
      }
    }

    if (!pixelResponse.enable_automatic_matching) {
      recommendations.push('Enable Advanced Matching to improve conversion tracking');
    }

    res.json({
      data: {
        pixelId,
        pixelName: pixelResponse.name,
        status: {
          isAvailable: !pixelResponse.is_unavailable,
          dataUseSetting: pixelResponse.data_use_setting,
          firstPartyCookieStatus: pixelResponse.first_party_cookie_status,
          automaticMatchingEnabled: pixelResponse.enable_automatic_matching,
          automaticMatchingFields: pixelResponse.automatic_matching_fields || [],
        },
        metrics: {
          last24Hours: {
            serverEvents: serverEvents24h,
            browserEvents: browserEvents24h,
            total: serverEvents24h + browserEvents24h,
          },
          last7Days: {
            serverEvents: serverEvents7d,
            browserEvents: browserEvents7d,
            total: serverEvents7d + browserEvents7d,
          },
        },
        issues,
        recommendations,
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
