// src/modules/identity/identity.module.ts
import { Module } from "@nestjs/common";
import { TOKEN_SERVICE } from "@src/common/security/ports";
import { AuthController } from "./presentation/http/auth.controller";
import { RegisterUserUseCase } from "./application/use-cases/register-user.use-case";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { USER_REPOSITORY } from "./application/ports/user.repository.port";
import { PASSWORD_HASHER } from "./application/ports/password-hasher.port";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma-user.repository";
import { BcryptPasswordHasher } from "./infrastructure/security/bcrypt-password-hasher";
import { JwtTokenService } from "./infrastructure/security/jwt-token.service";

@Module({
  // PrismaModule la @Global() nen khong can import lai o day.
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    JwtTokenService,
    { provide: TOKEN_SERVICE, useExisting: JwtTokenService },
  ],
  // export TOKEN_SERVICE de AccessTokenGuard (dang ky global o app.module.ts) inject duoc
  exports: [TOKEN_SERVICE],
})
export class IdentityModule {}
