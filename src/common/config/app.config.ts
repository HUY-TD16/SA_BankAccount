import { registerAs } from "@nestjs/config";

/**
 * Dùng qua ConfigService: configService.get<number>('app.port')
 * (namespace 'app' tự động lấy từ tên tham số đầu tiên của registerAs).
 */
export default registerAs("app", () => ({
  port: parseInt(process.env.PORT ?? "3000", 10),
  globalPrefix: "api/v1",
}));
