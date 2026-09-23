import { Money } from '../../../src/common/domain/value-objects/money.value-object';

/**
 * Builder pattern để tạo Money trong test — tránh lặp lại Money.fromString() khắp nơi
 */
export class MoneyBuilder {
  private amount = '0';

  static create(): MoneyBuilder {
    return new MoneyBuilder();
  }

  withAmount(value: string | number): this {
    this.amount = String(value);
    return this;
  }

  build(): Money {
    return Money.fromString(this.amount);
  }

  /** Shorthand cho case thường gặp */
  static of(amount: string | number): Money {
    return Money.fromString(String(amount));
  }

  static zero(): Money {
    return Money.zero();
  }
}
