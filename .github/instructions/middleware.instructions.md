---
description: Instructions for Express middleware development
applyTo: "lib/middleware/**/*.ts"
---

# Middleware Instructions

## Express Middleware Patterns

All middleware in this repository follows consistent Express.js patterns with TypeScript.

### Middleware Signature

Standard middleware signature:

```typescript
import { Request, Response, NextFunction } from 'express';

export const middlewareName = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Middleware logic
    next();
  } catch (error) {
    next(error); // Pass errors to error handler
  }
};
```

### Async Middleware

For async operations, use try-catch and pass errors to `next()`:

```typescript
export const asyncMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await someAsyncOperation();
    next();
  } catch (error) {
    next(error);
  }
};
```

### Error Handling

- NEVER send error responses directly in middleware
- Always use `next(error)` to pass to centralized error handler
- Error handler is in `lib/middleware/error-handler.ts`
- Throw descriptive errors with appropriate status codes

**Example:**
```typescript
import { AppError } from '../middleware/error-handler';

if (!isValid) {
  throw new AppError('Invalid input', 400);
}
```

### Authentication Patterns

Reference `lib/middleware/auth.ts` for JWT authentication:

- Extract token from `Authorization: Bearer <token>` header
- Verify token with `jsonwebtoken`
- Attach user/tenant info to `req.user` or `req.tenant`
- Handle expired tokens gracefully
- Use appropriate HTTP status codes (401 for unauthorized, 403 for forbidden)

**Example:**
```typescript
req.user = decoded.userId;
req.tenant = decoded.tenantId;
```

### Rate Limiting Patterns

Reference `lib/middleware/rate-limit.ts` for Redis-backed rate limiting:

- Use Redis for distributed rate limiting
- Key format: `ratelimit:{identifier}:{window}`
- Implement sliding window or fixed window algorithms
- Return `429 Too Many Requests` when limit exceeded
- Include `Retry-After` header in rate limit responses

**Example:**
```typescript
const key = `ratelimit:${tenantId}:${Date.now()}`;
const count = await redis.incr(key);
await redis.expire(key, windowSeconds);
```

### Logging Requirements

Use Winston logger from `lib/utils/logger.ts`:

- Log middleware entry/exit for debugging (debug level)
- Log authentication attempts (info level)
- Log errors with context (error level)
- NEVER log sensitive data (tokens, passwords, PII)

**Example:**
```typescript
import logger from '../utils/logger';

logger.info('Authentication attempt', { userId, tenantId });
logger.error('Authentication failed', { error: error.message });
```

### TypeScript Types

Use proper Express types:

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';

// Extend Request interface for custom properties
declare global {
  namespace Express {
    interface Request {
      user?: string;
      tenant?: string;
    }
  }
}
```

### Middleware Composition

Chain middleware in logical order:

1. Logging middleware (if any)
2. Request parsing (body-parser, etc.)
3. Authentication
4. Authorization
5. Rate limiting
6. Business logic
7. Error handler (last)

### Testing

Test middleware with:
```bash
npm run test:auth      # Authentication middleware
npm run test:rate      # Rate limiting middleware
```

Create test scripts in `scripts/` directory following existing patterns.

### Reference Existing Middleware

Study patterns from:
- `lib/middleware/auth.ts` - JWT authentication
- `lib/middleware/rate-limit.ts` - Redis rate limiting
- `lib/middleware/error-handler.ts` - Centralized error handling
