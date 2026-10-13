import { ValidationError } from '@src/common/domain/errors/common.errors';
import type {
  AccountPage,
  AccountRepositoryPort,
} from '../ports/account.repository.port';
import {
  ACCOUNT_STATUSES,
  type AccountStatus,
} from '../../domain/enums/account-status';

export interface ListAccountsQuery {
  status?: AccountStatus;
  page?: number;
  limit?: number;
}

export class ListAccountsUseCase {
  constructor(private readonly accounts: AccountRepositoryPort) {}

  execute(
    currentUserId: string,
    query: ListAccountsQuery,
  ): Promise<AccountPage> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new ValidationError([
        {
          field: 'pagination',
          reason: 'invalid_page_or_limit',
        },
      ]);
    }

    if (
      query.status !== undefined &&
      !ACCOUNT_STATUSES.includes(query.status)
    ) {
      throw new ValidationError([
        {
          field: 'status',
          reason: 'unsupported_account_status',
        },
      ]);
    }

    return this.accounts.listByOwner(currentUserId, {
      status: query.status,
      page,
      limit,
    });
  }
}