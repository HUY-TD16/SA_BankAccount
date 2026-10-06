import { 
  UnitOfWorkPort, 
  MoneyMovementTransactionContext, 
  AccountSnapshot,
  TransferRecord,
  TransactionEntryRecord  
} from '../../../src/modules/money-movement/application/ports/unit-of-work.port';

export class FakeUnitOfWork implements UnitOfWorkPort {
    public accountsDb = new Map<string, AccountSnapshot>();
    public transfersDb = new Map<string, TransferRecord>();
    public transactionsDb = new Map<string, TransactionEntryRecord>();

    async execute<T>(
        work: (ctx: MoneyMovementTransactionContext) => Promise<T>
    ): Promise<T> {
      const ctx: MoneyMovementTransactionContext = {
        accounts: {
          lockForUpdate: async (accountId) => {
            return this.accountsDb.get(accountId) || null;
          },
          updateBalance: async(accountId, newBalance) => {
            const acc = this.accountsDb.get(accountId);
            if (acc) {
              acc.currentBalance = newBalance;
            }
          }
        },
        transactions: {
          create: async (input) => {
            const record: TransactionEntryRecord  = { 
              ...input, 
              id: 'tx-' + Math.random(), 
              status: 'SUCCESS', 
              createdAt: new Date(),
              transferId: input.transferId ?? null,
              description: input.description ?? null
            };
            this.transactionsDb.set(record.id, record);
            return record;
          }
        },
        transfers: {
          findBySourceAndIdempotencyKey: async (sourceAccountId, idempotencyKey) => {
            for (const transfer of this.transfersDb.values()) {
              if (transfer.sourceAccountId === sourceAccountId && transfer.idempotencyKey === idempotencyKey) {
                return transfer;
              }
            }
            return null;
          },
          create: async (input) => {
            const record: TransferRecord = {
              ...input, 
              id: 'tf' + Math.random(),
              status: 'COMPLETED',
              createdAt: new Date(),
              description: input.description ?? null
            };
            this.transfersDb.set(record.id, record);
            return record;
          }
        }
      }

      return await work(ctx);
    }
}
