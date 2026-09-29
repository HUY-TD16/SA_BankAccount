import { User } from "../../domain/entities/user.entity";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface CreateUserInput {
  email: string; // da chuan hoa lowercase/trim o use case truoc khi goi
  fullName: string;
  passwordHash: string;
}

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}
