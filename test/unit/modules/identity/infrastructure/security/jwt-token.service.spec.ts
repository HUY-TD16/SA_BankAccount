import { JwtTokenService } from '@src/modules/identity/infrastructure/security/jwt-token.service';
import { UnauthorizedError } from '@src/common/domain/errors/common.errors';
import * as jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('JwtTokenService', () => {
  let service: JwtTokenService;
  const mockConfig = {
    accessSecret: 'super-secret-key-for-jwt-testing',
    accessTtl: '60m',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JwtTokenService(mockConfig as any);
  });

  describe('signAccessToken', () => {
    it('ký JWT token với userId gán vào claim sub', async () => {
      (jwt.sign as jest.Mock).mockReturnValue('signed.jwt.token');

      const token = await service.signAccessToken('user-uuid-123');

      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'user-uuid-123' },
        'super-secret-key-for-jwt-testing',
        {
          expiresIn: '60m',
          algorithm: 'HS256',
        },
      );
      expect(token).toBe('signed.jwt.token');
    });
  });

  describe('verifyAccessToken', () => {
    it('trả payload chứa sub khi token hợp lệ', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ sub: 'user-uuid-123' });

      const payload = await service.verifyAccessToken('valid.jwt.token');

      expect(jwt.verify).toHaveBeenCalledWith(
        'valid.jwt.token',
        'super-secret-key-for-jwt-testing',
      );
      expect(payload).toEqual({ sub: 'user-uuid-123' });
    });

    it('ném UnauthorizedError khi jwt.verify ném lỗi (token sai chữ ký hoặc hết hạn)', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.verifyAccessToken('expired.jwt.token')).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });
});
