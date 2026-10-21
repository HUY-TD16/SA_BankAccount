import { describe, beforeEach, it, expect } from '@jest/globals';
import { FakeUnitOfWork } from '../../helpers/fakes/fake-unit-of-work';
import { DepositMoneyUseCase } from '@src/modules/money-movement/application/use-cases/deposit-money.use-case';
import { AccountNotFoundError, AccountClosedError } from '@src/modules/money-movement/domain/errors';
import { ValidationError } from '@src/common/domain/errors/common.errors';

describe('DepositMoneyUseCase (Unit Tests)', () => {
  let fakeUnitOfWork: FakeUnitOfWork;
  let useCase: DepositMoneyUseCase;

  beforeEach(() => {
    fakeUnitOfWork = new FakeUnitOfWork();
    useCase = new DepositMoneyUseCase(fakeUnitOfWork);

    fakeUnitOfWork.accountsDb.set('ACC_1', {
      id: 'ACC_1',
      userId: 'USER_1',
      accountNumber: 'ACC_NUM_1',
      currentBalance: '100000',
      status: 'ACTIVE',
    });
  });

  it('nạp tiền thành công: số dư tăng, ghi nhận giao dịch CREDIT CASH_DEPOSIT', async () => {
    const result = await useCase.execute({
      accountId: 'ACC_1',
      userId: 'USER_1',
      amount: '50000',
      description: 'Deposit test',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.transactionType).toBe('CREDIT');
    expect(result.referenceType).toBe('CASH_DEPOSIT');
    expect(result.amount).toBe('50000');
    expect(result.balanceAfter).toBe('150000');
    expect(fakeUnitOfWork.accountsDb.get('ACC_1')?.currentBalance).toBe('150000');
    expect(fakeUnitOfWork.transactionsDb.size).toBe(1);
  });

  it('ném AccountNotFoundError khi tài khoản không tồn tại', async () => {
    await expect(
      useCase.execute({
        accountId: 'NON_EXISTENT_ACC',
        userId: 'USER_1',
        amount: '50000',
      }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('ném AccountNotFoundError khi người dùng không sở hữu tài khoản (ownership check)', async () => {
    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'OTHER_USER',
        amount: '50000',
      }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('ném AccountClosedError khi tài khoản đã bị đóng (CLOSED)', async () => {
    fakeUnitOfWork.accountsDb.get('ACC_1')!.status = 'CLOSED';

    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'USER_1',
        amount: '50000',
      }),
    ).rejects.toThrow(AccountClosedError);
  });

  it('ném lỗi khi số tiền nạp không hợp lệ (bằng 0 hoặc âm)', async () => {
    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'USER_1',
        amount: '0',
      }),
    ).rejects.toThrow('Amount must be greater than 0');
  });

  it('ném ValidationError khi số dư sau cộng vượt quá NUMERIC(18,0)', async () => {
    fakeUnitOfWork.accountsDb.get('ACC_1')!.currentBalance = '999999999999999999';

    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'USER_1',
        amount: '1',
      }),
    ).rejects.toThrow(ValidationError);
  });
});