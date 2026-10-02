import { Inject, Injectable } from "@nestjs/common";
import { ValidationError } from "@src/common/domain/errors";
import {
  USER_REPOSITORY,
  UserRepositoryPort,
  PASSWORD_HASHER,
  PasswordHasherPort,
} from "@src/modules/identity/application/ports";
import { EmailAlreadyExistsError } from "@src/modules/identity/domain/errors";
import { RegisterDto } from "@src/modules/identity/presentation/http/dto/register.dto";

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(dto: RegisterDto) {
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
