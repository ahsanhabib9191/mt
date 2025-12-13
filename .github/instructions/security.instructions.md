---
description: Extra security requirements for authentication and encryption code
applyTo: "{lib/middleware/auth.ts,lib/utils/crypto.ts,lib/middleware/rate-limit.ts}"
---

# Security Instructions

## Critical Security Requirements

**⚠️ MANDATORY: All changes to these files require security review**

Reference `SECURITY.md` for comprehensive security guidelines.

### Pre-Commit Security Checklist

Before committing changes to security-critical files:

- [ ] No hardcoded secrets, API keys, or credentials
- [ ] All sensitive data encrypted at rest
- [ ] All user inputs validated with Zod schemas
- [ ] No logging of tokens, passwords, or PII
- [ ] Proper error messages (don't leak sensitive info)
- [ ] Run `npm run security:scan` and ensure it passes
- [ ] Test with `npm run test:security` and `npm run test:auth`

### Encryption at Rest

All sensitive data MUST be encrypted before storing in the database:

**Encrypt:**
- OAuth access tokens
- OAuth refresh tokens
- API keys and secrets
- Passwords (use bcrypt, NOT AES encryption)
- Any PII requiring protection

**Use `lib/utils/crypto.ts` utilities:**

```typescript
import { encrypt, decrypt } from '../utils/crypto';

// Encrypting data
const encryptedToken = await encrypt(plainToken);

// Decrypting data
const plainToken = await decrypt(encryptedToken);
```

**For passwords, use bcrypt:**

```typescript
import bcrypt from 'bcrypt';

// Hashing password
const hashedPassword = await bcrypt.hash(password, 12);

// Verifying password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### Input Validation

ALL user inputs MUST be validated with Zod schemas:

```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  apiKey: z.string().length(32)
});

const validated = schema.parse(userInput);
```

Reference: `lib/utils/validators.ts` for common validation schemas

### JWT Authentication

When working with JWT tokens in `lib/middleware/auth.ts`:

1. **Token Generation:**
   - Use strong secrets (min 32 bytes)
   - Set reasonable expiry times (1-24 hours)
   - Include minimal claims (userId, tenantId, role)
   - Sign with HS256 or RS256 algorithm

2. **Token Verification:**
   - Always verify signature
   - Check expiration
   - Validate issuer and audience
   - Handle expired tokens gracefully

3. **Token Storage:**
   - NEVER store JWT in database
   - Return to client for session management
   - Use httpOnly cookies or Authorization header

**Example:**
```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId, tenantId },
  process.env.NEXTAUTH_SECRET!,
  { expiresIn: '24h', issuer: 'meta-ads-api' }
);

const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
```

### Rate Limiting Security

When working with rate limiting in `lib/middleware/rate-limit.ts`:

1. **Prevent Brute Force:**
   - Limit authentication attempts (5 per 15 minutes)
   - Exponential backoff for repeated failures
   - Lock accounts after threshold

2. **Prevent DoS:**
   - Global rate limits per IP
   - Per-user rate limits
   - Per-tenant rate limits

3. **Redis Security:**
   - Use isolated key namespaces
   - Set TTLs on all keys
   - Clean up old data

**Example:**
```typescript
const key = `ratelimit:auth:${ip}:${userId}`;
const attempts = await redis.incr(key);
await redis.expire(key, 900); // 15 minutes

if (attempts > 5) {
  throw new AppError('Too many login attempts', 429);
}
```

### Logging Restrictions

**NEVER log:**
- JWT tokens (access or refresh)
- Passwords (plain or hashed)
- API keys or secrets
- OAuth tokens
- Personally Identifiable Information (PII)
- Credit card numbers
- Social security numbers

**DO log:**
- Authentication attempts (userId, timestamp, success/failure)
- Rate limit violations (identifier, limit, timestamp)
- Security events (failed validations, suspicious activity)
- Error messages (sanitized, no sensitive data)

**Example:**
```typescript
// ❌ BAD - logs sensitive data
logger.info('User login', { email, password, token });

// ✅ GOOD - logs safely
logger.info('User login attempt', { userId, ip, success: true });
```

### Error Handling

Don't leak sensitive information in error messages:

```typescript
// ❌ BAD - reveals user existence
throw new Error('User john@example.com not found');

// ✅ GOOD - generic message
throw new Error('Invalid credentials');
```

### Environment Variables

Security-critical environment variables:

- `NEXTAUTH_SECRET` - Min 32 bytes, randomly generated (JWT signing secret)
- `ENCRYPTION_KEY` - 256-bit key (64 hex chars)
- `REDIS_URL` - Include authentication if production
- `MONGODB_URI` - Include authentication, restrict access

**Validation on startup:**

```typescript
if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  throw new Error('NEXTAUTH_SECRET must be at least 32 characters');
}

if (!process.env.ENCRYPTION_KEY || !/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
  throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
}
```

### Security Testing

Run security tests before committing:

```bash
npm run security:scan    # Scan for hardcoded secrets
npm run test:security    # Test encryption utilities
npm run test:auth        # Test authentication
npm run test:crypto-advanced  # Advanced crypto tests
```

### Security Review Triggers

Request security review when:
- Adding new authentication mechanisms
- Changing encryption algorithms
- Modifying rate limiting logic
- Adding new sensitive data fields
- Changing JWT token structure
- Implementing new API integrations

### Reference

- `SECURITY.md` - Comprehensive security guidelines
- `lib/utils/crypto.ts` - Encryption utilities
- `lib/middleware/auth.ts` - JWT authentication patterns
- `lib/middleware/rate-limit.ts` - Rate limiting patterns
- `scripts/security-scan.sh` - Automated security scanning
