import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';
import { DepositMoneyUseCase } from '../../../src/modules/money-movement/application/use-cases/deposit-money.use-case';
import { WithdrawMoneyUseCase } from '../../../src/modules/money-movement/application/use-cases/withdraw-money.use-case';
import { TransferMoneyUseCase } from '../../../src/modules/money-movement/application/use-cases/transfer-money.use-case';

describe('Money Movement Integration Tests (Real Postgres)', () => {
  let prisma: PrismaService;
  let depositUseCase: DepositMoneyUseCase;
  let withdrawUseCase: WithdrawMoneyUseCase;
  let transferUseCase: TransferMoneyUseCase;
  let testUserId: string;
  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get<PrismaService>(PrismaService);
    depositUseCase = moduleRef.get<DepositMoneyUseCase>(DepositMoneyUseCase);
    withdrawUseCase = moduleRef.get<WithdrawMoneyUseCase>(WithdrawMoneyUseCase);
    transferUseCase = moduleRef.get<TransferMoneyUseCase>(TransferMoneyUseCase);
  });
  beforeEach(async () => {
    await prisma.financialTransaction.deleteMany();
    await prisma.transfer.deleteMany();
    await prisma.bankAccount.deleteMany();
    await prisma.user.deleteMany();
    const user = await prisma.user.create({
      data: {
        email: 'integration-test@bank.com',
        fullName: 'Integration Test User',
        passwordHash: 'hashed_secret_password',
      },
    });
    testUserId = user.id;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  it('should initialize IoC container and dependencies successfully', () => {
    expect(prisma).toBeDefined();
    expect(depositUseCase).toBeDefined();
    expect(withdrawUseCase).toBeDefined();
    expect(transferUseCase).toBeDefined();
    expect(testUserId).toBeDefined();
  });

  const createTestAccount = async (initialBalance = '0') => {
    return prisma.bankAccount.create({
      data: {
        userId: testUserId,
        accountNumber: `ACC_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        accountName: 'Integration Test Account',
        accountType: 'PAYMENT',
        currentBalance: initialBalance,
        currency: 'VND',
        status: 'ACTIVE',
      },
    });
  }
  
  it('UC-05: should deposit money successfully and record credit transaction', async () => {
    const account = await createTestAccount('0');
    await depositUseCase.execute({
      accountId: account.id,
      userId: testUserId,
      amount: '500000',
      description: 'Nạp tiền kiểm thử',
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

  it('UC-06: should withdraw money successfully and reject overdraft', async () => {
    const account = await createTestAccount('500000');
    await withdrawUseCase.execute({
      accountId: account.id,
      userId: testUserId,
      amount: '200000',
      description: 'Rút tiền hợp lệ',
    });

    let updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account.id },
    });
    expect(updatedAccount?.currentBalance.toString()).toBe('300000');
    await expect(
      withdrawUseCase.execute({
        accountId: account.id,
        userId: testUserId,
        amount: '400000',
        description: 'Rút quá số dư',
      }),
    ).rejects.toThrow();

    updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account.id },
    });
    expect(updatedAccount?.currentBalance.toString()).toBe('300000');
  });

  it('UC-06: should prevent overdraft when two concurrent withdrawals occur', async () => {
    const account = await createTestAccount('100000');
    const results = await Promise.allSettled([
      withdrawUseCase.execute({
        accountId: account.id,
        userId: testUserId,
        amount: '100000',
        description: 'Tiến trình rút 1',
      }),
      withdrawUseCase.execute({
        accountId: account.id,
        userId: testUserId,
        amount: '100000',
        description: 'Tiến trình rút 2',
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


  it('UC-08: should prevent deadlock when bidirectional concurrent transfers occur', async () => {
    const accountA = await createTestAccount('500000');
    const accountB = await createTestAccount('500000');
    await Promise.all([
      transferUseCase.execute({
        sourceAccountId: accountA.id,
        destinationAccountId: accountB.id,
        initiatedByUserId: testUserId,
        amount: '100000',
        idempotencyKey: 'idemp-deadlock-test-1',
        description: 'A chuyển B 100k',
      }),
      transferUseCase.execute({
        sourceAccountId: accountB.id,
        destinationAccountId: accountA.id,
        initiatedByUserId: testUserId,
        amount: '200000',
        idempotencyKey: 'idemp-deadlock-test-2',
        description: 'B chuyển A 200k',
      }),
    ]);

    const updatedA = await prisma.bankAccount.findUnique({ where: { id: accountA.id } });
    const updatedB = await prisma.bankAccount.findUnique({ where: { id: accountB.id } });
    expect(updatedA?.currentBalance.toString()).toBe('600000');
    expect(updatedB?.currentBalance.toString()).toBe('400000');


    const totalBalance = BigInt(updatedA!.currentBalance.toString()) + BigInt(updatedB!.currentBalance.toString());
    expect(totalBalance.toString()).toBe('1000000');
  });


  it('UC-08: should guarantee idempotency and not duplicate transfer on retry', async () => {
    const source = await createTestAccount('500000');
    const destination = await createTestAccount('0');
    const idempotencyKey = 'idemp-retry-test-unique-key-999';
    const command = {
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      initiatedByUserId: testUserId,
      amount: '150000',
      idempotencyKey: idempotencyKey,
      description: 'Chuyển tiền kiểm thử idempotency',
    };

    const firstResult = await transferUseCase.execute(command);
    expect(firstResult).toBeDefined();

    const secondResult = await transferUseCase.execute(command);
    expect(secondResult.id).toBe(firstResult.id);

    const updatedSource = await prisma.bankAccount.findUnique({ where: { id: source.id } });
    const updatedDest = await prisma.bankAccount.findUnique({ where: { id: destination.id } });
    expect(updatedSource?.currentBalance.toString()).toBe('350000');
    expect(updatedDest?.currentBalance.toString()).toBe('150000');

    const records = await prisma.transfer.findMany({
      where: { idempotencyKey: idempotencyKey },
    });
    expect(records).toHaveLength(1);
  });

});
