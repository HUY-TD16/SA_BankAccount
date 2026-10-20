import { describe, beforeEach, it, expect } from '@jest/globals';
import { FakeUnitOfWork } from '../helpers/fakes/fake-unit-of-work';
import { TransferMoneyUseCase } from '../../src/modules/money-movement/application/use-cases/transfer-money.use-case';
import { InsufficientFundsError, AccountNotFoundError } from '../../src/modules/money-movement/domain/errors';

describe('TransferMoneyUseCase (Unit Tests)', () => {
  let fakeUnitOfWork: FakeUnitOfWork;
  let useCase: TransferMoneyUseCase;

  beforeEach(() => {
    fakeUnitOfWork = new FakeUnitOfWork();
    useCase = new TransferMoneyUseCase(fakeUnitOfWork);

    fakeUnitOfWork.accountsDb.set('ACCOUNT_A', {
      id: 'ACCOUNT_A',
      userId: 'User_1',
      accountNumber: 'ACC_NUM_A',
      currentBalance: '50000',
      status: 'ACTIVE',
    });

    fakeUnitOfWork.accountsDb.set('ACCOUNT_B', {
      id: 'ACCOUNT_B',
      userId: 'User_2',
      accountNumber: 'ACC_NUM_B',
      currentBalance: '0',
      status: 'ACTIVE',
    });
  });

  it('should reject when balance is insufficient (InsufficientFundsError)', async () => {
    const request = {
      sourceAccountId: 'ACCOUNT_A',
      destinationAccountNumber: 'ACC_NUM_B',
      amount: '100000',
      idempotencyKey: 'idem-key-123',
      initiatedByUserId: 'User_1',
    };

    await expect(useCase.execute(request)).rejects.toThrow(InsufficientFundsError);
  });

  it('should reject when initiatedByUserId does not own source account (AccountNotFoundError)', async () => {
    const request = {
      sourceAccountId: 'ACCOUNT_A',
      destinationAccountNumber: 'ACC_NUM_B',
      amount: '10000',
      idempotencyKey: 'idem-key-456',
      initiatedByUserId: 'Wrong_Attacker_User',
    };

    await expect(useCase.execute(request)).rejects.toThrow(AccountNotFoundError);
  });

  it('should successfully transfer and handle idempotency replay', async () => {
    const request = {
      sourceAccountId: 'ACCOUNT_A',
      destinationAccountNumber: 'ACC_NUM_B',
      amount: '20000',
      idempotencyKey: 'idem-key-unique',
      initiatedByUserId: 'User_1',
    };

    const result1 = await useCase.execute(request);
    expect(result1.isReplay).toBe(false);
    expect(result1.transfer.amount).toBe('20000');
    expect(fakeUnitOfWork.accountsDb.get('ACCOUNT_A')?.currentBalance).toBe('30000');
    expect(fakeUnitOfWork.accountsDb.get('ACCOUNT_B')?.currentBalance).toBe('20000');

    const result2 = await useCase.execute(request);
    expect(result2.isReplay).toBe(true);
    expect(result2.transfer.id).toBe(result1.transfer.id);
    expect(fakeUnitOfWork.accountsDb.get('ACCOUNT_A')?.currentBalance).toBe('30000');
  });
});
