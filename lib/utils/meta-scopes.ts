// Meta API Scopes aligned with v21.0
export const META_REQUIRED_SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_read_engagement'
] as const;

export const META_OPTIONAL_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'leads_retrieval'
] as const;

export const META_ALL_SCOPES = [...META_REQUIRED_SCOPES, ...META_OPTIONAL_SCOPES] as const;

export const CAMPAIGN_MANAGEMENT_SCOPES = [
  'ads_management',
  'business_management'
] as const;

export const INSIGHTS_SCOPES = [
  'ads_read',
  'pages_read_engagement'
] as const;

export const PIXEL_SCOPES = [
  'business_management'
] as const;

export const CREATIVE_SCOPES = [
  'ads_management'
] as const;

export function validateScopes(grantedScopes: string[]): { valid: boolean; missing: string[] } {
  const missing = META_REQUIRED_SCOPES.filter((s) => !grantedScopes.includes(s));
  return { valid: missing.length === 0, missing };
}

export function getScopeDescription(scope: string): string {
  const desc: Record<string, string> = {
    ads_management: 'Create and manage ads and campaigns',
    ads_read: 'Read ads performance and insights',
    business_management: 'Manage business assets and permissions',
    pages_read_engagement: 'Read engagement metrics for pages',
    instagram_basic: 'Read basic Instagram account info',
    instagram_content_publish: 'Publish content to Instagram',
    leads_retrieval: 'Retrieve leads generated from ads'
  };
  return desc[scope] || 'Unknown scope';
}

export function generateAuthUrl(appId: string, redirectUri: string, state: string): string {
  const scopes = META_ALL_SCOPES.join(',');
  const base = 'https://www.facebook.com/v21.0/dialog/oauth';
  const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, scope: scopes });
  return `${base}?${params.toString()}`;
}

export function hasScope(grantedScopes: string[], requiredScope: string): boolean {
  return grantedScopes.includes(requiredScope);
}
