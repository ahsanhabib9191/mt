# Meta API Credentials Setup Guide

This guide walks you through obtaining and configuring Meta/Facebook API credentials for the Meta Ads Optimization system.

## Prerequisites

- Facebook account
- Business Manager account (or ability to create one)
- Meta Developer account

## Step 1: Create a Meta App

1. **Go to Meta for Developers**
   - Visit: https://developers.facebook.com/apps
   - Click "Create App"

2. **Select App Type**
   - Choose "Business" as the app type
   - Click "Next"

3. **Configure App Details**
   - **Display Name**: `Meta Ads Optimizer` (or your preferred name)
   - **App Contact Email**: Your business email
   - **Business Account**: Select your Business Manager account
   - Click "Create App"

4. **Complete Security Check**
   - Verify CAPTCHA if prompted

## Step 2: Get App ID and App Secret

1. **Navigate to App Dashboard**
   - You'll see your **App ID** prominently displayed
   - Copy this value

2. **Get App Secret**
   - In the left sidebar, go to **Settings → Basic**
   - Find the **App Secret** field
   - Click "Show" and copy the secret
   - ⚠️ Keep this secret secure - never commit it to version control

## Step 3: Configure App Settings

### Add App Domain

1. Go to **Settings → Basic**
2. Scroll to **App Domains**
3. Add your domain(s):
   - Development: `localhost`
   - Production: `yourdomain.com`

### Set Privacy Policy URL (Required)

1. Scroll to **Privacy Policy URL**
2. Add your privacy policy URL (required for app review)

### Add Platform

1. Scroll to bottom, click **+ Add Platform**
2. Select **Website**
3. **Site URL**: 
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

## Step 4: Add Required Products

### Facebook Login

1. In left sidebar, find **Add Products**
2. Click **Set Up** on **Facebook Login**
3. Click **Settings** under Facebook Login
4. Configure **Valid OAuth Redirect URIs**:
   ```
   http://localhost:3000/api/auth/callback/facebook
   https://yourdomain.com/api/auth/callback/facebook
   ```
5. Save changes

### Marketing API

1. In **Add Products**, find **Marketing API**
2. Click **Set Up**
3. This enables access to ad accounts, campaigns, etc.

## Step 5: Request Permissions

Your app needs these permissions (scopes):

### Standard Access (No Review Required)
- `public_profile` - Basic profile info
- `email` - User's email address

### Advanced Access (Requires App Review)
- `ads_read` - Read ad account data
- `ads_management` - Create and manage ads
- `business_management` - Access Business Manager
- `pages_read_engagement` - Read page insights
- `pages_manage_ads` - Create page ads
- `leads_retrieval` - Access lead form data

**Note**: Start with standard access for development. Request advanced access when ready for production.

## Step 6: Configure Environment Variables

Add these to your `.env` file:

```bash
# Meta App Credentials
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here

# OAuth Configuration
META_REDIRECT_URI=http://localhost:3000/api/auth/callback/facebook

# Webhook Configuration (for real-time updates)
META_VERIFY_TOKEN=your_random_secure_token_here
META_APP_SECRET=your_app_secret_here

# Optional: Specific API Version
META_API_VERSION=v21.0
```

### Generate Webhook Verify Token

```bash
# Generate a random secure token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 7: Set Up Webhooks (Optional)

Webhooks enable real-time updates when campaigns, ads, or leads change.

1. **In App Dashboard**, go to **Products → Webhooks**
2. Click **Configure Webhooks** for your object (e.g., Page)
3. **Callback URL**: `https://yourdomain.com/api/webhooks/meta`
4. **Verify Token**: Use the token from your `.env` file
5. **Subscribe to Fields**:
   - `leadgen` - Lead form submissions
   - `feed` - Campaign updates
   - `ads_insights` - Performance updates

### Test Webhook Locally (Development)

Use ngrok or similar to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Expose port 3000
ngrok http 3000

# Use the ngrok URL in webhook configuration
# Example: https://abc123.ngrok.io/api/webhooks/meta
```

## Step 8: Get Test Ad Account

1. **Go to Business Manager**
   - Visit: https://business.facebook.com
   
2. **Create or Access Ad Account**
   - Go to **Business Settings → Accounts → Ad Accounts**
   - Create a new test ad account or use existing

3. **Get Ad Account ID**
   - Click on the ad account
   - Note the **Ad Account ID** (format: `act_123456789`)

4. **Grant App Access**
   - In Business Settings → Ad Accounts
   - Select your ad account
   - Click **Add Partner**
   - Add your app by App ID
   - Grant appropriate permissions

## Step 9: Generate Test Access Token (Development Only)

For quick testing during development:

1. **Go to Graph API Explorer**
   - Visit: https://developers.facebook.com/tools/explorer/
   
2. **Select Your App**
   - In the top-right, select your app from dropdown

3. **Generate Access Token**
   - Click **Generate Access Token**
   - Select required permissions
   - Authorize

4. **Test Token**
   - Use the token to make test API calls
   - ⚠️ This token is temporary (1-2 hours)
   - For production, use OAuth flow

## Step 10: Implement OAuth Flow

The proper way to get user tokens:

### Authorization URL

```
https://www.facebook.com/v21.0/dialog/oauth?
  client_id={app-id}
  &redirect_uri={redirect-uri}
  &scope={comma-separated-permissions}
  &state={csrf-token}
```

### Exchange Code for Token

```typescript
const response = await fetch(
  `https://graph.facebook.com/v21.0/oauth/access_token?` +
  `client_id=${APP_ID}` +
  `&redirect_uri=${REDIRECT_URI}` +
  `&client_secret=${APP_SECRET}` +
  `&code=${authCode}`
);

const { access_token } = await response.json();
```

### Example Implementation

See `docs/META_OAUTH_INTEGRATION.md` for complete implementation examples.

## Step 11: Test API Connection

Create a test script to verify credentials:

```typescript
// scripts/test-meta-connection.ts
import dotenv from 'dotenv';
dotenv.config();

async function testMetaAPI() {
  const { META_APP_ID, META_APP_SECRET } = process.env;
  
  // Get app access token
  const tokenResponse = await fetch(
    `https://graph.facebook.com/oauth/access_token?` +
    `client_id=${META_APP_ID}` +
    `&client_secret=${META_APP_SECRET}` +
    `&grant_type=client_credentials`
  );
  
  const { access_token } = await tokenResponse.json();
  
  // Test API call
  const apiResponse = await fetch(
    `https://graph.facebook.com/v21.0/${META_APP_ID}?` +
    `fields=name,category` +
    `&access_token=${access_token}`
  );
  
  const data = await apiResponse.json();
  console.log('✅ Meta API Connection Successful:', data);
}

testMetaAPI().catch(console.error);
```

Run the test:
```bash
ts-node scripts/test-meta-connection.ts
```

## Security Best Practices

### 1. Never Commit Credentials
```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.example" >> .gitignore
```

### 2. Use Environment Variables
```bash
# Run security scan
npm run security:scan
```

### 3. Encrypt Stored Tokens

When storing access tokens in database:
```typescript
import { encrypt } from './lib/utils/crypto';

const encryptedToken = await encrypt(accessToken);
// Store encryptedToken in MetaConnection model
```

### 4. Rotate Secrets Regularly
- Regenerate App Secret periodically
- Update environment variables
- Re-encrypt stored tokens

### 5. Use App-Level Permissions

Limit your app to only required permissions. Don't request:
- `manage_pages` if you only need to read
- `ads_management` if you only need to view

## Troubleshooting

### Error: Invalid OAuth Redirect URI

**Solution**: Ensure redirect URI in code matches exactly what's configured in app settings (including protocol, port, path).

### Error: Insufficient Permissions

**Solution**: 
1. Request required permissions in OAuth flow
2. User must grant permissions
3. For advanced permissions, submit app for review

### Error: Rate Limit Exceeded

**Solution**: 
- Implement rate limiting (see `lib/services/meta-sync/graph-client.ts`)
- Use batch requests to reduce API calls
- Cache responses in Redis

### Error: Token Expired

**Solution**:
- Implement token refresh logic
- Refresh tokens before they expire (5 min buffer)
- See `lib/services/meta-sync/graph-client.ts` for auto-refresh pattern

## Production Checklist

Before going live:

- [ ] App reviewed and approved by Meta
- [ ] All required permissions granted
- [ ] OAuth redirect URIs configured for production domain
- [ ] Webhook endpoints secured with signature verification
- [ ] Credentials stored securely (not in code)
- [ ] Token encryption implemented
- [ ] Rate limiting configured
- [ ] Error handling and retry logic implemented
- [ ] Monitoring and logging set up
- [ ] Privacy policy published and linked
- [ ] Terms of service published

## Resources

- [Meta for Developers](https://developers.facebook.com/)
- [Marketing API Documentation](https://developers.facebook.com/docs/marketing-apis)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [App Review Process](https://developers.facebook.com/docs/app-review)
- [Business Manager](https://business.facebook.com)

## Support

If you encounter issues:
1. Check Meta Developer Community: https://developers.facebook.com/community/
2. Review error codes: https://developers.facebook.com/docs/graph-api/using-graph-api/error-handling
3. Contact Meta Support through Business Help Center

---

**Next Steps**: Once credentials are configured, proceed to `docs/META_OAUTH_INTEGRATION.md` for implementing the OAuth flow in your application.
