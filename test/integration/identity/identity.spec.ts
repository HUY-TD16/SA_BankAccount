import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { describe, beforeAll, afterAll, afterEach, it, expect, jest } from '@jest/globals';

import type { LoggerService } from '@src/common/observability/logger.service';
import { PrismaService } from '@src/infrastructure/prisma/prisma.service';
import { PrismaUserRepository } from '@src/modules/identity/infrastructure/persistence/prisma-user.repository';
import { BcryptPasswordHasher } from '@src/modules/identity/infrastructure/security/bcrypt-password-hasher';
import { JwtTokenService } from '@src/modules/identity/infrastructure/security/jwt-token.service';
import { RegisterUserUseCase } from '@src/modules/identity/application/use-cases/register-user.use-case';
import { LoginUseCase } from '@src/modules/identity/application/use-cases/login.use-case';
import { EmailAlreadyExistsError, InvalidCredentialsError } from '@src/modules/identity/domain/errors';
import { ValidationError } from '@src/common/domain/errors';

loadEnv({ quiet: true });

describe('Identity Module Integration Tests (Real Postgres)', () => {
  let prisma: PrismaService;
  let registerUseCase: RegisterUserUseCase;
  let loginUseCase: LoginUseCase;
  let jwtTokenService: JwtTokenService;
  let testUserIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for integration tests');
    }

    const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
    if (!databaseName.endsWith('_test')) {
      throw new Error('Integration tests require a dedicated *_test database');
    }

    const config = {
      getOrThrow: (_key: string) => databaseUrl,
    } as unknown as ConfigService;
    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    } as unknown as LoggerService;

    prisma = new PrismaService(config, logger);
    await prisma.$connect();

    const userRepository = new PrismaUserRepository(prisma);
    const passwordHasher = new BcryptPasswordHasher({ bcryptRounds: 4 } as any);
    jwtTokenService = new JwtTokenService({
      accessSecret: 'test-jwt-access-secret-key-min-32-chars-long!',
      accessTtl: '15m',
    } as any);

    registerUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
    loginUseCase = new LoginUseCase(userRepository, passwordHasher, jwtTokenService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    if (!prisma || testUserIds.length === 0) return;

    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
    testUserIds = [];
  });

  it('UC-01: đăng ký người dùng thành công, hash mật khẩu bcrypt và lưu vào PostgreSQL', async () => {
    const uniqueEmail = `user-${randomUUID()}@bank.test`;
    const result = await registerUseCase.execute({
      fullName: '  Nguyễn Văn A  ',
      email: uniqueEmail.toUpperCase(),
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    });

    testUserIds.push(result.id);

    expect(result.id).toBeDefined();
    expect(result.email).toBe(uniqueEmail.toLowerCase());
    expect(result.fullName).toBe('Nguyễn Văn A');
    expect((result as any).passwordHash).toBeUndefined();

    const dbUser = await prisma.user.findUnique({
      where: { id: result.id },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.email).toBe(uniqueEmail.toLowerCase());
    expect(dbUser?.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('UC-01: từ chối đăng ký khi email đã tồn tại (không phân biệt hoa thường)', async () => {
    const uniqueEmail = `duplicate-${randomUUID()}@bank.test`;

    const firstUser = await registerUseCase.execute({
      fullName: 'First Registration',
      email: uniqueEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    testUserIds.push(firstUser.id);

    await expect(
      registerUseCase.execute({
        fullName: 'Second Registration',
        email: uniqueEmail.toUpperCase(),
        password: 'OtherPassword456!',
        confirmPassword: 'OtherPassword456!',
      }),
    ).rejects.toThrow(EmailAlreadyExistsError);
  });

  it('UC-01: từ chối đăng ký khi xác nhận mật khẩu không khớp', async () => {
    await expect(
      registerUseCase.execute({
        fullName: 'Mismatch Password',
        email: `mismatch-${randomUUID()}@bank.test`,
        password: 'Password123!',
        confirmPassword: 'DifferentPassword456!',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('UC-02: đăng nhập thành công trả về JWT accessToken hợp lệ', async () => {
    const email = `login-${randomUUID()}@bank.test`;
    const password = 'CorrectPassword123!';

    const registered = await registerUseCase.execute({
      fullName: 'Login User',
      email,
      password,
      confirmPassword: password,
    });
    testUserIds.push(registered.id);

    const loginResult = await loginUseCase.execute({
      email: `  ${email.toUpperCase()}  `,
      password,
    });

    expect(loginResult.accessToken).toBeDefined();
    expect(typeof loginResult.accessToken).toBe('string');
    expect(loginResult.user.id).toBe(registered.id);
    expect(loginResult.user.email).toBe(email);

    const decoded = await jwtTokenService.verifyAccessToken(loginResult.accessToken);
    expect(decoded.sub).toBe(registered.id);
  });

  it('UC-02: từ chối đăng nhập khi sai mật khẩu', async () => {
    const email = `wrong-pass-${randomUUID()}@bank.test`;
    const registered = await registerUseCase.execute({
      fullName: 'Wrong Password User',
      email,
      password: 'ValidPassword123!',
      confirmPassword: 'ValidPassword123!',
    });
    testUserIds.push(registered.id);

    await expect(
      loginUseCase.execute({
        email,
        password: 'IncorrectPassword999!',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('UC-02: từ chối đăng nhập khi email không tồn tại', async () => {
    await expect(
      loginUseCase.execute({
        email: `non-existent-${randomUUID()}@bank.test`,
        password: 'AnyPassword123!',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
