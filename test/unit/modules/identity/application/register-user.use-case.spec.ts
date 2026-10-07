import { RegisterUserUseCase } from '@src/modules/identity/application/use-cases/register-user.use-case';
import { UserRepositoryPort } from '@src/modules/identity/application/ports/user.repository.port';
import { PasswordHasherPort } from '@src/modules/identity/application/ports/password-hasher.port';
import { User } from '@src/modules/identity/domain/entities/user.entity';
import { EmailAlreadyExistsError } from '@src/modules/identity/domain/errors/identity.errors';
import { ValidationError } from '@src/common/domain/errors/common.errors';

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let mockUserRepo: jest.Mocked<UserRepositoryPort>;
  let mockPasswordHasher: jest.Mocked<PasswordHasherPort>;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    mockPasswordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    useCase = new RegisterUserUseCase(mockUserRepo, mockPasswordHasher);
  });

  it('tạo user mới thành công khi email chưa tồn tại và trả object không có passwordHash', async () => {
    const input = {
      email: ' Test@Example.COM ',
      fullName: '  Nguyen Van A  ',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockPasswordHasher.hash.mockResolvedValue('hashed_pw');

    const createdUser = new User(
      'user-uuid-1',
      'test@example.com',
      'Nguyen Van A',
      'hashed_pw',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    );
    mockUserRepo.create.mockResolvedValue(createdUser);

    const result = await useCase.execute(input);

    // Email phải được lowercase và trim
    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
    // Password được hash
    expect(mockPasswordHasher.hash).toHaveBeenCalledWith('Password123!');
    // Repo create được gọi với dữ liệu chuẩn hóa
    expect(mockUserRepo.create).toHaveBeenCalledWith({
      email: 'test@example.com',
      fullName: 'Nguyen Van A',
      passwordHash: 'hashed_pw',
    });
    // Kết quả trả về không có passwordHash
    expect(result).toEqual({
      id: 'user-uuid-1',
      email: 'test@example.com',
      fullName: 'Nguyen Van A',
      createAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('ném ValidationError khi password !== confirmPassword và không gọi repo create', async () => {
    const input = {
      email: 'test@example.com',
      fullName: 'Nguyen Van A',
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!',
    };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    expect(mockUserRepo.findByEmail).not.toHaveBeenCalled();
    expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('ném EmailAlreadyExistsError khi email đã tồn tại và không gọi hash hay create', async () => {
    const input = {
      email: 'existing@example.com',
      fullName: 'Nguyen Van A',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    const existingUser = new User(
      'existing-id',
      'existing@example.com',
      'Existing User',
      'hashed_pw',
      new Date(),
      new Date(),
    );
    mockUserRepo.findByEmail.mockResolvedValue(existingUser);

    await expect(useCase.execute(input)).rejects.toThrow(EmailAlreadyExistsError);
    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('existing@example.com');
    expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });
});
