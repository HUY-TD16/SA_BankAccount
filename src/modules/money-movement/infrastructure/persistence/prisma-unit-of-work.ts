import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@src/infrastructure/prisma";
import {
  AccountSnapshot,
  CreateTransactionEntryInput,
  CreateTransferInput,
  MoneyMovementTransactionContext,
  TransactionEntryRecord,
  TransferRecord,
  UnitOfWorkPort,
} from "../../application/ports/unit-of-work.port";


type PrismaTx = Prisma.TransactionClient;

interface RawAccountLockRow {
  id: string;
  userId: string;
  currentBalance: string;
  status: "ACTIVE" | "CLOSED";
}

@Injectable()
export class PrismaUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    work: (ctx: MoneyMovementTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const ctx = this.buildContext(tx);
      return work(ctx);
    });
  }

  private buildContext(tx: PrismaTx): MoneyMovementTransactionContext {
    return {
      accounts: {
        lockForUpdate: async (
          accountId: string,
        ): Promise<AccountSnapshot | null> => {
          const rows = await tx.$queryRaw<RawAccountLockRow[]>(
            Prisma.sql`
              SELECT  
                id,
                user_id AS "userId",
                current_balance::text AS "currentBalance",
                status  
              FROM bank_accounts
              WHERE id = ${accountId}
              FOR UPDATE
            `,
          );
          return rows[0] ?? null;
        },

        updateBalance: async (
          accountId: string,
          newBalance: string,
        ): Promise<void> => {
          await tx.bankAccount.update({
            where: { id: accountId },
            data: { currentBalance: newBalance },
          });
        },
      },

      transactions: {
        create: async (
          input: CreateTransactionEntryInput,
        ): Promise<TransactionEntryRecord> => {
          const record = await tx.financialTransaction.create({
            data: {
              accountId: input.accountId,
              transferId: input.transferId ?? null,
              transactionType: input.transactionType,
              referenceType: input.referenceType,
              amount: input.amount,
              balanceAfter: input.balanceAfter,
              description: input.description ?? null,
            },
          });
          return record as unknown as TransactionEntryRecord;
        },
      },

      transfers: {
        findBySourceAndIdempotencyKey: async (
          sourceAccountId: string,
          idempotencyKey: string,
        ): Promise<TransferRecord | null> => {
          const record = await tx.transfer.findUnique({
            where: {
              uq_transfer_idempotency: {
                sourceAccountId,
                idempotencyKey,
              },
            },
          });
          return record ? (record as unknown as TransferRecord) : null;
        },

        create: async (input: CreateTransferInput): Promise<TransferRecord> => {
          const record = await tx.transfer.create({
            data: {
              sourceAccountId: input.sourceAccountId,
              destinationAccountId: input.destinationAccountId,
              initiatedByUserId: input.initiatedByUserId,
              amount: input.amount,
              description: input.description ?? null,
              idempotencyKey: input.idempotencyKey,
            },
          });
          return record as unknown as TransferRecord;
        },
      },
    };
  }
}
