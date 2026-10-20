import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/prisma';
import { 
  TransactionQueryPort, 
  TransactionFilter, 
  PaginatedTransactionsResult 
} from '../../application/ports/transaction-query.port';

@Injectable()
export class PrismaTransactionQuery implements TransactionQueryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAccountOwner(accountId: string): Promise<string | null> {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id: accountId },
      select: { userId: true },
    });
    return account ? account.userId : null;
  }

  async findTransactions(filter: TransactionFilter): Promise<PaginatedTransactionsResult> {
    const whereClause: Prisma.FinancialTransactionWhereInput = {
      accountId: filter.accountId,
    };

    if (filter.type) {
      whereClause.transactionType = filter.type;
    }

    if (filter.from || filter.to) {
      whereClause.createdAt = {};
      if (filter.from) {
        whereClause.createdAt.gte = filter.from;
      }
      if (filter.to) {
        whereClause.createdAt.lte = filter.to;
      }
    }

    const [total, records] = await Promise.all([
      this.prisma.financialTransaction.count({ where: whereClause }),
      this.prisma.financialTransaction.findMany({
        where: whereClause,
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
    ]);

    return {
      total,
      items: records.map((r) => ({
        id: r.id,
        accountId: r.accountId,
        transferId: r.transferId,
        transactionType: r.transactionType,
        referenceType: r.referenceType,
        amount: r.amount.toString(),
        balanceAfter: r.balanceAfter.toString(),
        status: r.status,
        description: r.description,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
