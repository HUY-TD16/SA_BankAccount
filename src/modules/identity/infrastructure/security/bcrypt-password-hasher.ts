import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import appConfig from "@src/common/config/app.config";
import { PasswordHasherPort } from "../../application/ports/password-hasher.port";

@Injectable()
export class BcryptPasswordHasher implements PasswordHasherPort {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.config.bcryptRounds);
  }

  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}
