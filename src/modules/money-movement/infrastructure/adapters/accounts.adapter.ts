import type {
    AccountsFacade,
} from '@src/modules/accounts/application/ports';

import type {
    AccountsPort,
    TransferRecipient,
} from '@src/modules/money-movement/application/ports';

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
