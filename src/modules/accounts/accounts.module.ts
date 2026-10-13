import { Module } from '@nestjs/common';

import {
  ACCOUNT_REPOSITORY,
  type AccountRepositoryPort,
} from './application/ports/account.repository.port';
import {
  ACCOUNTS_FACADE,
  type AccountsFacade,
} from './application/ports/accounts.facade';
import { GetAccountUseCase } from './application/use-cases/get-account.use-case';
import { ListAccountsUseCase } from './application/use-cases/list-accounts.use-case';
import { OpenAccountUseCase } from './application/use-cases/open-account.use-case';
import { AccountLookupFacade } from './infrastructure/adapters/account-lookup.facade';
import { PrismaAccountRepository } from './infrastructure/persistence/prisma-account.repository';
import { AccountsController } from './presentation/http/accounts.controller';

@Module({
  controllers: [AccountsController],
  providers: [
    PrismaAccountRepository,

    {
      provide: ACCOUNT_REPOSITORY,
      useExisting: PrismaAccountRepository,
    },

    {
      provide: OpenAccountUseCase,
      useFactory: (repository: AccountRepositoryPort) =>
        new OpenAccountUseCase(repository),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: ListAccountsUseCase,
      useFactory: (repository: AccountRepositoryPort) =>
        new ListAccountsUseCase(repository),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: GetAccountUseCase,
      useFactory: (repository: AccountRepositoryPort) =>
        new GetAccountUseCase(repository),
      inject: [ACCOUNT_REPOSITORY],
    },
    {
      provide: ACCOUNTS_FACADE,
      useFactory: (repository: AccountRepositoryPort): AccountsFacade =>
        new AccountLookupFacade(repository),
      inject: [ACCOUNT_REPOSITORY],
    },
  ],
  exports: [ACCOUNTS_FACADE],
})
export class AccountsModule {}