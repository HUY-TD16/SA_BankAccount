export const UNIT_OF_WORK = Symbol("UNIT_OF_WORK");

export type TransactionType = "CREDIT" | "DEBIT";

export type TransactionReferenceType =
  | "OPENING_DEPOSIT"
  | "CASH_DEPOSIT"
  | "CASH_WITHDRAWAL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

/** Shape tối thiểu của account cần cho nạp/rút/transfer — không phải toàn bộ entity. */
export interface AccountSnapshot {
  id: string;
  userId: string;
  currentBalance: string; // string nguyên VND, không phải number — đúng quy ước Money
  status: "ACTIVE" | "CLOSED";
}

export interface CreateTransactionEntryInput {
  accountId: string;
  transferId?: string | null;
  transactionType: TransactionType;
  referenceType: TransactionReferenceType;
  amount: string;
  balanceAfter: string;
  description?: string | null;
}

export interface TransactionEntryRecord {
  id: string;
  accountId: string;
  transferId: string | null;
  transactionType: TransactionType;
  referenceType: TransactionReferenceType;
  amount: string;
  balanceAfter: string;
  status: string;
  description: string | null;
  createdAt: Date;
}

export interface CreateTransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  initiatedByUserId: string;
  amount: string;
  description?: string | null;
  idempotencyKey: string;
}

export interface TransferRecord {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  initiatedByUserId: string;
  amount: string;
  description: string | null;
  idempotencyKey: string;
  status: string;
  createdAt: Date;
}

/**
 * Context được cấp bên trong một database transaction đang chạy.
 * Use case chỉ được thao tác dữ liệu thông qua các method này.
 */
export interface MoneyMovementTransactionContext {
  accounts: {
    /** SELECT ... FOR UPDATE — khóa row, dùng trước mọi thao tác trừ/cộng tiền. */
    lockForUpdate(accountId: string): Promise<AccountSnapshot | null>;

    /** Cập nhật current_balance. Chỉ gọi sau khi đã lockForUpdate trong cùng transaction. */
    updateBalance(accountId: string, newBalance: string): Promise<void>;
  };

  transactions: {
    create(input: CreateTransactionEntryInput): Promise<TransactionEntryRecord>;
  };

  transfers: {
    /** Dùng để kiểm tra idempotency key trước khi tạo transfer mới. */
    findBySourceAndIdempotencyKey(
      sourceAccountId: string,
      idempotencyKey: string,
    ): Promise<TransferRecord | null>;

    create(input: CreateTransferInput): Promise<TransferRecord>;
  };
}

export interface UnitOfWorkPort {
  /**
   * Chạy `work` bên trong một database transaction duy nhất.
   * Nếu `work` throw (kể cả AppError nghiệp vụ như InsufficientFundsError),
   * toàn bộ thay đổi trong transaction phải rollback — implementation chịu
   * trách nhiệm đảm bảo điều này (PrismaUnitOfWork dựa vào prisma.$transaction
   * tự rollback khi promise reject).
   */
  execute<T>(
    work: (ctx: MoneyMovementTransactionContext) => Promise<T>,
  ): Promise<T>;
}
