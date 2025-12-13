import crypto from 'crypto';
import {
  MetaConnectionModel,
} from '../db/models/MetaConnection';
import {
  syncAdFromWebhook,
  syncAdSetFromWebhook,
  syncCampaignFromWebhook,
} from '../services/meta-sync/sync-service';
import logger from '../utils/logger';

export interface MetaWebhookPayload {
  object: string;
  entry?: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  changes?: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  field: 'ad' | 'adset' | 'campaign' | string;
  value: Record<string, any>;
}

const APP_SECRET = process.env.META_APP_SECRET;
const VERIFY_TOKEN = process.env.META_APP_VERIFY_TOKEN;

export function resolveMetaWebhookChallenge(query: Record<string, string | undefined>): string | null {
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === VERIFY_TOKEN) {
    return query['hub.challenge'] || null;
  }
  return null;
}

export function verifyMetaWebhookSignature(signature: string | null, rawBody: string): boolean {
  if (!APP_SECRET || !signature) {
    return false;
  }

  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha1' || !hash) {
    return false;
  }

  const expected = crypto.createHmac('sha1', APP_SECRET).update(rawBody).digest('hex');
  return hash === expected;
}

export async function handleMetaWebhook(body: MetaWebhookPayload): Promise<void> {
  if (!body.entry || body.entry.length === 0) {
    logger.warn('Meta webhook received without entry data');
    return;
  }

  // Process all entries in parallel using Promise.allSettled to prevent one failure from canceling others
  const entryResults = await Promise.allSettled(
    body.entry.map(async (entry) => {
      if (!entry.id || !entry.changes) {
        return;
      }

      const connection = await MetaConnectionModel.findOne({ adAccountId: entry.id }).exec();
      if (!connection) {
        logger.warn('Meta webhook received for unknown ad account', { adAccountId: entry.id });
        return;
      }

      // Process all changes for this entry in parallel with individual error handling
      const changeResults = await Promise.allSettled(
        entry.changes.map(async (change) => {
          if (change.field === 'campaign' && change.value?.id) {
            await syncCampaignFromWebhook(connection, change.value.id);
          } else if (change.field === 'adset' && change.value?.id) {
            await syncAdSetFromWebhook(connection, change.value.id);
          } else if (change.field === 'ad' && change.value?.id) {
            await syncAdFromWebhook(connection, change.value.id);
          }
        })
      );

      // Log any failed changes
      changeResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const change = entry.changes![index];
          logger.error('Failed to process Meta webhook change', {
            adAccountId: entry.id,
            change: change?.field,
            error: result.reason,
          });
        }
      });
    })
  );

  // Log any failed entries
  entryResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error('Failed to process Meta webhook entry', {
        entryIndex: index,
        error: result.reason,
      });
    }
  });
}
