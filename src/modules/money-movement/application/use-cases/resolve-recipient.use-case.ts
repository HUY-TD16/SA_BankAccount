import type {
    AccountsPort,
    TransferRecipient,
} from '../ports/accounts.port';

export class ResolveRecipientUseCase {
    private readonly accounts: AccountsPort;

    constructor(accounts: AccountsPort) {
        this.accounts = accounts;
    }

    async execute(accountNumber: string): Promise<TransferRecipient> {
        const normalizedNumber = accountNumber.trim();

        if (normalizedNumber.length === 0) {
            throw new Error('ACCOUNT_NUMBER_REQUIRED');
        }

        const recipient = await this.accounts.findRecipient(normalizedNumber);

        if (recipient === null) {
            throw new Error('RECIPIENT_NOT_FOUND');
        }

        return recipient;
    }
}
 
