import { AuthController } from '@src/modules/identity/presentation/http/auth.controller';
import { RegisterUserUseCase } from '@src/modules/identity/application/use-cases/register-user.use-case';
import { LoginUseCase } from '@src/modules/identity/application/use-cases/login.use-case';

describe('AuthController', () => {
  let controller: AuthController;
  let mockRegisterUseCase: { execute: jest.Mock };
  let mockLoginUseCase: { execute: jest.Mock };

  beforeEach(() => {
    mockRegisterUseCase = {
      execute: jest.fn(),
    };
    mockLoginUseCase = {
      execute: jest.fn(),
    };
    controller = new AuthController(
      mockRegisterUseCase as unknown as RegisterUserUseCase,
      mockLoginUseCase as unknown as LoginUseCase,
    );
  });

  describe('register', () => {
    it('gọi registerUserUseCase.execute với đúng DTO', async () => {
      const dto = {
        fullName: 'Nguyen Van A',
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      const expectedResponse = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Nguyen Van A',
        createAt: '2026-01-01T00:00:00.000Z',
      };

      mockRegisterUseCase.execute.mockResolvedValue(expectedResponse);

      const result = await controller.register(dto);

      expect(mockRegisterUseCase.execute).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('login', () => {
    it('gọi loginUseCase.execute với đúng DTO', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const expectedResponse = {
        accessToken: 'jwt.token.here',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          fullName: 'Nguyen Van A',
          createAt: '2026-01-01T00:00:00.000Z',
        },
      };

      mockLoginUseCase.execute.mockResolvedValue(expectedResponse);

      const result = await controller.login(dto);

      expect(mockLoginUseCase.execute).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });
});
