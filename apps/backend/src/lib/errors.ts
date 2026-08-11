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
