import { Money } from '@src/common/domain/value-objects/money.value-object';
import { CloseAccountUseCase } from '@src/modules/accounts/application/use-cases/close-account.use-case';
import {
  fakeAccountRepository,
  makeAccount,
} from '../../helpers/fake-account-repository';

describe('CloseAccountUseCase', () => {
  test('chủ tài khoản đóng được account có số dư 0', async () => {
    const repo = fakeAccountRepository();
    const account = makeAccount();
    repo.findById.mockResolvedValue(account);
    repo.closeIfZeroBalance.mockResolvedValue(true);

    await expect(
      new CloseAccountUseCase(repo).execute('user-A', account.id),
    ).resolves.toBeUndefined();

    expect(repo.closeIfZeroBalance).toHaveBeenCalledWith(
      account.id,
      'user-A',
    );
  });

  test('account không tồn tại trả 404', async () => {
    const repo = fakeAccountRepository();
    repo.findById.mockResolvedValue(null);

    await expect(
      new CloseAccountUseCase(repo).execute('user-A', 'missing-id'),
    ).rejects.toMatchObject({
      errorCode: 'ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    });

    expect(repo.closeIfZeroBalance).not.toHaveBeenCalled();
  });

  test('user A không đóng được account của B', async () => {
    const repo = fakeAccountRepository();
    const accountB = makeAccount({ userId: 'user-B' });
    repo.findById.mockResolvedValue(accountB);

    await expect(
      new CloseAccountUseCase(repo).execute('user-A', accountB.id),
    ).rejects.toMatchObject({
      errorCode: 'ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    });

    expect(repo.closeIfZeroBalance).not.toHaveBeenCalled();
  });

  test('account còn tiền trả 409', async () => {
    const repo = fakeAccountRepository();
    const account = makeAccount({
      currentBalance: Money.fromString('500000'),
    });
    repo.findById.mockResolvedValue(account);

    await expect(
      new CloseAccountUseCase(repo).execute('user-A', account.id),
    ).rejects.toMatchObject({
      errorCode: 'ACCOUNT_HAS_BALANCE',
      httpStatus: 409,
    });

    expect(repo.closeIfZeroBalance).not.toHaveBeenCalled();
  });

  test('DELETE lặp lại trên account đã CLOSED trả thành công', async () => {
    const repo = fakeAccountRepository();
    const account = makeAccount({
      status: 'CLOSED',
      closedAt: new Date(),
    });
    repo.findById.mockResolvedValue(account);

    await expect(
      new CloseAccountUseCase(repo).execute('user-A', account.id),
    ).resolves.toBeUndefined();

    expect(repo.closeIfZeroBalance).not.toHaveBeenCalled();
  });

  test('nếu số dư đổi sau lần đọc đầu, trả 409', async () => {
    const repo = fakeAccountRepository();
    const account = makeAccount();

    repo.findById
      .mockResolvedValueOnce(account)
      .mockResolvedValueOnce(
        makeAccount({
          currentBalance: Money.fromString('1000'),
        }),
      );
    repo.closeIfZeroBalance.mockResolvedValue(false);

    await expect(
      new CloseAccountUseCase(repo).execute('user-A', account.id),
    ).rejects.toMatchObject({
      errorCode: 'ACCOUNT_HAS_BALANCE',
      httpStatus: 409,
    });
  });
});