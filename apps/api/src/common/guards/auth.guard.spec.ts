import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthApplicationService } from '../../auth/auth-application.service.js';
import { IS_PUBLIC_API } from '../decorators/public-api.decorator.js';
import { AuthGuard } from './auth.guard.js';

describe('AuthGuard', () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  };
  const authApplicationService = {
    verifySession: vi.fn(),
  };

  let guard: AuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new AuthGuard(
      reflector as unknown as Reflector,
      authApplicationService as unknown as AuthApplicationService,
    );
  });

  function createContext(path: string, url = path) {
    const request = { path, url, headers: {} };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    } as unknown as ExecutionContext & { request: typeof request };
  }

  it('allows public handlers without verifying session', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createContext('/api/auth/ok');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authApplicationService.verifySession).not.toHaveBeenCalled();
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_API, [expect.anything(), expect.anything()]);
  });

  it('allows Swagger api-doc paths without verifying session', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createContext('/api-doc', '/api-doc/json');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authApplicationService.verifySession).not.toHaveBeenCalled();
  });

  it('verifies session for protected paths', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    authApplicationService.verifySession.mockResolvedValue({
      user: { id: 'u1' },
      session: { id: 's1' },
    });
    const context = createContext('/api/examples');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authApplicationService.verifySession).toHaveBeenCalled();
    expect(context.request['user']).toEqual({ id: 'u1' });
  });
});
