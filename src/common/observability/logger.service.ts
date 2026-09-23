import {
  ConsoleLogger,
  Injectable,
  LoggerService as NestLoggerService,
} from "@nestjs/common";

/**
 * Danh sách field redact
 */
const REDACTED_FIELDS = [
  "password",
  "confirmPassword",
  "token",
  "accessToken",
  "authorization",
  "cookie",
  "secret",
  "accountNumber",
];

export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, val]) => {
        if (REDACTED_FIELDS.includes(key)) return [key, "[REDACTED]"];
        return [key, redactSensitive(val)];
      },
    );
    return Object.fromEntries(entries) as T;
  }
  return value;
}

/**
 * LoggerService - thay thế Nest Logger mặc định, redact tự động MỌI object được log.
 * Áp dụng global 1 lần duy nhất trong main.ts:
 *
 *   const app = await NestFactory.create(AppModule, { bufferLogs: true });
 *   app.useLogger(app.get(LoggerService));
 *
 * QUY ƯỚC BẮT BUỘC CHO CẢ 3 MODULE:
 * - Không bao giờ log `body`/`headers.authorization` nguyên văn bằng console.log trực tiếp.
 * - Luôn log qua LoggerService (inject qua constructor) để đi qua redact tự động.
 * - Nếu cần log object phức tạp, truyền thẳng object (không tự JSON.stringify trước),
 *   để redactSensitive() có thể duyệt đúng field.
 */
@Injectable()
export class LoggerService extends ConsoleLogger implements NestLoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(this.safe(message), ...optionalParams.map((p) => this.safe(p)));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(this.safe(message), ...optionalParams.map((p) => this.safe(p)));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(this.safe(message), ...optionalParams.map((p) => this.safe(p)));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(this.safe(message), ...optionalParams.map((p) => this.safe(p)));
  }

  private safe(value: unknown): unknown {
    return typeof value === "object" && value !== null
      ? redactSensitive(value)
      : value;
  }
}
