/**
 * Money value object - đại diện cho một số tiền VND nguyên (không có phần thập phân).
 *
 * Vì sao đặt ở common/domain (không phải trong modules/money-movement/domain như blueprint
 * ban đầu phác thảo)? Vì cả `accounts` (currentBalance) và `money-movement`
 * (amount, balanceAfter) đều cần đúng MỘT class Money duy nhất để tránh:
 *   - Hai module tự viết hai class Money khác nhau (một dùng number, một dùng bigint) rồi
 *     lệch nhau khi cộng/trừ qua lại.
 *   - Một trong hai module phải import chéo từ module kia (vi phạm ranh giới bounded context).
 *
 * Quy tắc bắt buộc khi dùng:
 * - DTO tầng HTTP luôn nhận/trả amount dạng STRING (xem ValidationPipe + contract mục 5.1).
 * - Chỉ convert String -> Money ở use case (application layer), KHÔNG convert ở DTO/controller.
 * - Object Money là immutable: mọi phép toán trả về instance MỚI, không mutate instance cũ.
 * - KHÔNG bao giờ dùng `number`/`float` để cộng trừ tiền ở bất kỳ đâu trong domain/application.
 */
export class Money {
  private readonly amountMinor: bigint; // VND là đơn vị nhỏ nhất, không có minor unit phụ

  private constructor(amountMinor: bigint) {
    this.amountMinor = amountMinor;
  }

  /**
   * Parse từ string (đúng như DTO/API nhận vào). Chỉ chấp nhận số nguyên không âm.
   * @param options.allowZero - false khi amount bắt buộc > 0 (VD: amount giao dịch, transfer).
   *                             true (mặc định) khi 0 hợp lệ (VD: initialDeposit).
   */
  static fromString(
    value: string,
    options: { allowZero?: boolean } = {},
  ): Money {
    const allowZero = options.allowZero ?? true;
    if (!/^\d+$/.test(value)) {
      throw new Error(
        `Invalid money string: "${value}". Expected a non-negative integer string.`,
      );
    }
    const amount = BigInt(value);
    if (amount === 0n && !allowZero) {
      throw new Error("Amount must be greater than 0");
    }
    return new Money(amount);
  }

  static zero(): Money {
    return new Money(0n);
  }

  add(other: Money): Money {
    return new Money(this.amountMinor + other.amountMinor);
  }

  /**
   * Trừ tiền. Đây CHỈ LÀ HÀNG RÀO CUỐI - use case phải tự kiểm tra
   * `isGreaterThanOrEqual` Tđể throw RƯỚC khi gọi subtract() đúng
   * InsufficientFundsError (409) theo domain error của module, thay vì để
   * lỗi kỹ thuật chung chung này lọt ra ngoài.
   */
  subtract(other: Money): Money {
    const result = this.amountMinor - other.amountMinor;
    if (result < 0n) {
      throw new Error(
        "Money.subtract() would result in a negative amount - check balance before calling subtract()",
      );
    }
    return new Money(result);
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.amountMinor >= other.amountMinor;
  }

  isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor;
  }

  /** Dùng khi ghi xuống cột numeric(18,0) qua Prisma */
  toDecimalString(): string {
    return this.amountMinor.toString();
  }

  /** Dùng khi serialize ra JSON response - luôn là string, không phải number (JSON.stringify sẽ gọi hàm này) */
  toJSON(): string {
    return this.amountMinor.toString();
  }
}
