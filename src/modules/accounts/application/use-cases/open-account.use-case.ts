import { ValidationError } from '@src/common/domain/errors/common.errors';
import { Money } from '@src/common/domain/value-objects/money.value-object';
import type { AccountRepositoryPort } from '../ports/account.repository.port';
import type { BankAccount } from '../../domain/entities/bank-account.entity';
import {
  ACCOUNT_TYPES,
  type AccountType,
} from '../../domain/enums/account-type';

export interface OpenAccountCommand {
  accountName: string;
  accountType: AccountType;
  initialDeposit: string;
}

const MAX_VND = 999_999_999_999_999_999n;

export class OpenAccountUseCase {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  async execute(
    currentUserId: string,
    command: OpenAccountCommand,
  ): Promise<BankAccount> {
    if (typeof command.accountName !== 'string') {
        throw new ValidationError([
            {
              field: 'accountName',
              reason: 'must_be_a_string',
            },
        ]);
    }
    const accountName = command.accountName.trim();

    if (accountName.length < 1 || accountName.length > 100) {
      throw new ValidationError([
        {
          field: 'accountName',
          reason: 'must_be_1_to_100_characters',
        },
      ]);
    }

    if (!ACCOUNT_TYPES.includes(command.accountType)) {
      throw new ValidationError([
        {
          field: 'accountType',
          reason: 'unsupported_account_type',
        },
      ]);
    }

    let initialDeposit: Money;

    try {
      initialDeposit = Money.fromString(command.initialDeposit);
    } catch {
      throw new ValidationError([
        {
          field: 'initialDeposit',
          reason: 'must_be_non_negative_integer_string',
        },
      ]);
    }

    if (BigInt(initialDeposit.toDecimalString()) > MAX_VND) {
      throw new ValidationError([
        {
          field: 'initialDeposit',
          reason: 'amount_out_of_range',
        },
      ]);
    }

    return this.accounts.createWithOpeningDeposit({
      userId: currentUserId,
      accountName,
      accountType: command.accountType,
      initialDeposit,
    });
  }
}