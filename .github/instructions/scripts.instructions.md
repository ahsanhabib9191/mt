---
description: Instructions for test and utility scripts
applyTo: "scripts/**/*.ts"
---

# Test Scripts Instructions

## Script Patterns

All test and utility scripts in this repository follow consistent patterns.

### Script Structure

Standard structure for test scripts:

```typescript
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db';
import { redis } from '../lib/db/redis';
import logger from '../lib/utils/logger';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Connect to services
    await connectDB();
    
    // Test logic here
    console.log('✅ Test passed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up connections
    await disconnectDB();
    await redis.quit();
  }
}

main();
```

### Required Setup

Every script MUST:

1. **Load environment variables** with `dotenv.config()`
2. **Connect to database** if needed with `connectDB()`
3. **Connect to Redis** if needed (imported from `lib/db/redis`)
4. **Clean up connections** in `finally` block
5. **Exit with appropriate code** (0 for success, 1 for failure)

### Console Output

Use clear, colored output for better readability:

```typescript
// Success messages
console.log('✅ Operation successful');
console.log('✓ Step completed');

// Error messages
console.error('❌ Operation failed');
console.error('✗ Step failed');

// Info messages
console.log('ℹ️ Processing...');
console.log('→ Next step');

// Section headers
console.log('\n=== Testing Authentication ===\n');
```

### Database Operations

When testing database operations:

```typescript
import { connectDB, disconnectDB } from '../lib/db';
import { Campaign } from '../lib/db/models';

async function testDatabase() {
  await connectDB();
  
  try {
    // Create test document
    const campaign = await Campaign.create({
      name: 'Test Campaign',
      // ... other fields
    });
    
    console.log('✅ Created:', campaign._id);
    
    // Clean up test data
    await Campaign.deleteOne({ _id: campaign._id });
    console.log('✅ Cleaned up test data');
    
  } finally {
    await disconnectDB();
  }
}
```

### Redis Operations

When testing Redis operations:

```typescript
import { redis } from '../lib/db/redis';

async function testRedis() {
  try {
    // Test Redis connection
    await redis.set('test:key', 'value', 'EX', 60);
    const value = await redis.get('test:key');
    console.log('✅ Redis read/write:', value);
    
    // Clean up
    await redis.del('test:key');
    
  } finally {
    await redis.quit();
  }
}
```

### Error Handling

Handle errors gracefully:

```typescript
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof Error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } else {
    console.error('❌ Unknown error:', error);
  }
  process.exit(1);
}
```

### Environment Validation

Validate required environment variables at startup:

```typescript
function validateEnv() {
  const required = ['MONGODB_URI', 'REDIS_URL', 'NEXTAUTH_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.error('Create a .env file based on .env.example');
    process.exit(1);
  }
}

validateEnv();
```

### TypeScript Execution

Scripts use `ts-node` for execution:

```bash
ts-node scripts/test-script.ts
```

Configure in `package.json`:

```json
{
  "scripts": {
    "test:feature": "ts-node scripts/test-feature.ts"
  }
}
```

### Testing Patterns

Follow these patterns for different test types:

#### Database Model Tests

```typescript
// Test model creation
const doc = await Model.create(validData);
console.log('✅ Created:', doc._id);

// Test validation
try {
  await Model.create(invalidData);
  console.error('❌ Validation should have failed');
} catch (error) {
  console.log('✅ Validation works');
}

// Test queries
const found = await Model.findById(doc._id);
console.log('✅ Query works');

// Clean up
await Model.deleteOne({ _id: doc._id });
```

#### Authentication Tests

```typescript
import jwt from 'jsonwebtoken';

// Test token generation
const token = jwt.sign({ userId: 'test' }, process.env.NEXTAUTH_SECRET!);
console.log('✅ Token generated');

// Test token verification
const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
console.log('✅ Token verified:', decoded);
```

#### Encryption Tests

```typescript
import { encrypt, decrypt } from '../lib/utils/crypto';

const plaintext = 'sensitive data';
const encrypted = await encrypt(plaintext);
console.log('✅ Encrypted:', encrypted.substring(0, 20) + '...');

const decrypted = await decrypt(encrypted);
console.log('✅ Decrypted matches:', decrypted === plaintext);
```

### Timing and Performance

Log execution time for performance tests:

```typescript
const startTime = Date.now();

// Operation to measure
await someOperation();

const duration = Date.now() - startTime;
console.log(`✅ Completed in ${duration}ms`);
```

### Reference Existing Scripts

Study patterns from existing scripts in `scripts/`:

- `test-db.ts` - Database connection and model tests
- `test-auth.ts` - JWT authentication tests
- `test-encryption.ts` - Encryption utility tests
- `test-rate-limit.ts` - Rate limiting tests
- `test-redis-client.ts` - Redis connection tests
- `sync-meta.ts` - Background job with Redis locking

### Script Naming Convention

- `test-*.ts` - Test scripts for specific features
- `sync-*.ts` - Background synchronization jobs
- `migrate-*.ts` - Database migration scripts
- `seed-*.ts` - Database seeding scripts
- `*.ts` - Other utility scripts

### Exit Codes

Use proper exit codes:

- `0` - Success
- `1` - Error or test failure
- `2` - Invalid usage or missing arguments

```typescript
if (success) {
  console.log('✅ All tests passed');
  process.exit(0);
} else {
  console.error('❌ Tests failed');
  process.exit(1);
}
```
