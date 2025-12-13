import logger from '../../utils/logger';

const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface CampaignCreateParams {
  adAccountId: string;
  accessToken: string;
  name: string;
  objective: string;
  status: string;
  specialAdCategories?: string[];
}

interface AdSetCreateParams {
  adAccountId: string;
  accessToken: string;
  campaignId: string;
  name: string;
  dailyBudget: number;
  startTime?: Date;
  endTime?: Date;
  targeting: {
    ageMin: number;
    ageMax: number;
    genders?: number[];
    geoLocations: {
      countries: string[];
    };
    interests?: Array<{ id: string; name: string }>;
  };
  optimizationGoal: string;
  billingEvent: string;
  status: string;
}

interface AdCreativeParams {
  adAccountId: string;
  accessToken: string;
  name: string;
  pageId: string;
  imageHash?: string;
  imageUrl?: string;
  headline: string;
  primaryText: string;
  description?: string;
  callToAction: string;
  linkUrl: string;
}

interface AdCreateParams {
  adAccountId: string;
  accessToken: string;
  adSetId: string;
  creativeId: string;
  name: string;
  status: string;
}

interface MetaAPIErrorPayload {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

export class MetaGraphError extends Error {
  code: number;
  subcode?: number;
  fbtrace_id?: string;

  constructor(message: string, code: number, subcode?: number, fbtrace_id?: string) {
    super(message);
    this.name = 'MetaGraphError';
    this.code = code;
    this.subcode = subcode;
    this.fbtrace_id = fbtrace_id;
  }
}

async function makeGraphRequest<T>(
  url: string,
  method: 'GET' | 'POST',
  accessToken: string,
  body?: Record<string, any>
): Promise<T> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method === 'POST') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || (data as MetaAPIErrorPayload).error) {
    const error = (data as MetaAPIErrorPayload).error;
    logger.error('Meta Graph API error', {
      code: error?.code,
      subcode: error?.error_subcode,
      message: error?.message,
      fbtrace_id: error?.fbtrace_id
    });
    throw new MetaGraphError(
      error?.message || 'Meta API request failed',
      error?.code || 0,
      error?.error_subcode,
      error?.fbtrace_id
    );
  }

  return data as T;
}

export async function createCampaign(params: CampaignCreateParams): Promise<{ id: string }> {
  const { adAccountId, accessToken, name, objective, status, specialAdCategories } = params;

  const url = `${GRAPH_BASE_URL}/act_${adAccountId}/campaigns`;

  const body = {
    name,
    objective,
    status,
    special_ad_categories: specialAdCategories || [],
  };

  logger.info('Creating Meta campaign', { adAccountId, name, objective });

  const result = await makeGraphRequest<{ id: string }>(url, 'POST', accessToken, body);

  logger.info('Campaign created successfully', { campaignId: result.id });

  return result;
}

export async function createAdSet(params: AdSetCreateParams): Promise<{ id: string }> {
  const {
    adAccountId,
    accessToken,
    campaignId,
    name,
    dailyBudget,
    startTime,
    endTime,
    targeting,
    optimizationGoal,
    billingEvent,
    status
  } = params;

  const url = `${GRAPH_BASE_URL}/act_${adAccountId}/adsets`;

  const metaTargeting: Record<string, any> = {
    age_min: targeting.ageMin,
    age_max: targeting.ageMax,
    geo_locations: targeting.geoLocations,
  };

  if (targeting.genders && targeting.genders.length > 0) {
    metaTargeting.genders = targeting.genders;
  }

  if (targeting.interests && targeting.interests.length > 0) {
    metaTargeting.flexible_spec = [{
      interests: targeting.interests.map(i => ({ id: i.id, name: i.name }))
    }];
  }

  const body: Record<string, any> = {
    campaign_id: campaignId,
    name,
    daily_budget: Math.round(dailyBudget * 100),
    targeting: metaTargeting,
    optimization_goal: optimizationGoal,
    billing_event: billingEvent,
    status,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting_automation: {
      advantage_audience: 0,
    },
  };

  if (startTime) {
    body.start_time = startTime.toISOString();
  }

  if (endTime) {
    body.end_time = endTime.toISOString();
  }

  logger.info('Creating Meta ad set', { adAccountId, campaignId, name, dailyBudget });

  const result = await makeGraphRequest<{ id: string }>(url, 'POST', accessToken, body);

  logger.info('Ad set created successfully', { adSetId: result.id });

  return result;
}

export async function uploadImageFromUrl(
  adAccountId: string,
  accessToken: string,
  imageUrl: string
): Promise<{ hash: string }> {
  const url = `${GRAPH_BASE_URL}/act_${adAccountId}/adimages`;

  const body = {
    url: imageUrl,
  };

  logger.info('Uploading image to Meta', { adAccountId, imageUrl: imageUrl.slice(0, 50) });

  const result = await makeGraphRequest<{ images: Record<string, { hash: string }> }>(
    url,
    'POST',
    accessToken,
    body
  );

  const imageData = Object.values(result.images)[0];

  logger.info('Image uploaded successfully', { hash: imageData.hash });

  return { hash: imageData.hash };
}

export async function createAdCreative(params: AdCreativeParams): Promise<{ id: string }> {
  const {
    adAccountId,
    accessToken,
    name,
    pageId,
    imageHash,
    imageUrl,
    headline,
    primaryText,
    description,
    callToAction,
    linkUrl
  } = params;

  const url = `${GRAPH_BASE_URL}/act_${adAccountId}/adcreatives`;

  const ctaMap: Record<string, string> = {
    'Learn More': 'LEARN_MORE',
    'Shop Now': 'SHOP_NOW',
    'Sign Up': 'SIGN_UP',
    'Get Offer': 'GET_OFFER',
    'Book Now': 'BOOK_NOW',
    'Contact Us': 'CONTACT_US',
    'Download': 'DOWNLOAD',
    'Subscribe': 'SUBSCRIBE',
  };

  const linkData: Record<string, any> = {
    link: linkUrl,
    message: primaryText,
    name: headline,
    description: description || '',
    call_to_action: {
      type: ctaMap[callToAction] || 'LEARN_MORE',
      value: {
        link: linkUrl,
      },
    },
  };

  if (imageHash) {
    linkData.image_hash = imageHash;
  } else if (imageUrl) {
    linkData.picture = imageUrl;
  }

  const body = {
    name,
    object_story_spec: {
      page_id: pageId,
      link_data: linkData,
    },
  };

  logger.info('Creating ad creative', { adAccountId, name, pageId, hasImageHash: !!imageHash, hasImageUrl: !!imageUrl });

  const result = await makeGraphRequest<{ id: string }>(url, 'POST', accessToken, body);

  logger.info('Ad creative created successfully', { creativeId: result.id });

  return result;
}

export async function createAd(params: AdCreateParams): Promise<{ id: string }> {
  const { adAccountId, accessToken, adSetId, creativeId, name, status } = params;

  const url = `${GRAPH_BASE_URL}/act_${adAccountId}/ads`;

  const body = {
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    name,
    status,
  };

  logger.info('Creating ad', { adAccountId, adSetId, name });

  const result = await makeGraphRequest<{ id: string }>(url, 'POST', accessToken, body);

  logger.info('Ad created successfully', { adId: result.id });

  return result;
}

export async function getReachEstimate(
  adAccountId: string,
  accessToken: string,
  targeting: {
    ageMin: number;
    ageMax: number;
    genders?: number[];
    countries: string[];
    interests?: Array<{ id: string; name: string }>;
  }
): Promise<{ users_lower_bound: number; users_upper_bound: number }> {
  const url = new URL(`${GRAPH_BASE_URL}/act_${adAccountId}/reachestimate`);

  const targetingSpec: Record<string, any> = {
    age_min: targeting.ageMin,
    age_max: targeting.ageMax,
    geo_locations: {
      countries: targeting.countries,
    },
  };

  if (targeting.genders && targeting.genders.length > 0) {
    targetingSpec.genders = targeting.genders;
  }

  if (targeting.interests && targeting.interests.length > 0) {
    targetingSpec.flexible_spec = [{
      interests: targeting.interests
    }];
  }

  url.searchParams.set('targeting_spec', JSON.stringify(targetingSpec));
  url.searchParams.set('access_token', accessToken);

  logger.info('Getting reach estimate', { adAccountId });

  const response = await fetch(url.toString());
  const data = await response.json() as { data?: { users_lower_bound: number; users_upper_bound: number }; error?: { message: string } };

  if (!response.ok || data.error) {
    logger.warn('Reach estimate failed, using fallback', { error: data.error?.message });
    return {
      users_lower_bound: 50000,
      users_upper_bound: 500000,
    };
  }

  return data.data || { users_lower_bound: 50000, users_upper_bound: 500000 };
}

export interface BoostCampaignResult {
  success: boolean;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  error?: string;
  errorCode?: MetaErrorCode;
  retryable?: boolean;
  campaignUrl?: string;
}

export type MetaErrorCode =
  | 'TOKEN_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'INVALID_PARAMETER'
  | 'POLICY_VIOLATION'
  | 'ACCOUNT_DISABLED'
  | 'UNKNOWN_ERROR';

interface CategorizedError {
  errorCode: MetaErrorCode;
  retryable: boolean;
}

function categorizeMetaError(error: Error | MetaGraphError): CategorizedError {
  const message = error.message.toLowerCase();
  const code = error instanceof MetaGraphError ? error.code : undefined;

  if (code === 190 || message.includes('token') || message.includes('expired') || message.includes('session')) {
    return { errorCode: 'TOKEN_EXPIRED', retryable: true };
  }
  if (code === 10 || code === 200 || message.includes('permission')) {
    return { errorCode: 'PERMISSION_DENIED', retryable: false };
  }
  if (code === 17 || code === 4 || message.includes('rate limit') || message.includes('too many')) {
    return { errorCode: 'RATE_LIMITED', retryable: true };
  }
  if (code === 100 || message.includes('invalid parameter')) {
    return { errorCode: 'INVALID_PARAMETER', retryable: false };
  }
  if (message.includes('policy') || message.includes('disapproved') || message.includes('violation')) {
    return { errorCode: 'POLICY_VIOLATION', retryable: false };
  }
  if (code === 1487920 || message.includes('disabled') || message.includes('closed')) {
    return { errorCode: 'ACCOUNT_DISABLED', retryable: false };
  }
  return { errorCode: 'UNKNOWN_ERROR', retryable: false };
}

export async function createBoostCampaign(params: {
  adAccountId: string;
  accessToken: string;
  pageId: string;
  name: string;
  headline: string;
  primaryText: string;
  description?: string;
  imageUrl: string;
  callToAction: string;
  linkUrl: string;
  dailyBudget: number;
  duration: number;
  targeting: {
    ageMin: number;
    ageMax: number;
    gender: string;
    countries: string[];
    interests?: string[];
  };
}): Promise<BoostCampaignResult> {
  try {
    const {
      adAccountId,
      accessToken,
      pageId,
      name,
      headline,
      primaryText,
      description,
      imageUrl,
      callToAction,
      linkUrl,
      dailyBudget,
      duration,
      targeting
    } = params;

    const campaign = await createCampaign({
      adAccountId,
      accessToken,
      name: `Boost: ${name}`,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      specialAdCategories: [],
    });

    let imageHash: string | undefined;
    try {
      if (imageUrl && imageUrl.startsWith('http')) {
        const uploadResult = await uploadImageFromUrl(adAccountId, accessToken, imageUrl);
        imageHash = uploadResult.hash;
      }
    } catch (imgError) {
      logger.warn('Image upload failed, will use picture URL fallback', { error: imgError });
    }

    const genders = targeting.gender === 'female' ? [1] : targeting.gender === 'male' ? [2] : undefined;

    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + duration);

    const adSet = await createAdSet({
      adAccountId,
      accessToken,
      campaignId: campaign.id,
      name: `Boost AdSet: ${name}`,
      dailyBudget,
      startTime,
      endTime,
      targeting: {
        ageMin: targeting.ageMin,
        ageMax: targeting.ageMax,
        genders,
        geoLocations: { countries: targeting.countries },
      },
      optimizationGoal: 'LINK_CLICKS',
      billingEvent: 'IMPRESSIONS',
      status: 'PAUSED',
    });

    const creative = await createAdCreative({
      adAccountId,
      accessToken,
      name: `Boost Creative: ${name}`,
      pageId,
      imageHash,
      imageUrl: !imageHash ? imageUrl : undefined,
      headline,
      primaryText,
      description,
      callToAction,
      linkUrl,
    });

    const ad = await createAd({
      adAccountId,
      accessToken,
      adSetId: adSet.id,
      creativeId: creative.id,
      name: `Boost Ad: ${name}`,
      status: 'PAUSED',
    });

    logger.info('Boost campaign created successfully', {
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
    });

    return {
      success: true,
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
      campaignUrl: `https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}&selected_campaign_ids=${campaign.id}`,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error occurred');
    const { errorCode, retryable } = categorizeMetaError(err);

    logger.error('Failed to create boost campaign', {
      error: err.message,
      errorCode,
      retryable,
      metaCode: error instanceof MetaGraphError ? error.code : undefined
    });

    return {
      success: false,
      error: err.message,
      errorCode,
      retryable,
    };
  }
}
