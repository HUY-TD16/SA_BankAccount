import { Money } from '@src/common/domain/value-objects/money.value-object';
import { OpenAccountUseCase } from '@src/modules/accounts/application/use-cases/open-account.use-case';
import {
  fakeAccountRepository,
  makeAccount,
} from '../../helpers/fake-account-repository';

describe('OpenAccountUseCase', () => {
  test('tạo account cho user hiện tại và giữ nguyên số tiền', async () => {
    const repo = fakeAccountRepository();
    repo.createWithOpeningDeposit.mockResolvedValue(
      makeAccount({
        currentBalance: Money.fromString('500000'),
      }),
    );

    await new OpenAccountUseCase(repo).execute('user-A', {
      accountName: '  Tài khoản chính  ',
      accountType: 'PAYMENT',
      initialDeposit: '500000',
    });

    expect(repo.createWithOpeningDeposit).toHaveBeenCalledWith({
      userId: 'user-A',
      accountName: 'Tài khoản chính',
      accountType: 'PAYMENT',
      initialDeposit: Money.fromString('500000'),
    });
  });

  test.each(['-1', '1.5', '', 'abc'])(
    'từ chối initialDeposit không hợp lệ: %s',
    async (initialDeposit) => {
      const repo = fakeAccountRepository();

      await expect(
        new OpenAccountUseCase(repo).execute('user-A', {
          accountName: 'Tài khoản chính',
          accountType: 'PAYMENT',
          initialDeposit,
        }),
      ).rejects.toMatchObject({ httpStatus: 400 });

      expect(repo.createWithOpeningDeposit).not.toHaveBeenCalled();
    },
  );

  test('cho phép initialDeposit bằng 0', async () => {
    const repo = fakeAccountRepository();
    repo.createWithOpeningDeposit.mockResolvedValue(makeAccount());

    await new OpenAccountUseCase(repo).execute('user-A', {
      accountName: 'Tài khoản chính',
      accountType: 'PAYMENT',
      initialDeposit: '0',
    });

    expect(repo.createWithOpeningDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        initialDeposit: Money.zero(),
      }),
    );
  });
});