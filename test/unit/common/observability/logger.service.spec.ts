import { redactSensitive } from '@src/common/observability/logger.service';

describe('redactSensitive()', () => {
  describe('field nhạy cảm', () => {
    it.each([
      ['password', '123456'],
      ['confirmPassword', 'abc'],
      ['token', 'abc.def.ghi'],
      ['accessToken', 'jwt-token'],
      ['authorization', 'Bearer xxx'],
      ['cookie', 'session=xxx'],
      ['secret', 'my-secret'],
      ['accountNumber', '1234567890'],
    ])('che field "%s"', (field, value) => {
      const result = redactSensitive({ [field]: value });
      expect(result).toEqual({ [field]: '[REDACTED]' });
    });

    it('KHÔNG che field bình thường', () => {
      const result = redactSensitive({ email: 'a@b.com', name: 'John' });
      expect(result).toEqual({ email: 'a@b.com', name: 'John' });
    });
  });

  describe('nested object', () => {
    it('redact field lồng trong object con', () => {
      const result = redactSensitive({
        user: { email: 'test@example.com', password: 'secret123' },
      });
      expect(result).toEqual({
        user: { email: 'test@example.com', password: '[REDACTED]' },
      });
    });

    it('redact nhiều level sâu', () => {
      const result = redactSensitive({
        level1: { level2: { level3: { token: 'abc' } } },
      });
      expect((result as any).level1.level2.level3.token).toBe('[REDACTED]');
    });
  });

  describe('array', () => {
    it('redact từng item trong array', () => {
      const result = redactSensitive([
        { password: 'pass1' },
        { email: 'a@b.com' },
        { token: 'token1' },
      ]);
      expect(result).toEqual([
        { password: '[REDACTED]' },
        { email: 'a@b.com' },
        { token: '[REDACTED]' },
      ]);
    });

    it('redact object lồng trong array', () => {
      const result = redactSensitive([{ user: { password: 'secret' } }]);
      expect((result as any)[0].user.password).toBe('[REDACTED]');
    });
  });

  describe('edge cases', () => {
    it.each([
      ['string', 'string'],
      ['number', 123],
      ['boolean', true],
      ['null', null],
      ['undefined', undefined],
    ])('giữ nguyên primitive: %s', (_, value) => {
      expect(redactSensitive(value)).toBe(value);
    });

    it('object rỗng', () => {
      expect(redactSensitive({})).toEqual({});
    });

    it('array rỗng', () => {
      expect(redactSensitive([])).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('không thay đổi input gốc', () => {
      const input = { password: 'secret' };
      redactSensitive(input);
      expect(input.password).toBe('secret');
    });
  });
});
