import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { GlobalExceptionFilter } from './global-exception.filter.js';

function createHost(path = '/api/examples') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status };
  const request = { path };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  describe('FILTER-001 BadRequestException', () => {
    it('returns HTTP 400 with message and path', () => {
      const { host, status, json } = createHost('/api/test');

      filter.catch(new BadRequestException('name: Required'), host);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        message: 'name: Required',
        path: '/api/test',
      });
    });

    it('joins array validation messages into a string', () => {
      const { host, status, json } = createHost('/api/test');

      filter.catch(new BadRequestException(['name: Required', 'page: Invalid']), host);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        message: 'name: Required; page: Invalid',
        path: '/api/test',
      });
    });
  });

  describe('FILTER-002 HttpException status preserved', () => {
    it('returns 401 for UnauthorizedException', () => {
      const { host, status, json } = createHost('/api/secure');

      filter.catch(new UnauthorizedException('Invalid session'), host);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({
        message: 'Invalid session',
        path: '/api/secure',
      });
    });

    it('returns 404 for NotFoundException', () => {
      const { host, status, json } = createHost('/api/missing');

      filter.catch(new NotFoundException('Not found'), host);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        message: 'Not found',
        path: '/api/missing',
      });
    });
  });

  describe('FILTER-003 unknown error', () => {
    it('returns HTTP 500 with message and path', () => {
      const { host, status, json } = createHost('/api/boom');

      filter.catch(new Error('boom'), host);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        message: 'Internal server error',
        path: '/api/boom',
      });
    });
  });
});
