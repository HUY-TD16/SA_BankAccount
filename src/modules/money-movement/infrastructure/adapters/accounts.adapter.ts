import type {
    AccountsFacade,
} from '../../../accounts/application/ports/accounts.facade';

import type {
    AccountsPort,
    TransferRecipient,
} from '../../application/ports/accounts.port';

export class AccountsAdapter implements AccountsPort {
    private readonly facade: AccountsFacade;

    constructor(facade: AccountsFacade) {
        this.facade = facade;
    }

    async findRecipient(
        accountNumber: string,
    ): Promise<TransferRecipient | null> {
        const account = await this.facade.findByAccountNumber(accountNumber);

        if (account === null) {
            return null;
        }

        return {
            accountId: account.id,
            accountNumber: account.accountNumber,
            currency: account.currency,
            status: account.status,
        };
    }
}
