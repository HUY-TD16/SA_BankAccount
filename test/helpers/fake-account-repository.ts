import { Money } from '@src/common/domain/value-objects/money.value-object';
import type { AccountRepositoryPort } from '@src/modules/accounts/application/ports/account.repository.port';
import type { BankAccount } from '@src/modules/accounts/domain/entities/bank-account.entity';

export function fakeAccountRepository(): jest.Mocked<AccountRepositoryPort> {
  return {
    createWithOpeningDeposit: jest.fn(),
    findById: jest.fn(),
    findByAccountNumber: jest.fn(),
    listByOwner: jest.fn(),
  };
}

export function makeAccount(
  overrides: Partial<BankAccount> = {},
): BankAccount {
  return {
    id: '550e8400-e29b-41d4-a716-446655440010',
    userId: 'user-A',
    accountNumber: '001234567890',
    accountName: 'Tài khoản chính',
    accountType: 'PAYMENT',
    currentBalance: Money.zero(),
    currency: 'VND',
    status: 'ACTIVE',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    closedAt: null,
    ...overrides,
  };
}