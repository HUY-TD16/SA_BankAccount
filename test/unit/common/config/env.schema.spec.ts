import { validateEnv, NodeEnv } from '@src/common/config/env.schema';

describe('validateEnv', () => {
  const validConfig = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_ACCESS_SECRET: 'super-secret-key-123',
    JWT_ACCESS_TTL: '60m',
    BCRYPT_ROUNDS: '12',
  };

  it('pass với config hợp lệ', () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  describe('NODE_ENV', () => {
    it('chấp nhận "development"', () => {
      const config = { ...validConfig, NODE_ENV: 'development' };
      const result = validateEnv(config);
      expect(result.NODE_ENV).toBe(NodeEnv.DEVELOPMENT);
    });

    it('chấp nhận "test"', () => {
      const config = { ...validConfig, NODE_ENV: 'test' };
      const result = validateEnv(config);
      expect(result.NODE_ENV).toBe(NodeEnv.TEST);
    });

    it('chấp nhận "production"', () => {
      const config = { ...validConfig, NODE_ENV: 'production' };
      const result = validateEnv(config);
      expect(result.NODE_ENV).toBe(NodeEnv.PRODUCTION);
    });

    it('throw khi NODE_ENV không hợp lệ', () => {
      const config = { ...validConfig, NODE_ENV: 'staging' };
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });
  });

  describe('PORT', () => {
    it('convert string sang number', () => {
      const config = { ...validConfig, PORT: '8080' };
      const result = validateEnv(config);
      expect(result.PORT).toBe(8080);
      expect(typeof result.PORT).toBe('number');
    });

    it('throw khi PORT < 1', () => {
      const config = { ...validConfig, PORT: '0' };
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });

    it('throw khi PORT > 65535', () => {
      const config = { ...validConfig, PORT: '70000' };
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });

    it('throw khi PORT không phải số', () => {
      const config = { ...validConfig, PORT: 'abc' };
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });
  });

  describe('DATABASE_URL', () => {
    it('throw khi DATABASE_URL rỗng', () => {
      const config = { ...validConfig, DATABASE_URL: '' };
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });

    it('throw khi thiếu DATABASE_URL', () => {
      const config = { ...validConfig };
      delete (config as any).DATABASE_URL;
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });
  });

  describe('JWT_ACCESS_SECRET', () => {
    it('throw khi JWT_ACCESS_SECRET rỗng', () => {
      const config = { ...validConfig, JWT_ACCESS_SECRET: '' };
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });

    it('throw khi thiếu JWT_ACCESS_SECRET', () => {
      const config = { ...validConfig };
      delete (config as any).JWT_ACCESS_SECRET;
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });
  });

  describe('JWT_ACCESS_TTL', () => {
    it('có giá trị mặc định "60m"', () => {
      const config = { ...validConfig };
      delete (config as any).JWT_ACCESS_TTL;
      const result = validateEnv(config);
      expect(result.JWT_ACCESS_TTL).toBe('60m');
    });

    it('chấp nhận custom TTL', () => {
      const config = { ...validConfig, JWT_ACCESS_TTL: '30m' };
      const result = validateEnv(config);
      expect(result.JWT_ACCESS_TTL).toBe('30m');
    });
  });

  describe('BCRYPT_ROUNDS', () => {
    it('có giá trị mặc định 12', () => {
      const config = { ...validConfig };
      delete (config as any).BCRYPT_ROUNDS;
      const result = validateEnv(config);
      expect(result.BCRYPT_ROUNDS).toBe(12);
    });

    it('chấp nhận BCRYPT_ROUNDS từ 4-15', () => {
      expect(() => validateEnv({ ...validConfig, BCRYPT_ROUNDS: '4' })).not.toThrow();
      expect(() => validateEnv({ ...validConfig, BCRYPT_ROUNDS: '15' })).not.toThrow();
    });

    it('throw khi BCRYPT_ROUNDS < 4', () => {
      const config = { ...validConfig, BCRYPT_ROUNDS: '3' };
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });

    it('throw khi BCRYPT_ROUNDS > 15', () => {
      const config = { ...validConfig, BCRYPT_ROUNDS: '16' };
      expect(() => validateEnv(config)).toThrow('Invalid environment variables');
    });
  });
});
