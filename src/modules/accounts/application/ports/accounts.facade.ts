export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface AccountLookupResult {
    readonly id: number;
    readonly accountNumber: string;
    readonly currency: string;
    readonly status: AccountStatus;
}

export interface AccountsFacade {
    findByAccountNumber(accountNumber: string): Promise<AccountLookupResult | null>;
}

