import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { HTTP_STATUS } from '@/constants';

export class AppError extends Error {
  constructor(
    public statusCode: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(HTTP_STATUS.NOT_FOUND, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationFailedError extends AppError {
  constructor(public details: { path: string; message: string }[]) {
    super(HTTP_STATUS.BAD_REQUEST, 'Validation failed');
    this.name = 'ValidationFailedError';
  }
}
