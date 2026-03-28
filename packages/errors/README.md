# Errors

Centralized error types and Express middleware for HTTP APIs.

## What This Is

Shared error handling primitives for API consistency across domain packages. Provides:
- Custom error classes with status codes
- Factory functions for common HTTP errors
- Express middleware for error formatting

## Error Classes

### `HttpError`

Base class for all HTTP errors:

```typescript
class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  );
}
```

### Specific Error Types

```typescript
// 404 Not Found
class NotFoundError extends HttpError {
  constructor(resource: string);
}

// 400 Bad Request
class BadRequestError extends HttpError {
  constructor(message: string, details?: unknown);
}

// 422 Validation Error
class ValidationError extends HttpError {
  constructor(message: string, details?: unknown);
}

// 409 Conflict Error
class ConflictError extends HttpError {
  constructor(message: string, details?: unknown);
}
```

## Factory Functions

Convenience helpers for throwing errors:

```typescript
import { notFound, badRequest, unprocessableEntity, conflict } from '@plannr/errors';

// 404
throw notFound('Plan');  // "Plan not found"

// 400
throw badRequest('Invalid plan ID', { planId: 'abc' });

// 422
throw unprocessableEntity('Invalid step dependencies', { errors: [...] });

// 409
throw conflict('Plan version already exists');
```

## Error Handler Middleware

Express middleware that converts errors to consistent JSON responses:

```typescript
import express from 'express';
import { errorHandler } from '@plannr/errors';

const app = express();

// ... route handlers ...

// Mount error handler LAST (after all routes)
app.use(errorHandler);
```

### Response Format

All errors return JSON with this shape:

```typescript
interface ApiError {
  error: string;      // Human-readable message
  details?: unknown;  // Optional: structured error details
}
```

### Handled Error Types

1. **HttpError** (custom errors)
   - Status: `err.statusCode`
   - Body: `{ error: err.message, details?: err.details }`

2. **ZodError** (validation failures)
   - Status: `400`
   - Body: `{ error: "Validation error", details: err.errors }`

3. **SyntaxError** (malformed JSON)
   - Status: `400`
   - Body: `{ error: "Invalid JSON" }`

4. **Unknown errors**
   - Status: `500`
   - Body: `{ error: "Internal server error" }`
   - Logs full error to console

## Usage Examples

### In Route Handlers

```typescript
import { notFound, badRequest } from '@plannr/errors';

app.get('/api/plans/:id', (req, res) => {
  const plan = storage.getPlan(req.params.id);

  if (!plan) {
    throw notFound('Plan');  // 404 response
  }

  res.json(plan);
});

app.post('/api/plans', (req, res) => {
  if (!req.body.title) {
    throw badRequest('Missing required field: title');  // 400 response
  }

  const plan = storage.createPlan(req.body);
  res.status(201).json(plan);
});
```

### With Zod Validation

```typescript
import { z } from 'zod';
import { unprocessableEntity } from '@plannr/errors';

const PlanSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
});

app.post('/api/plans', (req, res) => {
  const result = PlanSchema.safeParse(req.body);

  if (!result.success) {
    throw unprocessableEntity('Invalid plan data', result.error.errors);
  }

  const plan = storage.createPlan(result.data);
  res.status(201).json(plan);
});
```

### In Domain Services

```typescript
import { conflict } from '@plannr/errors';

class PlanService {
  approvePlanVersion(planId: string, version: number): void {
    const plan = this.storage.getPlanVersion(planId, version);

    if (plan.status === 'approved') {
      throw conflict('Plan version already approved');
    }

    // ... approval logic
  }
}
```

## Exports

```typescript
// Error classes
export {
  HttpError,
  NotFoundError,
  BadRequestError,
  ValidationError,
  ConflictError
};

// Factory functions
export {
  notFound,
  badRequest,
  unprocessableEntity,
  conflict
};

// Middleware
export { errorHandler };

// Types
export type { ApiError };
```

## Dependencies

- `zod` - For ZodError handling in middleware
- `express` - Peer dependency for middleware types

## Development

```bash
npm run build      # Compile TypeScript
npm run typecheck  # Type checking only
```

## Design Principles

1. **Single Source of Truth**: All HTTP errors use these classes
2. **Consistent Responses**: Same JSON shape across all APIs
3. **Structured Details**: `details` field for machine-readable context
4. **Express Integration**: Middleware plugs into Express error handling chain

## Related Packages

Used by all domain packages for API consistency:
- `planner-core`
- `ideation-core`
- `forge-core`
- `server`
