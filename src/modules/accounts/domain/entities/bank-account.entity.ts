import { Money } from '@src/common/domain/value-objects/money.value-object';
import type { AccountType } from '../enums/account-type';
import type { AccountStatus } from '../enums/account-status';

export interface BankAccount {
    readonly id: string;
    readonly userId: string;
    readonly accountNumber: string;
    readonly accountName: string;
    readonly accountType: AccountType;
    readonly currentBalance: Money;
    readonly currency: 'VND';
    readonly status: AccountStatus;
    readonly createdAt: Date;
    readonly closedAt: Date | null;
}