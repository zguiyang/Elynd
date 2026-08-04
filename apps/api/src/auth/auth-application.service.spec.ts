import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthApplicationService } from './auth-application.service.js';
import type { AuthClientPort } from './auth-client.port.js';
import { AUTH_CLIENT } from './auth-client.port.js';

const mockUser = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
};

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  token: 'token-abc',
};

function createMockAuthClient(): AuthClientPort {
  return {
    signUpEmail: vi.fn(),
    signInEmail: vi.fn(),
    getSession: vi.fn(),
  };
}

describe('AuthApplicationService', () => {
  let service: AuthApplicationService;
  let authClient: AuthClientPort;

  beforeEach(async () => {
    authClient = createMockAuthClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthApplicationService,
        {
          provide: AUTH_CLIENT,
          useValue: authClient,
        },
      ],
    }).compile();

    service = module.get(AuthApplicationService);
  });

  describe('AUTH-REG-001 register success', () => {
    it('returns user and session when signUp succeeds', async () => {
      vi.mocked(authClient.signUpEmail).mockResolvedValue({
        ok: true,
        user: mockUser,
        session: mockSession,
      });

      const input = {
        email: 'alice@example.com',
        password: 'password123',
        name: 'Alice',
        username: 'alice',
      };

      const result = await service.register(input);

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(authClient.signUpEmail).toHaveBeenCalledExactlyOnceWith(input);
    });
  });

  describe('AUTH-REG-002 register duplicate email', () => {
    it('throws conflict when email already exists', async () => {
      vi.mocked(authClient.signUpEmail).mockResolvedValue({
        ok: false,
        code: 'DUPLICATE_EMAIL',
        message: 'Email already exists',
      });

      await expect(
        service.register({
          email: 'alice@example.com',
          password: 'password123',
          name: 'Alice',
          username: 'alice',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('AUTH-REG-003 register validation failure', () => {
    it('throws bad request on validation error', async () => {
      vi.mocked(authClient.signUpEmail).mockResolvedValue({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format',
      });

      await expect(
        service.register({
          email: 'not-an-email',
          password: 'short',
          name: '',
          username: 'x',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('AUTH-LOGIN-001 login success', () => {
    it('returns user and session when credentials are valid', async () => {
      vi.mocked(authClient.signInEmail).mockResolvedValue({
        ok: true,
        user: mockUser,
        session: mockSession,
      });

      const result = await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(authClient.signInEmail).toHaveBeenCalledOnce();
    });
  });

  describe('AUTH-LOGIN-002 login wrong password', () => {
    it('throws unauthorized on wrong password', async () => {
      vi.mocked(authClient.signInEmail).mockResolvedValue({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });

      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('AUTH-LOGIN-003 login unknown email', () => {
    it('throws unauthorized when email does not exist', async () => {
      vi.mocked(authClient.signInEmail).mockResolvedValue({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });

      await expect(
        service.login({
          email: 'missing@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('AUTH-SESSION-001 verify session success', () => {
    it('returns user and session for valid Bearer token', async () => {
      vi.mocked(authClient.getSession).mockResolvedValue({
        ok: true,
        user: mockUser,
        session: mockSession,
      });

      const headers = { authorization: 'Bearer token-abc' };
      const result = await service.verifySession(headers);

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(authClient.getSession).toHaveBeenCalledWith(headers);
    });
  });

  describe('AUTH-SESSION-002 verify session expired or invalid', () => {
    it('throws unauthorized for invalid Bearer token', async () => {
      vi.mocked(authClient.getSession).mockResolvedValue({ ok: false });

      await expect(
        service.verifySession({
          authorization: 'Bearer expired-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('AUTH-SESSION-003 verify session missing', () => {
    it('throws unauthorized when Authorization header is absent', async () => {
      vi.mocked(authClient.getSession).mockResolvedValue({ ok: false });

      await expect(service.verifySession({})).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
