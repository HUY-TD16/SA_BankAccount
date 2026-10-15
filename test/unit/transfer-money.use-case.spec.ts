import { describe, beforeEach, it, expect } from '@jest/globals';
import { FakeUnitOfWork } from '../helpers/fakes/fake-unit-of-work';
import { TransferMoneyDto } from '../../src/modules/money-movement/presentation/http/dto/transfer-money.dto';
import { TransferMoneyUseCase } from '../../src/modules/money-movement/application/use-cases/transfer-money.use-case';

describe('TransferMoneyUseCase', () => {
  let fakeUnitOfWork: FakeUnitOfWork;
  let useCase: TransferMoneyUseCase;

  beforeEach(() => {
    fakeUnitOfWork = new FakeUnitOfWork();
    useCase = new TransferMoneyUseCase(fakeUnitOfWork);
  });

  it('InsufficientFundsError', async () => {
    fakeUnitOfWork.accountsDb.set('ACCOUNT_A', {
      id: 'ACCOUNT_A',
      userId: 'User_1',
      currentBalance: '50000',
      status: 'ACTIVE'
    });

    fakeUnitOfWork.accountsDb.set('ACCOUNT_B', {
      id: 'ACCOUNT_B',
      userId: 'User_2',
      currentBalance: '0',
      status: 'ACTIVE'
    });

    const request = {
      sourceAccountId: 'ACCOUNT_A',
      destinationAccountId: 'ACCOUNT_B',
      amount: '100000',
      idempotencyKey: 'idem-key-123',
      initiatedByUserId: 'User_1',
    };

    await expect(useCase.execute(request)).rejects.toThrow('InsufficientFundsError');
  })
});
