import type {
    AccountsFacade,
} from '../../src/modules/accounts/application/ports/accounts.facade';

import {
    AccountsAdapter,
} from '../../src/modules/money-movement/infrastructure/adapters/accounts.adapter';

import {
    ResolveRecipientUseCase,
} from '../../src/modules/money-movement/application/use-cases/resolve-recipient.use-case';

describe('ResolveRecipientUseCase', () => {
    test('tra cứu qua adapter và giữ số 0 đầu tài khoản', async () => {
        const facade: AccountsFacade = {
            findByAccountNumber: jest.fn(async () => ({
                id: 10,
                accountNumber: '0012345678',
                currency: 'VND',
                status: 'ACTIVE' as const,
        })),
    };

    const useCase = new ResolveRecipientUseCase(
        new AccountsAdapter(facade),
    );

    const result = await useCase.execute(' 0012345678 ');

    expect(facade.findByAccountNumber).toHaveBeenCalledTimes(1);
    expect(facade.findByAccountNumber)
        .toHaveBeenCalledWith('0012345678');

    expect(result).toEqual({
        accountId: 10,
        accountNumber: '0012345678',
        currency: 'VND',
        status: 'ACTIVE',
    });
});

test('báo lỗi khi không tìm thấy tài khoản nhận', async () => {
    const facade: AccountsFacade = {
        findByAccountNumber: jest.fn(async () => null),
    };

    const useCase = new ResolveRecipientUseCase(
        new AccountsAdapter(facade),
    );

    await expect(
        useCase.execute('9999999999'),
    ).rejects.toThrow('RECIPIENT_NOT_FOUND');
});

test('không gọi port khi đầu vào chỉ có khoảng trắng', async () => {
    const accounts = {
        findRecipient: jest.fn(async () => null),
    };

    const useCase = new ResolveRecipientUseCase(accounts);

    await expect(
        useCase.execute('   '),
    ).rejects.toThrow('ACCOUNT_NUMBER_REQUIRED');

    expect(accounts.findRecipient).not.toHaveBeenCalled();
});

test('truyền nguyên lỗi hạ tầng lên phía gọi', async () => {
    const databaseError = new Error('Database unavailable');

    const facade: AccountsFacade = {
        findByAccountNumber: jest.fn(async () => {
            throw databaseError;
        }),
    };

    const useCase = new ResolveRecipientUseCase(
        new AccountsAdapter(facade),
    );

    await expect(
        useCase.execute('0012345678'),
    ).rejects.toBe(databaseError);
  });
});
