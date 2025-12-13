# Security Best Practices for Meta Ads Optimization Repository

## Overview

This document outlines security practices for the Meta Ads Optimization repository. All contributors must follow these guidelines to maintain the security and integrity of the codebase.

## Secrets Management

### What Are Secrets?

Secrets include:
- API keys and tokens (Meta API, OpenAI, etc.)
- Database credentials
- Encryption keys
- JWT signing secrets
- OAuth client secrets
- Private keys and certificates

### Never Commit Secrets

**CRITICAL**: Never commit secrets to the repository, even in feature branches or old commits.

✅ **Correct**:
```typescript
const mongoUri = process.env.MONGODB_URI;
const apiKey = process.env.META_API_KEY;
```

❌ **Incorrect**:
```typescript
const mongoUri = "mongodb://username:password@localhost:27017/meta";
const apiKey = "sk-1234567890abcdef";
```

### Environment Variables

- Store all secrets in `.env` files (excluded by `.gitignore`)
- Document all required environment variables in `.env.example` with placeholder values
- Use descriptive names for environment variables (e.g., `ENCRYPTION_KEY`, not `KEY`)
- Set environment variables in GitHub Actions using repository secrets

### Encryption at Rest

Sensitive data must be encrypted before storing in the database:

```typescript
import { encrypt, decrypt } from './lib/utils/crypto';

// Encrypting sensitive data
const encryptedToken = encrypt(plainTextToken);

// Storing in database
await MetaConnection.create({
  accessToken: encryptedToken,
  // ... other fields
});

// Retrieving and decrypting
const connection = await MetaConnection.findById(id);
const plainToken = decrypt(connection.accessToken);
```

**Always encrypt**:
- OAuth access tokens and refresh tokens
- API keys
- User credentials (after hashing passwords)
- PII when required by regulations

## Input Validation

All user inputs must be validated to prevent injection attacks and data corruption.

### Use Zod Schemas

```typescript
import { z } from 'zod';

const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  budget: z.number().positive(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
});

// Validate input
const validated = campaignSchema.parse(userInput);
```

### Sanitize Database Queries

- Use Mongoose query builders (automatically sanitizes)
- Never concatenate user input into queries
- Use parameterized queries for raw operations

## Authentication & Authorization

### JWT Token Security

- Set reasonable token expiry times (1-24 hours for access tokens)
- Use secure signing algorithms (HS256 or RS256)
- Include essential claims only (userId, tenantId, role)
- Never include sensitive data in JWT payload
- Store JWT secret in environment variables

### Middleware Usage

Always use authentication middleware for protected routes:

```typescript
import { authenticateToken } from './lib/middleware/auth';

// Apply to protected routes
app.get('/api/campaigns', authenticateToken, getCampaigns);
```

### Rate Limiting

Apply rate limiting to prevent abuse:

```typescript
import { rateLimiter } from './lib/middleware/rate-limit';

// Apply to API routes
app.use('/api/', rateLimiter);
```

## Logging Security

### What Not to Log

Never log:
- Passwords or password hashes
- API keys or tokens
- Encryption keys
- Full credit card numbers
- Social security numbers
- Full JWT tokens

### Structured Logging

Use the Winston logger with appropriate context:

```typescript
import logger from './lib/utils/logger';

// Good - includes context, no sensitive data
logger.info('User authenticated', {
  userId: user.id,
  tenantId: user.tenantId,
  timestamp: new Date(),
});

// Bad - includes sensitive data
logger.info('User token', { token: user.accessToken }); // ❌
```

### Error Messages

Avoid leaking system details in error messages:

✅ **Correct**:
```typescript
res.status(401).json({ error: 'Invalid credentials' });
```

❌ **Incorrect**:
```typescript
res.status(401).json({ 
  error: 'User not found in MongoDB collection "users" at localhost:27017' 
});
```

## Dependency Security

### Before Adding Dependencies

1. Check the package on npm for:
   - Last update date (avoid unmaintained packages)
   - Known vulnerabilities
   - Download count and popularity
   - License compatibility

2. Run security audits:
```bash
npm audit
npm audit fix
```

3. Use specific versions in package.json (not `^` or `~` for critical dependencies)

### Regular Updates

- Review and update dependencies monthly
- Monitor GitHub Dependabot alerts
- Test thoroughly after dependency updates

## Code Review Checklist

When reviewing code for security:

- [ ] No hardcoded secrets or credentials
- [ ] Environment variables documented in .env.example
- [ ] Sensitive data encrypted before database storage
- [ ] Input validation implemented with Zod
- [ ] Authentication middleware applied to protected routes
- [ ] Rate limiting applied where appropriate
- [ ] Error messages don't leak system information
- [ ] Logging doesn't include sensitive data
- [ ] SQL/NoSQL injection prevented
- [ ] Dependencies checked for vulnerabilities

## GitHub Copilot Security

When using GitHub Copilot:

- **Review all suggestions**: Copilot may suggest insecure patterns
- **Reject secret suggestions**: Never accept suggestions with hardcoded credentials
- **Validate security code**: Manually review all authentication and encryption code
- **Test thoroughly**: Always test security-critical code generated by Copilot
- **Follow patterns**: Ensure Copilot suggestions follow repository security patterns

## Incident Response

If you discover a security vulnerability:

1. **Do not** create a public GitHub issue
2. Contact the repository owner directly via private communication
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be patched before public disclosure

## Security Testing

Before committing security-related changes:

```bash
# Test encryption
npm run test:security

# Test authentication
npm run test:auth

# Test rate limiting
npm run test:rate

# Run all tests
npm run test:all
```

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Contact

For security concerns or questions, contact:
- Repository Owner: @ahsanhabib9191
- Review CODEOWNERS file for specific area experts
