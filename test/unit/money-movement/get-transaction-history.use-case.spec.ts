import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { GetTransactionHistoryUseCase } from '@src/modules/money-movement/application/use-cases/get-transaction-history.use-case';
import { TransactionQueryPort } from '@src/modules/money-movement/application/ports/transaction-query.port';
import { AccountNotFoundError } from '@src/modules/money-movement/domain/errors';

describe('GetTransactionHistoryUseCase (Unit Tests)', () => {
  let queryPort: jest.Mocked<TransactionQueryPort>;
  let useCase: GetTransactionHistoryUseCase;

  beforeEach(() => {
    queryPort = {
      findAccountOwner: jest.fn(),
      findTransactions: jest.fn(),
    };
    useCase = new GetTransactionHistoryUseCase(queryPort);
  });

  it('lấy lịch sử giao dịch thành công khi user sở hữu tài khoản', async () => {
    queryPort.findAccountOwner.mockResolvedValue('USER_1');
    queryPort.findTransactions.mockResolvedValue({
      items: [
        {
          id: 'tx-1',
          accountId: 'ACC_1',
          transferId: null,
          transactionType: 'CREDIT',
          referenceType: 'CASH_DEPOSIT',
          amount: '100000',
          balanceAfter: '100000',
          status: 'SUCCESS',
          description: 'Initial deposit',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    });

    const result = await useCase.execute({
      accountId: 'ACC_1',
      userId: 'USER_1',
      page: 1,
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(queryPort.findTransactions).toHaveBeenCalledWith({
      accountId: 'ACC_1',
      type: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      limit: 10,
    });
  });

  it('truyền đầy đủ các bộ lọc (filter type, from, to) xuống port', async () => {
    queryPort.findAccountOwner.mockResolvedValue('USER_1');
    queryPort.findTransactions.mockResolvedValue({ items: [], total: 0 });

    const fromDate = new Date('2026-01-01');
    const toDate = new Date('2026-01-31');

    await useCase.execute({
      accountId: 'ACC_1',
      userId: 'USER_1',
      page: 2,
      limit: 20,
      type: 'DEBIT',
      from: fromDate,
      to: toDate,
    });

    expect(queryPort.findTransactions).toHaveBeenCalledWith({
      accountId: 'ACC_1',
      type: 'DEBIT',
      from: fromDate,
      to: toDate,
      page: 2,
      limit: 20,
    });
  });

  it('ném AccountNotFoundError khi tài khoản không tồn tại', async () => {
    queryPort.findAccountOwner.mockResolvedValue(null);

    await expect(
      useCase.execute({
        accountId: 'NON_EXISTENT_ACC',
        userId: 'USER_1',
        page: 1,
        limit: 10,
      }),
    ).rejects.toThrow(AccountNotFoundError);
    expect(queryPort.findTransactions).not.toHaveBeenCalled();
  });

  it('ném AccountNotFoundError khi user không phải chủ sở hữu tài khoản (ownership check)', async () => {
    queryPort.findAccountOwner.mockResolvedValue('USER_1');

    await expect(
      useCase.execute({
        accountId: 'ACC_1',
        userId: 'ATTACKER_USER',
        page: 1,
        limit: 10,
      }),
    ).rejects.toThrow(AccountNotFoundError);
    expect(queryPort.findTransactions).not.toHaveBeenCalled();
  });
});