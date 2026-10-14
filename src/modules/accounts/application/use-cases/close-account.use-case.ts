import { Money } from '@src/common/domain/value-objects/money.value-object';
import type { AccountRepositoryPort } from '../ports/account.repository.port';
import { AccountHasBalanceError } from '../../domain/errors/account-has-balance.error';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';

export class CloseAccountUseCase {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  async execute(currentUserId: string, accountId: string): Promise<void> {
    const account = await this.accounts.findById(accountId);

    if (account === null || account.userId !== currentUserId) {
      throw new AccountNotFoundError();
    }

    // Chọn cách xử lý DELETE lặp lại: account đã đóng trả 204.
    if (account.status === 'CLOSED') {
      return;
    }

    if (!account.currentBalance.equals(Money.zero())) {
      throw new AccountHasBalanceError();
    }

    const closed = await this.accounts.closeIfZeroBalance(
      accountId,
      currentUserId,
    );

    if (closed) {
      return;
    }

    // Dữ liệu có thể đổi sau findById(): ví dụ request khác vừa nạp tiền
    // hoặc vừa đóng account. Đọc lại để trả đúng kết quả.
    const latest = await this.accounts.findById(accountId);

    if (latest === null || latest.userId !== currentUserId) {
      throw new AccountNotFoundError();
    }

    if (latest.status === 'CLOSED') {
      return;
    }

    if (!latest.currentBalance.equals(Money.zero())) {
      throw new AccountHasBalanceError();
    }

    throw new Error('Account close condition changed unexpectedly');
  }
}