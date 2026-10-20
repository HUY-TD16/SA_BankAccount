import { describe, beforeEach, it, expect } from '@jest/globals';
import { FakeUnitOfWork } from '../helpers/fakes/fake-unit-of-work';
import { TransferMoneyUseCase } from '../../src/modules/money-movement/application/use-cases/transfer-money.use-case';
import { InsufficientFundsError, AccountNotFoundError, AccountClosedError } from '../../src/modules/money-movement/domain/errors';

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

  const request = {
    sourceAccountId: 'ACCOUNT_A',
    destinationAccountNumber: 'ACC_NUM_B',
    amount: '50000',
    idempotencyKey: 'closed-account-replay',
    initiatedByUserId: 'User_1',
  };

  it('returns 404 for a closed destination without changing balances or history', async () => {
    fakeUnitOfWork.accountsDb.get('ACCOUNT_B')!.status = 'CLOSED';

    await expect(useCase.execute(request)).rejects.toMatchObject({
      errorCode: 'ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    });
    expect(fakeUnitOfWork.accountsDb.get('ACCOUNT_A')!.currentBalance).toBe('50000');
    expect(fakeUnitOfWork.accountsDb.get('ACCOUNT_B')!.currentBalance).toBe('0');
    expect(fakeUnitOfWork.transfersDb.size).toBe(0);
    expect(fakeUnitOfWork.transactionsDb.size).toBe(0);
  });

  it('replays a completed transfer after the source closes without writing again', async () => {
    const original = await useCase.execute(request);
    fakeUnitOfWork.accountsDb.get('ACCOUNT_A')!.status = 'CLOSED';

    await expect(useCase.execute(request)).resolves.toEqual({
      transfer: original.transfer,
      isReplay: true,
    });
    expect(fakeUnitOfWork.accountsDb.get('ACCOUNT_A')!.currentBalance).toBe('0');
    expect(fakeUnitOfWork.accountsDb.get('ACCOUNT_B')!.currentBalance).toBe('50000');
    expect(fakeUnitOfWork.transfersDb.size).toBe(1);
    expect(fakeUnitOfWork.transactionsDb.size).toBe(2);
  });

  it('still rejects a new key when the source is closed', async () => {
    await useCase.execute(request);
    fakeUnitOfWork.accountsDb.get('ACCOUNT_A')!.status = 'CLOSED';

    await expect(useCase.execute({
      ...request, idempotencyKey: 'new-key',
    })).rejects.toThrow(AccountClosedError);
    expect(fakeUnitOfWork.transfersDb.size).toBe(1);
    expect(fakeUnitOfWork.transactionsDb.size).toBe(2);
  });

  it('does not expose a previous transfer to someone who does not own the source', async () => {
    await useCase.execute(request);
    fakeUnitOfWork.accountsDb.get('ACCOUNT_A')!.status = 'CLOSED';

    await expect(useCase.execute({
      ...request, initiatedByUserId: 'Wrong_Attacker_User',
    })).rejects.toMatchObject({
      errorCode: 'ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    });
    expect(fakeUnitOfWork.transfersDb.size).toBe(1);
    expect(fakeUnitOfWork.transactionsDb.size).toBe(2);
  });
});
