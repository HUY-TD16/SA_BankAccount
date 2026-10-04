import { Injectable } from "@nestjs/common";
import { Prisma, User as PrismaUser } from "@prisma/client";
import { PrismaService } from "@src/infrastructure/prisma/prisma.service";
import {
  CreateUserInput,
  UserRepositoryPort,
} from "@src/modules/identity/application/ports";
import { User } from "@src/modules/identity/domain/entities";
import { EmailAlreadyExistsError } from "@src/modules/identity/domain/errors";

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email }, // email da lowercase tu use case
    });
    return record ? this.toDomain(record) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      const record = await this.prisma.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash: input.passwordHash,
        },
      });
      return this.toDomain(record);
    } catch (error) {
      // P2002 = Prisma unique constraint violation - bat loi ha tang, nem lai
      // thanh domain error, KHONG de loi Prisma tho lot ra GlobalExceptionFilter
      // (se bi hieu la loi la va tra ve 500).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  private toDomain(record: PrismaUser): User {
    return new User(
      record.id,
      record.email,
      record.fullName,
      record.passwordHash,
      record.createdAt,
      record.updatedAt,
    );
  }
}
