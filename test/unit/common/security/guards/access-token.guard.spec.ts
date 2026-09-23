import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenGuard } from '@src/common/security/guards/access-token.guard';
import {
  AccessTokenPayload,
  TokenServicePort,
} from '@src/common/security/ports/token-service.port';
import { UnauthorizedError } from '@src/common/domain/errors/common.errors';

describe('AccessTokenGuard', () => {
  let guard: AccessTokenGuard;
  let mockReflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let mockTokenService: jest.Mocked<TokenServicePort>;

  beforeEach(() => {
    mockReflector = { getAllAndOverride: jest.fn() };
    mockTokenService = { verifyAccessToken: jest.fn() };
    guard = new AccessTokenGuard(
      mockReflector as unknown as Reflector,
      mockTokenService,
    );
  });

  function buildContext(authHeader?: string): ExecutionContext {
    const request = {
      headers: { authorization: authHeader },
      user: undefined as AccessTokenPayload | undefined,
    };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  describe('@Public() routes', () => {
    it('cho qua và không gọi tokenService khi route là @Public()', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const result = await guard.canActivate(buildContext());

      expect(result).toBe(true);
      expect(mockTokenService.verifyAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('Protected routes', () => {
    beforeEach(() => mockReflector.getAllAndOverride.mockReturnValue(false));

    it.each([
      ['không có authorization header', undefined],
      ['header rỗng', ''],
      ['scheme không phải Bearer', 'Basic abc123'],
      ['Bearer không có token theo sau', 'Bearer '],
    ])('throw UnauthorizedError(MISSING_TOKEN) khi %s', async (_, header) => {
      await expect(guard.canActivate(buildContext(header))).rejects.toThrow(
        UnauthorizedError,
      );
      await expect(guard.canActivate(buildContext(header))).rejects.toThrow(
        'MISSING_TOKEN',
      );
    });

    it('gọi tokenService với token đã được parse đúng', async () => {
      const payload: AccessTokenPayload = { sub: 'user-123' };
      mockTokenService.verifyAccessToken.mockResolvedValue(payload);

      await guard.canActivate(buildContext('Bearer valid-token'));

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    });

    it('gắn payload vào request.user và trả về true', async () => {
      const payload: AccessTokenPayload = { sub: 'user-456' };
      mockTokenService.verifyAccessToken.mockResolvedValue(payload);

      const request = { headers: { authorization: 'Bearer token' }, user: undefined };
      const ctx = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(request.user).toEqual(payload);
    });

    it('throw UnauthorizedError khi tokenService throw (token hết hạn / sai chữ ký)', async () => {
      mockTokenService.verifyAccessToken.mockRejectedValue(
        new UnauthorizedError('EXPIRED_TOKEN'),
      );

      await expect(guard.canActivate(buildContext('Bearer expired'))).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('parse đúng JWT thật (có nhiều ký tự đặc biệt)', async () => {
      const payload: AccessTokenPayload = { sub: 'user-789' };
      mockTokenService.verifyAccessToken.mockResolvedValue(payload);

      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTc4OSJ9.signature';

      await guard.canActivate(buildContext(`Bearer ${jwt}`));

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(jwt);
    });
  });
});
