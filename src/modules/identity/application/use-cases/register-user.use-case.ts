import { ValidationError } from "@src/common/domain/errors";
import type {
  UserRepositoryPort,
  PasswordHasherPort,
} from "@src/modules/identity/application/ports";
import { EmailAlreadyExistsError } from "@src/modules/identity/domain/errors";

export interface RegisterUserCommand {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(dto: RegisterUserCommand) {
    // confirmPassword
    if (dto.password !== dto.confirmPassword) {
      throw new ValidationError([
        { field: "confirmPassword", reason: "must_match_password" },
      ]);
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    // check existing email
    const existing = await this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new EmailAlreadyExistsError();
    }

    // hash password
    const passwordHash = await this.passwordHasher.hash(dto.password);

    // create user
    const user = await this.userRepository.create({
      email: normalizedEmail,
      fullName: dto.fullName.trim(),
      passwordHash,
    });

    // check safety object
    return user.toSafeObject();
  }
}
