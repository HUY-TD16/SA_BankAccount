import type { AccountStatus } from '../../domain/enums/account-status';

export type { AccountStatus } from '../../domain/enums/account-status';

export const ACCOUNTS_FACADE = Symbol('ACCOUNTS_FACADE');

export interface AccountLookupResult {
    readonly id: string;
    readonly accountNumber: string;
    readonly currency: 'VND';
    readonly status: AccountStatus;
}

export interface AccountsFacade {
    findByAccountNumber(accountNumber: string): Promise<AccountLookupResult | null>;
}
