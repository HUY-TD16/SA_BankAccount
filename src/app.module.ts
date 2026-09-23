import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { IdentityModule } from "./modules/identity/identity.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { MoneyMovementModule } from "./modules/money-movement/money-movement.module";
import { AccessTokenGuard } from "./common/security/guards";
import { LoggerService } from "./common/observability";
import {
  validateEnv,
  appConfig,
  jwtConfig,
  databaseConfig,
} from "./common/config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig, jwtConfig, databaseConfig],
    }),
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
