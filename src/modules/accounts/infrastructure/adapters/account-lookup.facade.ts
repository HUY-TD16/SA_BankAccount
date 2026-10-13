import type {
  AccountRepositoryPort,
} from '../../application/ports/account.repository.port';
import type {
  AccountLookupResult,
  AccountsFacade,
} from '../../application/ports/accounts.facade';

export class AccountLookupFacade implements AccountsFacade {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  async findByAccountNumber(
    accountNumber: string,
  ): Promise<AccountLookupResult | null> {
    const account = await this.accounts.findByAccountNumber(accountNumber);

    if (account === null) {
      return null;
    }

    return {
      id: account.id,
      accountNumber: account.accountNumber,
      currency: account.currency,
      status: account.status,
    };
  }
}