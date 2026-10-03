export type AccountStatus = 'ACTIVE' | 'CLOSED';

export interface AccountLookupResult {
    readonly id: string;
    readonly accountNumber: string;
    readonly currency: 'VND';
    readonly status: AccountStatus;
}

export interface AccountsFacade {
    findByAccountNumber(accountNumber: string): Promise<AccountLookupResult | null>;
}
