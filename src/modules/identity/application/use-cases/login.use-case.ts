import { Inject, Injectable } from "@nestjs/common";
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from "@src/common/security/ports";
import {
  USER_REPOSITORY,
  UserRepositoryPort,
  PASSWORD_HASHER,
  PasswordHasherPort,
} from "@src/modules/identity/application/ports";
import { InvalidCredentialsError } from "@src/modules/identity/domain/errors";
import { LoginDto } from "@src/modules/identity/presentation/http/dto/login.dto";

// Hash bcrypt gia dung khi user khong ton tai, de bcrypt.compare van ton thoi gian
// tinh toan tuong duong truong hop user ton tai - giam kha nang do email qua timing.
const DUMMY_HASH =
  "$2b$12$CwTycUXWue0Thq9StjUM0uJ8i6ByfLwqOAn9d.Xz3.dK5xj5v5x5e";

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
  ) {}

  async execute(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    // QUAN TRONG: du user co ton tai hay khong, van phai throw DUNG 1 loai loi
    // giong het nhau - khong re nhanh som de tranh tiet lo "email nay co ton tai
    // trong he thong khong" qua noi dung/hanh vi loi.
    const isPasswordValid = user
      ? await this.passwordHasher.compare(dto.password, user.passwordHash)
      : await this.passwordHasher.compare(dto.password, DUMMY_HASH);

    if (!user || !isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    const accessToken = await this.tokenService.signAccessToken(user.id);

    return {
      accessToken,
      user: user.toSafeObject(),
    };
  }
}
