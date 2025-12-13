---
description: Instructions for working with Mongoose database models
applyTo: "lib/db/models/**/*.ts"
---

# Database Models Instructions

## Mongoose Schema Patterns

All Mongoose models in this repository follow strict TypeScript patterns:

### Required Schema Configuration

```typescript
import mongoose from 'mongoose';

interface IModelName extends mongoose.Document {
  // Define all fields with explicit types
}

const ModelNameSchema = new mongoose.Schema<IModelName>({
  // Schema definition
}, {
  timestamps: true, // ALWAYS include timestamps
  collection: 'collection_name'
});
```

### Type Safety Requirements

- Always use explicit TypeScript interfaces that extend `mongoose.Document`
- Define schemas with generic type: `new mongoose.Schema<IInterface>(...)`
- Export both the interface and the model
- Avoid `any` types - use proper TypeScript types

### Required Fields

Every model MUST include:

1. **Timestamps**: `{ timestamps: true }` in schema options
2. **Indexes**: Create indexes for frequently queried fields
3. **Virtuals**: Use virtual properties for computed fields when appropriate
4. **toJSON Transforms**: Clean up output for API responses

### Encryption Requirements

Sensitive fields MUST be encrypted at rest:

- OAuth tokens (access tokens, refresh tokens)
- API keys and secrets
- Passwords (use bcrypt hashing)
- Any PII that requires protection

Reference: `lib/utils/crypto.ts` for encryption utilities

**Example:**
```typescript
// Before saving
doc.encryptedToken = await encrypt(plainToken);

// After retrieving
const plainToken = await decrypt(doc.encryptedToken);
```

### Validation Patterns

Use both Mongoose validators and Zod schemas:

1. **Mongoose built-in validators** for simple validations (required, min, max, enum)
2. **Custom validators** for complex business logic
3. **Zod schemas** from `lib/utils/validators.ts` for API input validation

### Index Strategy

Create indexes for:
- Fields used in queries (find, findOne)
- Fields used in sorting
- Fields used in aggregations
- Compound indexes for common query patterns

**Example:**
```typescript
schema.index({ tenantId: 1, status: 1 });
schema.index({ createdAt: -1 });
schema.index({ email: 1 }, { unique: true });
```

### toJSON Transforms

Always implement toJSON to clean up API responses:

```typescript
schema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.encryptedFields; // Hide encrypted data
    return ret;
  }
});
```

### Reference Existing Models

Study patterns from existing models:
- `lib/db/models/Tenant.ts` - Multi-tenancy patterns
- `lib/db/models/MetaConnection.ts` - Encryption patterns
- `lib/db/models/campaign.ts` - Meta API integration patterns
- `lib/db/models/performance-snapshot.ts` - Time-series data patterns

### Testing

Always test new models with:
```bash
npm run test:models
```

Ensure all validations, indexes, and methods work correctly before committing.
