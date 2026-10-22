import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { describe, beforeAll, afterAll, afterEach, it, expect, jest } from '@jest/globals';

import type { LoggerService } from '@src/common/observability/logger.service';
import { PrismaService } from '@src/infrastructure/prisma/prisma.service';

import { PrismaUserRepository } from '@src/modules/identity/infrastructure/persistence/prisma-user.repository';
import { BcryptPasswordHasher } from '@src/modules/identity/infrastructure/security/bcrypt-password-hasher';
import { JwtTokenService } from '@src/modules/identity/infrastructure/security/jwt-token.service';
import { RegisterUserUseCase } from '@src/modules/identity/application/use-cases/register-user.use-case';
import { LoginUseCase } from '@src/modules/identity/application/use-cases/login.use-case';

import { PrismaAccountRepository } from '@src/modules/accounts/infrastructure/persistence/prisma-account.repository';
import { OpenAccountUseCase } from '@src/modules/accounts/application/use-cases/open-account.use-case';
import { CloseAccountUseCase } from '@src/modules/accounts/application/use-cases/close-account.use-case';
import { GetAccountUseCase } from '@src/modules/accounts/application/use-cases/get-account.use-case';
import { ListAccountsUseCase } from '@src/modules/accounts/application/use-cases/list-accounts.use-case';
import { AccountHasBalanceError } from '@src/modules/accounts/domain/errors/account-has-balance.error';

import { PrismaUnitOfWork } from '@src/modules/money-movement/infrastructure/persistence/prisma-unit-of-work';
import { PrismaTransactionQuery } from '@src/modules/money-movement/infrastructure/persistence/prisma-transaction-query';
import { DepositMoneyUseCase } from '@src/modules/money-movement/application/use-cases/deposit-money.use-case';
import { WithdrawMoneyUseCase } from '@src/modules/money-movement/application/use-cases/withdraw-money.use-case';
import { TransferMoneyUseCase } from '@src/modules/money-movement/application/use-cases/transfer-money.use-case';
import { GetTransactionHistoryUseCase } from '@src/modules/money-movement/application/use-cases/get-transaction-history.use-case';
import { AccountClosedError } from '@src/modules/money-movement/domain/errors';

loadEnv({ quiet: true });

describe('Full Banking Flow Integration Test (All Use Cases UC-01 to UC-08)', () => {
  let prisma: PrismaService;

  let registerUseCase: RegisterUserUseCase;
  let loginUseCase: LoginUseCase;
  let jwtTokenService: JwtTokenService;

  let openAccountUseCase: OpenAccountUseCase;
  let closeAccountUseCase: CloseAccountUseCase;
  let getAccountUseCase: GetAccountUseCase;
  let listAccountsUseCase: ListAccountsUseCase;

  let depositUseCase: DepositMoneyUseCase;
  let withdrawUseCase: WithdrawMoneyUseCase;
  let transferUseCase: TransferMoneyUseCase;
  let historyUseCase: GetTransactionHistoryUseCase;

  let testUserIds: string[] = [];

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

    const userRepository = new PrismaUserRepository(prisma);
    const passwordHasher = new BcryptPasswordHasher({ bcryptRounds: 4 } as any);
    jwtTokenService = new JwtTokenService({
      accessSecret: 'full-flow-integration-test-secret-min-32-chars!',
      accessTtl: '15m',
    } as any);
    registerUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
    loginUseCase = new LoginUseCase(userRepository, passwordHasher, jwtTokenService);

    const accountRepository = new PrismaAccountRepository(prisma);
    openAccountUseCase = new OpenAccountUseCase(accountRepository);
    closeAccountUseCase = new CloseAccountUseCase(accountRepository);
    getAccountUseCase = new GetAccountUseCase(accountRepository);
    listAccountsUseCase = new ListAccountsUseCase(accountRepository);

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

  it('xuyên suốt vòng đời ngân hàng: Đăng ký -> Đăng nhập -> Mở TK -> Nạp -> Rút -> Chuyển -> Lịch sử -> Đóng TK', async () => {
    // -------------------------------------------------------------------------
    // 1. UC-01 & UC-02: User 1 (Alice) đăng ký và đăng nhập
    // -------------------------------------------------------------------------
    const aliceEmail = `alice-${randomUUID()}@bank.test`;
    const aliceUser = await registerUseCase.execute({
      fullName: 'Alice Nguyen',
      email: aliceEmail,
      password: 'AlicePassword123!',
      confirmPassword: 'AlicePassword123!',
    });
    testUserIds.push(aliceUser.id);
    expect(aliceUser.id).toBeDefined();

    const aliceLogin = await loginUseCase.execute({
      email: aliceEmail,
      password: 'AlicePassword123!',
    });
    expect(aliceLogin.accessToken).toBeDefined();
    const aliceTokenPayload = await jwtTokenService.verifyAccessToken(aliceLogin.accessToken);
    expect(aliceTokenPayload.sub).toBe(aliceUser.id);

    // -------------------------------------------------------------------------
    // 2. UC-03 & UC-07: Alice mở tài khoản với nạp ban đầu 100k
    // -------------------------------------------------------------------------
    const aliceAccount = await openAccountUseCase.execute(aliceUser.id, {
      accountName: 'Alice Primary Account',
      accountType: 'PAYMENT',
      initialDeposit: '100000',
    });
    expect(aliceAccount.id).toBeDefined();
    expect(aliceAccount.currentBalance.toDecimalString()).toBe('100000');
    expect(aliceAccount.status).toBe('ACTIVE');

    const aliceAccountsList = await listAccountsUseCase.execute(aliceUser.id, { page: 1, limit: 10 });
    expect(aliceAccountsList.items).toHaveLength(1);
    expect(aliceAccountsList.items[0].id).toBe(aliceAccount.id);

    // -------------------------------------------------------------------------
    // 3. UC-01 & UC-03: User 2 (Bob) đăng ký và mở tài khoản 0đ
    // -------------------------------------------------------------------------
    const bobEmail = `bob-${randomUUID()}@bank.test`;
    const bobUser = await registerUseCase.execute({
      fullName: 'Bob Tran',
      email: bobEmail,
      password: 'BobPassword123!',
      confirmPassword: 'BobPassword123!',
    });
    testUserIds.push(bobUser.id);

    const bobAccount = await openAccountUseCase.execute(bobUser.id, {
      accountName: 'Bob Wallet Account',
      accountType: 'PAYMENT',
      initialDeposit: '0',
    });
    expect(bobAccount.currentBalance.toDecimalString()).toBe('0');

    // -------------------------------------------------------------------------
    // 4. UC-05: Alice nạp thêm 400k tiền mặt vào tài khoản
    // -------------------------------------------------------------------------
    const depositTx = await depositUseCase.execute({
      accountId: aliceAccount.id,
      userId: aliceUser.id,
      amount: '400000',
      description: 'Cash deposit at ATM',
    });
    expect(depositTx.balanceAfter).toBe('500000');
    expect(depositTx.transactionType).toBe('CREDIT');
    expect(depositTx.referenceType).toBe('CASH_DEPOSIT');

    // -------------------------------------------------------------------------
    // 5. UC-06: Alice rút 100k tiền mặt
    // -------------------------------------------------------------------------
    const withdrawTx = await withdrawUseCase.execute({
      accountId: aliceAccount.id,
      userId: aliceUser.id,
      amount: '100000',
      description: 'ATM withdrawal',
    });
    expect(withdrawTx.balanceAfter).toBe('400000');
    expect(withdrawTx.transactionType).toBe('DEBIT');
    expect(withdrawTx.referenceType).toBe('CASH_WITHDRAWAL');

    // -------------------------------------------------------------------------
    // 6. UC-08: Alice chuyển 250k sang tài khoản của Bob
    // -------------------------------------------------------------------------
    const transferResult = await transferUseCase.execute({
      sourceAccountId: aliceAccount.id,
      destinationAccountNumber: bobAccount.accountNumber,
      initiatedByUserId: aliceUser.id,
      amount: '250000',
      idempotencyKey: `flow-transfer-${randomUUID()}`,
      description: 'Alice pays Bob for lunch',
    });
    expect(transferResult.transfer).toBeDefined();

    const aliceAccAfterTransfer = await getAccountUseCase.execute(aliceUser.id, aliceAccount.id);
    const bobAccAfterTransfer = await getAccountUseCase.execute(bobUser.id, bobAccount.id);
    expect(aliceAccAfterTransfer.currentBalance.toDecimalString()).toBe('150000');
    expect(bobAccAfterTransfer.currentBalance.toDecimalString()).toBe('250000');

    // -------------------------------------------------------------------------
    // 7. Transaction History: Alice kiểm tra lịch sử giao dịch
    // -------------------------------------------------------------------------
    const history = await historyUseCase.execute({
      accountId: aliceAccount.id,
      userId: aliceUser.id,
      page: 1,
      limit: 10,
    });
    expect(history.total).toBe(4);
    // Bút toán: OPENING_DEPOSIT (100k) + CASH_DEPOSIT (400k) + CASH_WITHDRAWAL (100k) + TRANSFER_OUT (250k)
    const refTypes = history.items.map((i) => i.referenceType);
    expect(refTypes).toContain('OPENING_DEPOSIT');
    expect(refTypes).toContain('CASH_DEPOSIT');
    expect(refTypes).toContain('CASH_WITHDRAWAL');
    expect(refTypes).toContain('TRANSFER_OUT');

    // -------------------------------------------------------------------------
    // 8. UC-04: Alice thử đóng tài khoản khi còn số dư (150k) -> Bị từ chối
    // -------------------------------------------------------------------------
    await expect(
      closeAccountUseCase.execute(aliceUser.id, aliceAccount.id),
    ).rejects.toThrow(AccountHasBalanceError);

    // -------------------------------------------------------------------------
    // 9. UC-06: Alice rút nốt 150k về 0đ
    // -------------------------------------------------------------------------
    const finalWithdraw = await withdrawUseCase.execute({
      accountId: aliceAccount.id,
      userId: aliceUser.id,
      amount: '150000',
      description: 'Withdraw remaining balance before closing',
    });
    expect(finalWithdraw.balanceAfter).toBe('0');

    // -------------------------------------------------------------------------
    // 10. UC-04: Alice đóng tài khoản thành công khi số dư = 0đ
    // -------------------------------------------------------------------------
    await closeAccountUseCase.execute(aliceUser.id, aliceAccount.id);

    const closedAccount = await getAccountUseCase.execute(aliceUser.id, aliceAccount.id);
    expect(closedAccount.status).toBe('CLOSED');
    expect(closedAccount.closedAt).not.toBeNull();

    // -------------------------------------------------------------------------
    // 11. Hàng rào bảo mật: Không thể nạp tiền vào tài khoản đã đóng
    // -------------------------------------------------------------------------
    await expect(
      depositUseCase.execute({
        accountId: aliceAccount.id,
        userId: aliceUser.id,
        amount: '50000',
      }),
    ).rejects.toThrow(AccountClosedError);
  });
});
