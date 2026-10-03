import { Money } from '@src/common/domain/value-objects/money.value-object';
import type { BankAccount } from '../../domain/entities/bank-account.entity';
import type { AccountType } from '../../domain/enums/account-type';
import type { AccountStatus } from '../../domain/enums/account-status';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export interface CreateAccountInput {
    readonly userId: string;
    readonly accountNumber: string;
    readonly accountType: AccountType;
    initialDeposit: Money;
}

export interface AccountPage {
    items: BankAccount[];
    total: number;
}

export interface AccountRepositoryPort {
    createWithOpeningDeposit(input: CreateAccountInput): Promise<BankAccount>;

    findById(id: string): Promise<BankAccount | null>;

    findByAccountNumber(accountNumber: string): Promise<BankAccount | null>;

    listByAccountNumber(accountNumber: string): Promise<BankAccount | null>;

    listByOwner(userId: string,
                options: {
                    status?: AccountStatus;
                    page?: number;
                    limit?: number;
                },
            ): Promise<AccountPage>;
}