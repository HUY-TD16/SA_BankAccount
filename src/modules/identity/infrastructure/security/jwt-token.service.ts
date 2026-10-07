import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import {
  AccessTokenPayload,
  TokenServicePort,
} from "@src/common/security/ports";
import { UnauthorizedError } from "@src/common/domain/errors";
import { jwtConfig } from "@src/common/config";

/**
 * Implementation THAT cua TokenServicePort (interface o common/).
 * Day la file bat buoc xong SOM NHAT trong ca du an - AccessTokenGuard (dung cho
 * MOI route protected cua ca 3 module) phu thuoc vao no qua DI token TOKEN_SERVICE.
 */
@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  async signAccessToken(userId: string): Promise<string> {
    return jwt.sign(
      { sub: userId },
      this.config.accessSecret as string,
      {
        expiresIn: this.config.accessTtl,
        algorithm: "HS256",
      } as jwt.SignOptions,
    );
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = jwt.verify(token, this.config.accessSecret as string) as {
        sub: string;
      };
      return { sub: payload.sub };
    } catch {
      // KHONG phan biet "het han" vs "sai chu ky" ra response - cung 1 loi 401 chung
      throw new UnauthorizedError("INVALID_TOKEN");
    }
  }
}
