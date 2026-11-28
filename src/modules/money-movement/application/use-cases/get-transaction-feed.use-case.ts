import { ValidationError } from '../../../../common/domain/errors/common.errors';
import { AccountNotFoundError } from '../../domain/errors';
import {
  TransactionFeedFilter,
  TransactionFeedQueryPort,
  TransactionFeedResult,
} from '../ports/transaction-query.port';

export type GetTransactionFeedCommand = TransactionFeedFilter & {
  userId: string;
};

/** Sequential history browsing without OFFSET or total COUNT on each page. */
export class GetTransactionFeedUseCase {
  constructor(private readonly query: TransactionFeedQueryPort) {}

  async execute(command: GetTransactionFeedCommand): Promise<TransactionFeedResult> {
    const ownerUserId = await this.query.findAccountOwner(command.accountId);
    if (!ownerUserId || ownerUserId !== command.userId) {
      throw new AccountNotFoundError('Account not found');
    }

    if (command.from && command.to && command.from > command.to) {
      throw new ValidationError([{ field: 'from', reason: 'must_not_exceed_to' }]);
    }

    return this.query.findTransactionFeed(command);
  }
}
