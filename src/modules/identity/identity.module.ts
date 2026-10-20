// src/modules/identity/identity.module.ts
import { Module } from "@nestjs/common";
import { TOKEN_SERVICE, type TokenServicePort } from "@src/common/security/ports";
import { AuthController } from "./presentation/http/auth.controller";
import { RegisterUserUseCase } from "./application/use-cases/register-user.use-case";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { USER_REPOSITORY, type UserRepositoryPort } from "./application/ports/user.repository.port";
import { PASSWORD_HASHER, type PasswordHasherPort } from "./application/ports/password-hasher.port";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma-user.repository";
import { BcryptPasswordHasher } from "./infrastructure/security/bcrypt-password-hasher";
import { JwtTokenService } from "./infrastructure/security/jwt-token.service";

@Module({
  // PrismaModule la @Global() nen khong can import lai o day.
  controllers: [AuthController],
  providers: [
    {
      provide: RegisterUserUseCase,
      useFactory: (repository: UserRepositoryPort, hasher: PasswordHasherPort) =>
        new RegisterUserUseCase(repository, hasher),
      inject: [USER_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: LoginUseCase,
      useFactory: (
        repository: UserRepositoryPort,
        hasher: PasswordHasherPort,
        tokens: TokenServicePort,
      ) => new LoginUseCase(repository, hasher, tokens),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TOKEN_SERVICE],
    },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    JwtTokenService,
    { provide: TOKEN_SERVICE, useExisting: JwtTokenService },
  ],
  // export TOKEN_SERVICE de AccessTokenGuard (dang ky global o app.module.ts) inject duoc
  exports: [TOKEN_SERVICE],
})
export class IdentityModule {}
