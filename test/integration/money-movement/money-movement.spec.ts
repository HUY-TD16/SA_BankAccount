import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';

import type { LoggerService } from '@src/common/observability/logger.service';
import { PrismaService } from '@src/infrastructure/prisma/prisma.service';
import { PrismaUnitOfWork } from '@src/modules/money-movement/infrastructure/persistence/prisma-unit-of-work';
import { PrismaTransactionQuery } from '@src/modules/money-movement/infrastructure/persistence/prisma-transaction-query';
import { DepositMoneyUseCase } from '@src/modules/money-movement/application/use-cases/deposit-money.use-case';
import { WithdrawMoneyUseCase } from '@src/modules/money-movement/application/use-cases/withdraw-money.use-case';
import { TransferMoneyUseCase } from '@src/modules/money-movement/application/use-cases/transfer-money.use-case';
import { GetTransactionHistoryUseCase } from '@src/modules/money-movement/application/use-cases/get-transaction-history.use-case';
import { AccountNotFoundError, InsufficientFundsError } from '@src/modules/money-movement/domain/errors';

loadEnv({ quiet: true });

describe('Money Movement Integration Tests (Real Postgres)', () => {
  let prisma: PrismaService;
  let depositUseCase: DepositMoneyUseCase;
  let withdrawUseCase: WithdrawMoneyUseCase;
  let transferUseCase: TransferMoneyUseCase;
  let historyUseCase: GetTransactionHistoryUseCase;

  let testUserIds: string[] = [];
  let defaultUserId: string;

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

    const uow = new PrismaUnitOfWork(prisma);
    const queryPort = new PrismaTransactionQuery(prisma);

    depositUseCase = new DepositMoneyUseCase(uow);
    withdrawUseCase = new WithdrawMoneyUseCase(uow);
    transferUseCase = new TransferMoneyUseCase(uow);
    historyUseCase = new GetTransactionHistoryUseCase(queryPort);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  const createTestUser = async () => {
    const user = await prisma.user.create({
      data: {
        email: `mm-test-${randomUUID()}@bank.test`,
        fullName: 'Integration Test User',
        passwordHash: 'hashed_secret_password',
      },
    });
    testUserIds.push(user.id);
    return user;
  };

  const createTestAccount = async (userId: string, initialBalance = '0') => {
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const shortTimestamp = Date.now().toString().slice(-10);
    const accountNumber = `ACC${shortTimestamp}${randomSuffix}`;

    return prisma.bankAccount.create({
      data: {
        userId,
        accountNumber,
        accountName: 'Integration Test Account',
        accountType: 'PAYMENT',
        currentBalance: initialBalance,
        currency: 'VND',
        status: 'ACTIVE',
      },
    });
  };

  beforeEach(async () => {
    const user = await createTestUser();
    defaultUserId = user.id;
  });

  afterEach(async () => {
    if (!prisma || testUserIds.length === 0) return;

    const accounts = await prisma.bankAccount.findMany({
      where: { userId: { in: testUserIds } },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length > 0) {
      await prisma.financialTransaction.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.transfer.deleteMany({
        where: {
          OR: [
            { sourceAccountId: { in: accountIds } },
            { destinationAccountId: { in: accountIds } },
          ],
        },
      });
      await prisma.bankAccount.deleteMany({
        where: { id: { in: accountIds } },
      });
    }

    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
    testUserIds = [];
  });

  it('UC-05: nạp tiền thành công và ghi nhận bút toán CREDIT CASH_DEPOSIT', async () => {
    const account = await createTestAccount(defaultUserId, '0');
    await depositUseCase.execute({
      accountId: account.id,
      userId: defaultUserId,
      amount: '500000',
      description: 'Integration test deposit',
    });

    const updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account.id },
    });
    expect(updatedAccount?.currentBalance.toString()).toBe('500000');

    const transactions = await prisma.financialTransaction.findMany({
      where: { accountId: account.id },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].transactionType).toBe('CREDIT');
    expect(transactions[0].referenceType).toBe('CASH_DEPOSIT');
    expect(transactions[0].amount.toString()).toBe('500000');
    expect(transactions[0].balanceAfter.toString()).toBe('500000');
  });

  it('UC-06: rút tiền thành công và từ chối khi rút quá số dư', async () => {
    const account = await createTestAccount(defaultUserId, '500000');
    await withdrawUseCase.execute({
      accountId: account.id,
      userId: defaultUserId,
      amount: '200000',
      description: 'Valid withdrawal',
    });

    let updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account.id },
    });
    expect(updatedAccount?.currentBalance.toString()).toBe('300000');

    await expect(
      withdrawUseCase.execute({
        accountId: account.id,
        userId: defaultUserId,
        amount: '400000',
        description: 'Overdraft withdrawal',
      }),
    ).rejects.toThrow(InsufficientFundsError);

    updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account.id },
    });
    expect(updatedAccount?.currentBalance.toString()).toBe('300000');
  });

  it('UC-06: chống rút tiền thấu chi khi 2 request rút đồng thời', async () => {
    const account = await createTestAccount(defaultUserId, '100000');
    const results = await Promise.allSettled([
      withdrawUseCase.execute({
        accountId: account.id,
        userId: defaultUserId,
        amount: '100000',
        description: 'Concurrent withdrawal 1',
      }),
      withdrawUseCase.execute({
        accountId: account.id,
        userId: defaultUserId,
        amount: '100000',
        description: 'Concurrent withdrawal 2',
      }),
    ]);

    const fulfilledCount = results.filter((r) => r.status === 'fulfilled').length;
    const rejectedCount = results.filter((r) => r.status === 'rejected').length;
    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);

    const updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account.id },
    });
    expect(updatedAccount?.currentBalance.toString()).toBe('0');
  });

  it('UC-08: chống deadlock khi chuyển tiền hai chiều đồng thời (A->B và B->A)', async () => {
    const accountA = await createTestAccount(defaultUserId, '500000');
    const accountB = await createTestAccount(defaultUserId, '500000');

    await Promise.all([
      transferUseCase.execute({
        sourceAccountId: accountA.id,
        destinationAccountNumber: accountB.accountNumber,
        initiatedByUserId: defaultUserId,
        amount: '100000',
        idempotencyKey: 'idemp-deadlock-test-1',
        description: 'Transfer A to B 100k',
      }),
      transferUseCase.execute({
        sourceAccountId: accountB.id,
        destinationAccountNumber: accountA.accountNumber,
        initiatedByUserId: defaultUserId,
        amount: '200000',
        idempotencyKey: 'idemp-deadlock-test-2',
        description: 'Transfer B to A 200k',
      }),
    ]);

    const updatedA = await prisma.bankAccount.findUnique({ where: { id: accountA.id } });
    const updatedB = await prisma.bankAccount.findUnique({ where: { id: accountB.id } });
    expect(updatedA?.currentBalance.toString()).toBe('600000');
    expect(updatedB?.currentBalance.toString()).toBe('400000');

    const totalBalance = BigInt(updatedA!.currentBalance.toString()) + BigInt(updatedB!.currentBalance.toString());
    expect(totalBalance.toString()).toBe('1000000');
  });

  it('UC-08: chuyển tiền ghi nhận chính xác đúng 2 bút toán (DEBIT & CREDIT) có cùng transferId', async () => {
    const source = await createTestAccount(defaultUserId, '500000');
    const destination = await createTestAccount(defaultUserId, '100000');
    const idempotencyKey = `idemp-two-entries-${randomUUID()}`;

    const result = await transferUseCase.execute({
      sourceAccountId: source.id,
      destinationAccountNumber: destination.accountNumber,
      initiatedByUserId: defaultUserId,
      amount: '150000',
      idempotencyKey,
      description: 'Two entries test',
    });

    expect(result.transfer).toBeDefined();
    const transferId = result.transfer.id;

    const sourceTx = await prisma.financialTransaction.findMany({
      where: { accountId: source.id },
    });
    expect(sourceTx).toHaveLength(1);
    expect(sourceTx[0].transactionType).toBe('DEBIT');
    expect(sourceTx[0].referenceType).toBe('TRANSFER_OUT');
    expect(sourceTx[0].amount.toString()).toBe('150000');
    expect(sourceTx[0].balanceAfter.toString()).toBe('350000');
    expect(sourceTx[0].transferId).toBe(transferId);

    const destTx = await prisma.financialTransaction.findMany({
      where: { accountId: destination.id },
    });
    expect(destTx).toHaveLength(1);
    expect(destTx[0].transactionType).toBe('CREDIT');
    expect(destTx[0].referenceType).toBe('TRANSFER_IN');
    expect(destTx[0].amount.toString()).toBe('150000');
    expect(destTx[0].balanceAfter.toString()).toBe('250000');
    expect(destTx[0].transferId).toBe(transferId);
  });

  it('UC-08: đảm bảo idempotency replay kết quả giao dịch và không bị ghi đúp', async () => {
    const source = await createTestAccount(defaultUserId, '500000');
    const destination = await createTestAccount(defaultUserId, '0');
    const idempotencyKey = `idemp-retry-test-${randomUUID()}`;
    const command = {
      sourceAccountId: source.id,
      destinationAccountNumber: destination.accountNumber,
      initiatedByUserId: defaultUserId,
      amount: '150000',
      idempotencyKey,
      description: 'Idempotency integration test',
    };

    const firstResult = await transferUseCase.execute(command);
    expect(firstResult.isReplay).toBe(false);

    const secondResult = await transferUseCase.execute(command);
    expect(secondResult.isReplay).toBe(true);
    expect(secondResult.transfer.id).toBe(firstResult.transfer.id);

    const updatedSource = await prisma.bankAccount.findUnique({ where: { id: source.id } });
    const updatedDest = await prisma.bankAccount.findUnique({ where: { id: destination.id } });
    expect(updatedSource?.currentBalance.toString()).toBe('350000');
    expect(updatedDest?.currentBalance.toString()).toBe('150000');

    const records = await prisma.transfer.findMany({
      where: { idempotencyKey },
    });
    expect(records).toHaveLength(1);
  });

  it('UC-08: rollback dữ liệu khi giao dịch gặp lỗi giữa chừng, không lưu dở dang', async () => {
    const source = await createTestAccount(defaultUserId, '100000');
    const destination = await createTestAccount(defaultUserId, '50000');

    await expect(
      transferUseCase.execute({
        sourceAccountId: source.id,
        destinationAccountNumber: destination.accountNumber,
        initiatedByUserId: defaultUserId,
        amount: '200000',
        idempotencyKey: `idemp-rollback-${randomUUID()}`,
      }),
    ).rejects.toThrow(InsufficientFundsError);

    const checkSource = await prisma.bankAccount.findUnique({ where: { id: source.id } });
    const checkDest = await prisma.bankAccount.findUnique({ where: { id: destination.id } });
    expect(checkSource?.currentBalance.toString()).toBe('100000');
    expect(checkDest?.currentBalance.toString()).toBe('50000');

    const txCount = await prisma.financialTransaction.count({
      where: { accountId: { in: [source.id, destination.id] } },
    });
    expect(txCount).toBe(0);
  });

  it('UC-08: hai request cùng idempotency key gửi đồng thời chỉ thực thi một lần duy nhất', async () => {
    const source = await createTestAccount(defaultUserId, '500000');
    const destination = await createTestAccount(defaultUserId, '0');
    const sharedKey = `idemp-concurrent-${randomUUID()}`;

    const command = {
      sourceAccountId: source.id,
      destinationAccountNumber: destination.accountNumber,
      initiatedByUserId: defaultUserId,
      amount: '100000',
      idempotencyKey: sharedKey,
      description: 'Concurrent idempotency',
    };

    const results = await Promise.allSettled([
      transferUseCase.execute(command),
      transferUseCase.execute(command),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    expect(successes.length).toBeGreaterThanOrEqual(1);

    const updatedSource = await prisma.bankAccount.findUnique({ where: { id: source.id } });
    const updatedDest = await prisma.bankAccount.findUnique({ where: { id: destination.id } });
    expect(updatedSource?.currentBalance.toString()).toBe('400000');
    expect(updatedDest?.currentBalance.toString()).toBe('100000');

    const transfers = await prisma.transfer.findMany({
      where: { idempotencyKey: sharedKey },
    });
    expect(transfers).toHaveLength(1);
  });

  it('Transaction History: phân trang, lọc theo type và kiểm tra ownership', async () => {
    const account = await createTestAccount(defaultUserId, '0');

    await depositUseCase.execute({ accountId: account.id, userId: defaultUserId, amount: '100000' });
    await depositUseCase.execute({ accountId: account.id, userId: defaultUserId, amount: '200000' });
    await withdrawUseCase.execute({ accountId: account.id, userId: defaultUserId, amount: '50000' });

    const page1 = await historyUseCase.execute({
      accountId: account.id,
      userId: defaultUserId,
      page: 1,
      limit: 2,
    });
    expect(page1.total).toBe(3);
    expect(page1.items).toHaveLength(2);

    const credits = await historyUseCase.execute({
      accountId: account.id,
      userId: defaultUserId,
      page: 1,
      limit: 10,
      type: 'CREDIT',
    });
    expect(credits.total).toBe(2);
    expect(credits.items.every((tx) => tx.transactionType === 'CREDIT')).toBe(true);

    const otherUser = await createTestUser();
    await expect(
      historyUseCase.execute({
        accountId: account.id,
        userId: otherUser.id,
        page: 1,
        limit: 10,
      }),
    ).rejects.toThrow(AccountNotFoundError);
  });
});