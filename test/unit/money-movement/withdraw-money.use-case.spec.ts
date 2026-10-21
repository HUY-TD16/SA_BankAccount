import { describe, beforeEach, it, expect } from '@jest/globals';
import { FakeUnitOfWork } from '../../helpers/fakes/fake-unit-of-work';
import { WithdrawMoneyUseCase } from '@src/modules/money-movement/application/use-cases/withdraw-money.use-case';
import { AccountNotFoundError, AccountClosedError, InsufficientFundsError } from '@src/modules/money-movement/domain/errors';

describe('WithdrawMoneyUseCase (Unit Tests)', () => {
  let fakeUnitOfWork: FakeUnitOfWork;
  let useCase: WithdrawMoneyUseCase;

  beforeEach(() => {
    fakeUnitOfWork = new FakeUnitOfWork();
    useCase = new WithdrawMoneyUseCase(fakeUnitOfWork);

    fakeUnitOfWork.accountsDb.set('ACC_1', {
      id: 'ACC_1',
      userId: 'USER_1',
      accountNumber: 'ACC_NUM_1',
      currentBalance: '100000',
      status: 'ACTIVE',
    });
  });

  it('rút tiền thành công: số dư giảm, ghi nhận giao dịch DEBIT CASH_WITHDRAWAL', async () => {
    const result = await useCase.execute({
      accountId: 'ACC_1',
      userId: 'USER_1',
      amount: '40000',
      description: 'Withdraw test',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.transactionType).toBe('DEBIT');
    expect(result.referenceType).toBe('CASH_WITHDRAWAL');
    expect(result.amount).toBe('40000');
    expect(result.balanceAfter).toBe('60000');
    expect(fakeUnitOfWork.accountsDb.get('ACC_1')?.currentBalance).toBe('60000');
    expect(fakeUnitOfWork.transactionsDb.size).toBe(1);
  });

  it('rút toàn bộ số dư về 0 thành công', async () => {
    const result = await useCase.execute({
      accountId: 'ACC_1',
      userId: 'USER_1',
      amount: '100000',
    });

    expect(result.balanceAfter).toBe('0');
    expect(fakeUnitOfWork.accountsDb.get('ACC_1')?.currentBalance).toBe('0');
  });

  it('ném InsufficientFundsError khi số dư không đủ', async () => {
    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'USER_1',
        amount: '150000',
      }),
    ).rejects.toThrow(InsufficientFundsError);
    expect(fakeUnitOfWork.accountsDb.get('ACC_1')?.currentBalance).toBe('100000');
  });

  it('ném AccountNotFoundError khi tài khoản không tồn tại', async () => {
    await expect(
      useCase.execute({
        accountId: 'NON_EXISTENT_ACC',
        userId: 'USER_1',
        amount: '10000',
      }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('ném AccountNotFoundError khi người dùng không sở hữu tài khoản (ownership check)', async () => {
    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'OTHER_USER',
        amount: '10000',
      }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('ném AccountClosedError khi tài khoản đã bị đóng (CLOSED)', async () => {
    fakeUnitOfWork.accountsDb.get('ACC_1')!.status = 'CLOSED';

    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'USER_1',
        amount: '10000',
      }),
    ).rejects.toThrow(AccountClosedError);
  });

  it('ném lỗi khi số tiền rút không hợp lệ (bằng 0 hoặc âm)', async () => {
    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'USER_1',
        amount: '0',
      }),
    ).rejects.toThrow('Amount must be greater than 0');
  });
});