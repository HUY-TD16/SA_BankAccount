import { registerAs } from "@nestjs/config";

/**
 * Chỉ có access token ở bản rút gọn (không refresh rotation).
 * Dùng bởi modules/identity/infrastructure/security/jwt-token.service.ts
 * (implementation của TOKEN_SERVICE port) qua configService.get('jwt.accessSecret').
 */
export default registerAs("jwt", () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessTtl: process.env.JWT_ACCESS_TTL ?? "60m",
}));
