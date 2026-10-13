import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';

import { Money } from '@src/common/domain/value-objects/money.value-object';
import type { LoggerService } from '@src/common/observability/logger.service';
import { PrismaService } from '@src/infrastructure/prisma/prisma.service';
import { PrismaAccountRepository } from '@src/modules/accounts/infrastructure/persistence/prisma-account.repository';

let prisma: PrismaService;
let repository: PrismaAccountRepository;
let testUserIds: string[] = [];

loadEnv({ quiet: true });

async function createTestUser() {
  const user = await prisma.user.create({
    data: {
      email: `account-${randomUUID()}@example.test`,
      fullName: 'Integration Test User',
      passwordHash: 'test-only',
    },
  });

  testUserIds.push(user.id);
  return user;
}

beforeAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for integration tests');
  }

  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));

  if (!databaseName.endsWith('_test')) {
    throw new Error('Integration tests require a dedicated *_test database');
  }

  const config = {
    getOrThrow: (_key: string) => databaseUrl,
  } as unknown as ConfigService;
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
  } as unknown as LoggerService;

  prisma = new PrismaService(config, logger);
  await prisma.$connect();
  repository = new PrismaAccountRepository(prisma);
});

afterEach(async () => {
  if (!prisma || testUserIds.length === 0) {
    return;
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { userId: { in: testUserIds } },
    select: { id: true },
  });
  const accountIds = accounts.map((account) => account.id);

  await prisma.financialTransaction.deleteMany({
    where: { accountId: { in: accountIds } },
  });
  await prisma.bankAccount.deleteMany({
    where: { userId: { in: testUserIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: testUserIds } },
  });

  testUserIds = [];
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

describe('PrismaAccountRepository with PostgreSQL', () => {
  it('persists the account and its opening deposit transaction', async () => {
    const user = await createTestUser();

    const account = await repository.createWithOpeningDeposit({
      userId: user.id,
      accountName: 'Payment account',
      accountType: 'PAYMENT',
      initialDeposit: Money.fromString('500000'),
    });

    expect(account.userId).toBe(user.id);
    expect(account.currentBalance.toDecimalString()).toBe('500000');

    const storedAccount = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(storedAccount.currentBalance.toString()).toBe('500000');

    const transactions = await prisma.financialTransaction.findMany({
      where: { accountId: account.id },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      transactionType: 'CREDIT',
      referenceType: 'OPENING_DEPOSIT',
      status: 'COMPLETED',
    });
    expect(transactions[0].amount.toString()).toBe('500000');
    expect(transactions[0].balanceAfter.toString()).toBe('500000');
  });

  it('does not create an opening deposit transaction for a zero balance', async () => {
    const user = await createTestUser();

    const account = await repository.createWithOpeningDeposit({
      userId: user.id,
      accountName: 'Savings account',
      accountType: 'SAVINGS',
      initialDeposit: Money.zero(),
    });

    expect(account.currentBalance.toDecimalString()).toBe('0');
    expect(
      await prisma.financialTransaction.count({
        where: { accountId: account.id },
      }),
    ).toBe(0);
  });

  it('reads by id and account number, and lists only the owner accounts', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    const accountA1 = await repository.createWithOpeningDeposit({
      userId: userA.id,
      accountName: 'A1',
      accountType: 'PAYMENT',
      initialDeposit: Money.zero(),
    });
    const accountA2 = await repository.createWithOpeningDeposit({
      userId: userA.id,
      accountName: 'A2',
      accountType: 'SAVINGS',
      initialDeposit: Money.zero(),
    });
    const accountB = await repository.createWithOpeningDeposit({
      userId: userB.id,
      accountName: 'B1',
      accountType: 'PAYMENT',
      initialDeposit: Money.zero(),
    });

    const firstPage = await repository.listByOwner(userA.id, {
      page: 1,
      limit: 1,
    });
    const secondPage = await repository.listByOwner(userA.id, {
      page: 2,
      limit: 1,
    });
    const listedIds = [...firstPage.items, ...secondPage.items]
      .map((item) => item.id)
      .sort();

    expect(firstPage.total).toBe(2);
    expect(firstPage.items).toHaveLength(1);
    expect(secondPage.items).toHaveLength(1);
    expect(listedIds).toEqual([accountA1.id, accountA2.id].sort());
    expect(listedIds).not.toContain(accountB.id);

    expect((await repository.findById(accountA1.id))?.userId).toBe(userA.id);
    expect(
      (await repository.findByAccountNumber(accountA1.accountNumber))?.id,
    ).toBe(accountA1.id);
    expect(await repository.findById(randomUUID())).toBeNull();

    await prisma.bankAccount.update({
      where: { id: accountA2.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    const activeAccounts = await repository.listByOwner(userA.id, {
      status: 'ACTIVE',
      page: 1,
      limit: 10,
    });
    expect(activeAccounts.total).toBe(1);
    expect(activeAccounts.items.map((item) => item.id)).toEqual([
      accountA1.id,
    ]);
  });
});
