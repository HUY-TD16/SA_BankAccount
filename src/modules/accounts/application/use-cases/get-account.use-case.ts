import type { AccountRepositoryPort } from '../ports/account.repository.port';
import type { BankAccount } from '../../domain/entities/bank-account.entity';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';

export class GetAccountUseCase {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  async execute(
    currentUserId: string,
    accountId: string,
  ): Promise<BankAccount> {
    const account = await this.accounts.findById(accountId);

    if (account === null || account.userId !== currentUserId) {
      throw new AccountNotFoundError();
    }

    return account;
  }
}