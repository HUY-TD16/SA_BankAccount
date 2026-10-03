import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "@src/infrastructure/prisma";
import { IdentityModule } from "@src/modules/identity/identity.module";
import { AccountsModule } from "@src/modules/accounts/accounts.module";
import { MoneyMovementModule } from "@src/modules/money-movement/money-movement.module";
import { AccessTokenGuard } from "@src/common/security/guards";
import { LoggerService } from "@src/common/observability";
import {
  validateEnv,
  appConfig,
  jwtConfig,
  databaseConfig,
} from "@src/common/config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig, jwtConfig, databaseConfig],
    }),
    PrismaModule,
    IdentityModule,
    AccountsModule,
    MoneyMovementModule,
  ],
  providers: [
    LoggerService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
})
export class AppModule {}
