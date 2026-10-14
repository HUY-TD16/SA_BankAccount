import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type BankAccount as PrismaBankAccount,
} from '@prisma/client';
import { Money } from '@src/common/domain/value-objects/money.value-object';
import { PrismaService } from '@src/infrastructure/prisma/prisma.service';

import type {
  AccountPage,
  AccountRepositoryPort,
  CreateAccountInput,
} from '../../application/ports/account.repository.port';
import type {
  BankAccount,
} from '../../domain/entities/bank-account.entity';
import type {
  AccountStatus,
} from '../../domain/enums/account-status';

const MAX_NUMBER_ATTEMPTS = 5;

function generateAccountNumber(): string {
  return randomInt(0, 1_000_000_000_000)
    .toString()
    .padStart(12, '0');
}

function isAccountNumberConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  const targetText = Array.isArray(target)
    ? target.map(String).join(',')
    : String(target ?? '');

  return (
    targetText.includes('account_number') ||
    targetText.includes('accountNumber')
  );
}

@Injectable()
export class PrismaAccountRepository
  implements AccountRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async createWithOpeningDeposit(
    input: CreateAccountInput,
  ): Promise<BankAccount> {
    const amount = input.initialDeposit.toDecimalString();

    for (
      let attempt = 0;
      attempt < MAX_NUMBER_ATTEMPTS;
      attempt += 1
    ) {
      const accountNumber = generateAccountNumber();

      try {
        return await this.prisma.$transaction(async (tx) => {
          const record = await tx.bankAccount.create({
            data: {
              user: { connect: { id: input.userId } },
              accountNumber,
              accountName: input.accountName,
              accountType: input.accountType,
              currentBalance: amount,
              currency: 'VND',
              status: 'ACTIVE',
            },
          });

          if (input.initialDeposit.isPositive()) {
            await tx.financialTransaction.create({
              data: {
                account: { connect: { id: record.id } },
                transactionType: 'CREDIT',
                referenceType: 'OPENING_DEPOSIT',
                amount,
                balanceAfter: amount,
                status: 'COMPLETED',
              },
            });
          }

          return this.toDomain(record);
        });
      } catch (error) {
        if (
          isAccountNumberConflict(error) &&
          attempt < MAX_NUMBER_ATTEMPTS - 1
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('Could not generate a unique account number');
  }

  async findById(id: string): Promise<BankAccount | null> {
    const record = await this.prisma.bankAccount.findUnique({
      where: { id },
    });

    return record === null ? null : this.toDomain(record);
  }

  async findByAccountNumber(
    accountNumber: string,
  ): Promise<BankAccount | null> {
    const record = await this.prisma.bankAccount.findUnique({
      where: { accountNumber },
    });

    return record === null ? null : this.toDomain(record);
  }

  async listByOwner(
    userId: string,
    options: {
      status?: AccountStatus;
      page: number;
      limit: number;
    },
  ): Promise<AccountPage> {
    const where: Prisma.BankAccountWhereInput = {
      userId,
      ...(options.status === undefined
        ? {}
        : { status: options.status }),
    };

    const [records, total] = await Promise.all([
      this.prisma.bankAccount.findMany({
        where,
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.bankAccount.count({ where }),
    ]);

    return {
      items: records.map((record) => this.toDomain(record)),
      total,
    };
  }

  async closeIfZeroBalance(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.bankAccount.updateMany({
      where: {
        id,
        userId,
        status: 'ACTIVE',
        currentBalance: 0,
      },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  private toDomain(record: PrismaBankAccount): BankAccount {
    if (record.currency !== 'VND') {
      throw new Error('Unsupported account currency');
    }

    return {
      id: record.id,
      userId: record.userId,
      accountNumber: record.accountNumber,
      accountName: record.accountName,
      accountType: record.accountType,
      currentBalance: Money.fromString(
        record.currentBalance.toString(),
      ),
      currency: record.currency,
      status: record.status,
      createdAt: record.createdAt,
      closedAt: record.closedAt,
    };
  }
}
