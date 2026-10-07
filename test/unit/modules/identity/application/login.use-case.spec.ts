import { LoginUseCase } from '@src/modules/identity/application/use-cases/login.use-case';
import { UserRepositoryPort } from '@src/modules/identity/application/ports/user.repository.port';
import { PasswordHasherPort } from '@src/modules/identity/application/ports/password-hasher.port';
import { TokenServicePort } from '@src/common/security/ports/token-service.port';
import { User } from '@src/modules/identity/domain/entities/user.entity';
import { InvalidCredentialsError } from '@src/modules/identity/domain/errors/identity.errors';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockPasswordHasher: jest.Mocked<PasswordHasherPort>;
  let mockTokenService: jest.Mocked<TokenServicePort>;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    mockPasswordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    mockTokenService = {
      signAccessToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    };
    useCase = new LoginUseCase(mockUserRepo, mockPasswordHasher, mockTokenService);
  });

  it('đăng nhập thành công khi email và password đúng', async () => {
    const command = {
      email: ' Test@Example.COM ',
      password: 'Password123!',
    };

    const user = new User(
      'user-123',
      'test@example.com',
      'Nguyen Van A',
      'hashed_password',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    );

    mockUserRepo.findByEmail.mockResolvedValue(user);
    mockPasswordHasher.compare.mockResolvedValue(true);
    mockTokenService.signAccessToken.mockResolvedValue('jwt.token.here');

    const result = await useCase.execute(command);

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
    expect(mockPasswordHasher.compare).toHaveBeenCalledWith(
      'Password123!',
      'hashed_password',
    );
    expect(mockTokenService.signAccessToken).toHaveBeenCalledWith('user-123');
    expect(result).toEqual({
      accessToken: 'jwt.token.here',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Nguyen Van A',
        createAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('ném InvalidCredentialsError khi email không tồn tại (vẫn gọi compare với dummy hash để chống timing attack)', async () => {
    const command = {
      email: 'notfound@example.com',
      password: 'Password123!',
    };

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.compare.mockResolvedValue(false);

    await expect(useCase.execute(command)).rejects.toThrow(InvalidCredentialsError);
    expect(mockPasswordHasher.compare).toHaveBeenCalled();
    expect(mockTokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('ném InvalidCredentialsError khi email đúng nhưng password sai', async () => {
    const command = {
      email: 'test@example.com',
      password: 'WrongPassword!',
    };

    const user = new User(
      'user-123',
      'test@example.com',
      'Nguyen Van A',
      'hashed_password',
      new Date(),
      new Date(),
    );

    mockUserRepo.findByEmail.mockResolvedValue(user);
    mockPasswordHasher.compare.mockResolvedValue(false);

    await expect(useCase.execute(command)).rejects.toThrow(InvalidCredentialsError);
    expect(mockTokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('hai trường hợp lỗi (email không tồn tại vs sai password) phải ném CÙNG một loại error và errorCode', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.compare.mockResolvedValue(false);

    let error1: InvalidCredentialsError | null = null;
    try {
      await useCase.execute({ email: 'none@example.com', password: 'pw' });
    } catch (err) {
      error1 = err as InvalidCredentialsError;
    }

    const user = new User('id', 'exists@example.com', 'A', 'hash', new Date(), new Date());
    mockUserRepo.findByEmail.mockResolvedValue(user);

    let error2: InvalidCredentialsError | null = null;
    try {
      await useCase.execute({ email: 'exists@example.com', password: 'wrong' });
    } catch (err) {
      error2 = err as InvalidCredentialsError;
    }

    expect(error1).toBeInstanceOf(InvalidCredentialsError);
    expect(error2).toBeInstanceOf(InvalidCredentialsError);
    expect(error1?.errorCode).toBe(error2?.errorCode);
    expect(error1?.httpStatus).toBe(error2?.httpStatus);
  });
});
