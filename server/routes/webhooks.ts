import { Router, Request, Response, NextFunction } from 'express';
import { resolveMetaWebhookChallenge, verifyMetaWebhookSignature, handleMetaWebhook } from '../../lib/webhooks/meta';
import { logger } from '../../lib/utils/logger';

const router = Router();

router.get('/meta', (req: Request, res: Response) => {
  const challenge = resolveMetaWebhookChallenge(req.query as Record<string, string>);
  
  if (challenge) {
    logger.info('Meta webhook challenge verified');
    return res.send(challenge);
  }

  return res.status(400).send('Invalid webhook verification request');
});

router.post('/meta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-hub-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifyMetaWebhookSignature(signature, rawBody)) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    await handleMetaWebhook(req.body);

    res.json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error', { error });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
