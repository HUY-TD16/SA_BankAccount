import { 
  TransactionQueryPort, 
  TransactionItemDto 
} from '../ports/transaction-query.port';
import { AccountNotFoundError } from '../../domain/errors';

export interface GetTransactionHistoryCommand {
  accountId: string;
  userId: string;
  page: number;
  limit: number;
  type?: 'CREDIT' | 'DEBIT';
  from?: Date;
  to?: Date;
}

export interface GetTransactionHistoryResult {
  items: TransactionItemDto[];
  total: number;
  page: number;
  limit: number;
}

export class GetTransactionHistoryUseCase {
  constructor(
    private readonly queryPort: TransactionQueryPort,
  ) {}

  async execute(command: GetTransactionHistoryCommand): Promise<GetTransactionHistoryResult> {
    const ownerUserId = await this.queryPort.findAccountOwner(command.accountId);
    if (!ownerUserId || ownerUserId !== command.userId) {
      throw new AccountNotFoundError('Account not found');
    }

    const result = await this.queryPort.findTransactions({
      accountId: command.accountId,
      type: command.type,
      from: command.from,
      to: command.to,
      page: command.page,
      limit: command.limit,
    });

    return {
      items: result.items,
      total: result.total,
      page: command.page,
      limit: command.limit,
    };
  }
}
