import { ListAccountsUseCase } from '@src/modules/accounts/application/use-cases/list-accounts.use-case';
import {
  fakeAccountRepository,
  makeAccount,
} from '../../helpers/fake-account-repository';

describe('ListAccountsUseCase', () => {
  test('chỉ yêu cầu danh sách của user hiện tại', async () => {
    const repo = fakeAccountRepository();
    repo.listByOwner.mockResolvedValue({
      items: [makeAccount({ userId: 'user-A' })],
      total: 1,
    });

    const result = await new ListAccountsUseCase(repo).execute(
      'user-A',
      { status: 'ACTIVE', page: 2, limit: 10 },
    );

    expect(repo.listByOwner).toHaveBeenCalledWith('user-A', {
      status: 'ACTIVE',
      page: 2,
      limit: 10,
    });
    expect(result.total).toBe(1);
  });

  test('dùng page 1 và limit 20 khi thiếu query', async () => {
    const repo = fakeAccountRepository();
    repo.listByOwner.mockResolvedValue({
      items: [],
      total: 0,
    });

    await new ListAccountsUseCase(repo).execute('user-A', {});

    expect(repo.listByOwner).toHaveBeenCalledWith('user-A', {
      status: undefined,
      page: 1,
      limit: 20,
    });
  });
});