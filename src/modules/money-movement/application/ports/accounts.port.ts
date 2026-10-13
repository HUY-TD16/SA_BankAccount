import type { AccountStatus } from '../../../accounts/domain/enums/account-status';
export type { AccountStatus } from '../../../accounts/domain/enums/account-status';
export const ACCOUNT_FACADE = Symbol('ACCOUNT_FACADE');

export interface TransferRecipient {
  readonly accountId: string;
  readonly accountNumber: string;
  readonly currency: 'VND';
  readonly status: AccountStatus;
}

export interface AccountsPort {
  findRecipient(accountNumber: string): Promise<TransferRecipient | null>;
}
