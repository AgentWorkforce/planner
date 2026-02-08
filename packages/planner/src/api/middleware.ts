/**
 * Re-export shared error handling from @plannr/errors.
 * This file exists for backward compatibility with existing imports.
 */
export {
  type ApiError,
  HttpError,
  NotFoundError,
  BadRequestError,
  ValidationError,
  ConflictError,
  notFound,
  badRequest,
  unprocessableEntity,
  conflict,
  errorHandler,
} from '@plannr/errors';
