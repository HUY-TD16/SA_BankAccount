export const TRANSACTION_QUERY = Symbol('TRANSACTION_QUERY');

export interface TransactionFilter {
  accountId: string;
  type?: 'CREDIT' | 'DEBIT';
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface TransactionItemDto {
  id: string;
  accountId: string;
  transferId: string | null;
  transactionType: string;
  referenceType: string;
  amount: string;
  balanceAfter: string;
  status: string;
  description: string | null;
  createdAt: string;
}

export interface PaginatedTransactionsResult {
  items: TransactionItemDto[];
  total: number;
}

export interface TransactionQueryPort {
  findAccountOwner(accountId: string): Promise<string | null>;
  findTransactions(filter: TransactionFilter): Promise<PaginatedTransactionsResult>;
}
