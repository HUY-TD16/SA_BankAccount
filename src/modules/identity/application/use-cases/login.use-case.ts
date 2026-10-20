import type { TokenServicePort } from "@src/common/security/ports";
import type {
  UserRepositoryPort,
  PasswordHasherPort,
} from "@src/modules/identity/application/ports";
import { InvalidCredentialsError } from "@src/modules/identity/domain/errors";

export interface LoginCommand {
  email: string;
  password: string;
}
// Hash bcrypt gia dung khi user khong ton tai, de bcrypt.compare van ton thoi gian
// tinh toan tuong duong truong hop user ton tai - giam kha nang do email qua timing.
const DUMMY_HASH =
  "$2b$12$CwTycUXWue0Thq9StjUM0uJ8i6ByfLwqOAn9d.Xz3.dK5xj5v5x5e";

export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(dto: LoginCommand) {
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
