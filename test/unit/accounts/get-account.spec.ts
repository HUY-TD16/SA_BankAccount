import { GetAccountUseCase } from '@src/modules/accounts/application/use-cases/get-account.use-case';
import {
  fakeAccountRepository,
  makeAccount,
} from '../../helpers/fake-account-repository';

describe('GetAccountUseCase', () => {
  test('user A không đọc được account của B', async () => {
    const repo = fakeAccountRepository();
    const accountB = makeAccount({ userId: 'user-B' });
    repo.findById.mockResolvedValue(accountB);

    await expect(
      new GetAccountUseCase(repo).execute(
        'user-A',
        accountB.id,
      ),
    ).rejects.toMatchObject({
      errorCode: 'ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    });
  });

  test('account không tồn tại cũng trả cùng lỗi 404', async () => {
    const repo = fakeAccountRepository();
    repo.findById.mockResolvedValue(null);

    await expect(
      new GetAccountUseCase(repo).execute(
        'user-A',
        '550e8400-e29b-41d4-a716-446655440099',
      ),
    ).rejects.toMatchObject({
      errorCode: 'ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    });
  });

  test('chủ account đọc được account', async () => {
    const repo = fakeAccountRepository();
    const ownAccount = makeAccount({ userId: 'user-A' });
    repo.findById.mockResolvedValue(ownAccount);

    await expect(
      new GetAccountUseCase(repo).execute(
        'user-A',
        ownAccount.id,
      ),
    ).resolves.toEqual(ownAccount);
  });
});