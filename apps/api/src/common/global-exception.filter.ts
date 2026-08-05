import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { BadRequestException, Catch, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

import type { ErrorResponse } from '@elynd/shared/types';

function normalizeMessage(message: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(message)) {
    return message.join('; ') || fallback;
  }
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  return fallback;
}

function messageFromHttpException(exception: HttpException, fallback: string): string {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body || fallback;
  }
  if (body && typeof body === 'object' && 'message' in body) {
    return normalizeMessage((body as { message?: string | string[] }).message, fallback);
  }
  return fallback;
}

function toErrorResponse(message: string, path: string): ErrorResponse {
  return { message, path };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ path: string }>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof BadRequestException) {
      this.logger.warn(exception);
      return response
        .status(exception.getStatus())
        .json(toErrorResponse(messageFromHttpException(exception, 'Bad request'), request.path));
    }

    if (exception instanceof HttpException) {
      this.logger.warn(exception);
      return response
        .status(exception.getStatus())
        .json(toErrorResponse(messageFromHttpException(exception, exception.message), request.path));
    }

    this.logger.error('Unknown error:', exception);
    return response.status(500).json(toErrorResponse('Internal server error', request.path));
  }
}
