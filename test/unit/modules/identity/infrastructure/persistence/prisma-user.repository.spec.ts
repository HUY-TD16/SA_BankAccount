import { PrismaUserRepository } from '@src/modules/identity/infrastructure/persistence/prisma-user.repository';
import { PrismaService } from '@src/infrastructure/prisma/prisma.service';
import { User } from '@src/modules/identity/domain/entities/user.entity';
import { EmailAlreadyExistsError } from '@src/modules/identity/domain/errors/identity.errors';
import { Prisma } from '@prisma/client';

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    repository = new PrismaUserRepository(mockPrisma as unknown as PrismaService);
  });

  describe('findByEmail', () => {
    it('trả về domain entity User khi tìm thấy record', async () => {
      const dbRecord = {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Nguyen Van A',
        passwordHash: '$2b$12$...',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockPrisma.user.findUnique.mockResolvedValue(dbRecord);

      const result = await repository.findByEmail('test@example.com');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('user-1');
      expect(result?.email).toBe('test@example.com');
    });

    it('trả về null khi không tìm thấy record', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('tạo user trong database và trả về domain entity User', async () => {
      const input = {
        email: 'test@example.com',
        fullName: 'Nguyen Van A',
        passwordHash: '$2b$12$hashed',
      };

      const dbRecord = {
        id: 'user-new',
        email: input.email,
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      mockPrisma.user.create.mockResolvedValue(dbRecord);

      const result = await repository.create(input);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: input,
      });
      expect(result).toBeInstanceOf(User);
      expect(result.id).toBe('user-new');
      expect(result.email).toBe('test@example.com');
    });

    it('ném EmailAlreadyExistsError khi Prisma bắn lỗi P2002 (Unique constraint violation)', async () => {
      const input = {
        email: 'duplicate@example.com',
        fullName: 'Nguyen Van A',
        passwordHash: '$2b$12$hashed',
      };

      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.0',
      });
      mockPrisma.user.create.mockRejectedValue(p2002Error);

      await expect(repository.create(input)).rejects.toThrow(EmailAlreadyExistsError);
    });

    it('ném lại error gốc khi Prisma bắn lỗi khác P2002', async () => {
      const input = {
        email: 'test@example.com',
        fullName: 'Nguyen Van A',
        passwordHash: '$2b$12$hashed',
      };

      const genericError = new Error('Database connection timeout');
      mockPrisma.user.create.mockRejectedValue(genericError);

      await expect(repository.create(input)).rejects.toThrow('Database connection timeout');
    });
  });
});
