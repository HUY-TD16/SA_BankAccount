import { Money } from '@src/common/domain/value-objects/money.value-object';

describe('Money', () => {
  describe('fromString()', () => {
    it('parse chuỗi số hợp lệ', () => {
      const m = Money.fromString('1000');
      expect(m.toDecimalString()).toBe('1000');
    });

    it('parse số 0 khi allowZero = true (mặc định)', () => {
      const m = Money.fromString('0');
      expect(m.toDecimalString()).toBe('0');
    });

    it('parse số lớn (bigint)', () => {
      const m = Money.fromString('99999999999999999');
      expect(m.toDecimalString()).toBe('99999999999999999');
    });

    it('throw khi chuỗi rỗng', () => {
      expect(() => Money.fromString('')).toThrow('Invalid money string');
    });

    it('throw khi chuỗi có chữ', () => {
      expect(() => Money.fromString('abc')).toThrow('Invalid money string');
    });

    it('throw khi chuỗi có dấu âm', () => {
      expect(() => Money.fromString('-100')).toThrow('Invalid money string');
    });

    it('throw khi chuỗi có dấu thập phân', () => {
      expect(() => Money.fromString('100.50')).toThrow('Invalid money string');
    });

    it('throw khi = 0 và allowZero = false', () => {
      expect(() => Money.fromString('0', { allowZero: false })).toThrow(
        'Amount must be greater than 0',
      );
    });
  });

  describe('zero()', () => {
    it('tạo Money với giá trị 0', () => {
      expect(Money.zero().toDecimalString()).toBe('0');
    });
  });

  describe('add()', () => {
    it('cộng hai số tiền đúng', () => {
      const result = Money.fromString('300').add(Money.fromString('700'));
      expect(result.toDecimalString()).toBe('1000');
    });

    it('cộng với 0', () => {
      const result = Money.fromString('500').add(Money.zero());
      expect(result.toDecimalString()).toBe('500');
    });

    it('immutable — không thay đổi instance gốc', () => {
      const a = Money.fromString('100');
      a.add(Money.fromString('200'));
      expect(a.toDecimalString()).toBe('100');
    });
  });

  describe('subtract()', () => {
    it('trừ tiền đúng', () => {
      const result = Money.fromString('1000').subtract(Money.fromString('300'));
      expect(result.toDecimalString()).toBe('700');
    });

    it('trừ về đúng 0', () => {
      const result = Money.fromString('500').subtract(Money.fromString('500'));
      expect(result.toDecimalString()).toBe('0');
    });

    it('throw khi kết quả âm (số dư không đủ)', () => {
      expect(() => Money.fromString('100').subtract(Money.fromString('200'))).toThrow(
        'negative amount',
      );
    });

    it('immutable — không thay đổi instance gốc', () => {
      const a = Money.fromString('500');
      a.subtract(Money.fromString('100'));
      expect(a.toDecimalString()).toBe('500');
    });
  });

  describe('isGreaterThanOrEqual()', () => {
    it('trả về true khi lớn hơn', () => {
      expect(Money.fromString('600').isGreaterThanOrEqual(Money.fromString('500'))).toBe(true);
    });

    it('trả về true khi bằng nhau', () => {
      expect(Money.fromString('500').isGreaterThanOrEqual(Money.fromString('500'))).toBe(true);
    });

    it('trả về false khi nhỏ hơn', () => {
      expect(Money.fromString('400').isGreaterThanOrEqual(Money.fromString('500'))).toBe(false);
    });
  });

  describe('isPositive()', () => {
    it('trả về true khi > 0', () => {
      expect(Money.fromString('1').isPositive()).toBe(true);
    });

    it('trả về false khi = 0', () => {
      expect(Money.zero().isPositive()).toBe(false);
    });
  });

  describe('equals()', () => {
    it('trả về true khi hai Money bằng nhau', () => {
      expect(Money.fromString('1000').equals(Money.fromString('1000'))).toBe(true);
    });

    it('trả về false khi hai Money khác nhau', () => {
      expect(Money.fromString('1000').equals(Money.fromString('2000'))).toBe(false);
    });
  });

  describe('toDecimalString()', () => {
    it('convert sang string để ghi xuống DB', () => {
      expect(Money.fromString('123456').toDecimalString()).toBe('123456');
    });
  });

  describe('toJSON()', () => {
    it('serialize ra JSON response dạng string', () => {
      expect(Money.fromString('789').toJSON()).toBe('789');
    });

    it('JSON.stringify gọi toJSON() tự động', () => {
      const obj = { amount: Money.fromString('1000') };
      expect(JSON.stringify(obj)).toBe('{"amount":"1000"}');
    });
  });
});
