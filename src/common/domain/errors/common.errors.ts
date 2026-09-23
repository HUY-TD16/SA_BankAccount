import { AppError, ErrorDetail } from "./app.error";

/**
 * Các error trong file này KHÔNG thuộc về một business module cụ thể nào
 * (identity / accounts / money-movement) mà thuộc về hạ tầng cross-cutting
 * (ValidationPipe, AccessTokenGuard).
 *
 * Error nghiệp vụ riêng của từng module (AccountNotFoundError, InsufficientFundsError,
 * EmailAlreadyExistsError, IdempotencyKeyReusedError...) PHẢI khai báo trong domain/errors
 * của chính module đó, KHÔNG thêm vào file này để tránh common/ phình to và bị mọi module
 * cùng sửa (chính là điều cần tránh giữa 3 người).
 *
 * Bản rút gọn (phase1-scope-reduced.md) không có role riêng biệt và không có rate limit,
 * nên KHÔNG có ForbiddenRoleError (403) / RateLimitExceededError (429) ở đây - đúng khớp
 * bảng mapping lỗi mục 6.4 của tài liệu rút gọn (chỉ còn 400/401/404/409/500).
 */

export class ValidationError extends AppError {
  readonly errorCode = "VALIDATION_ERROR";
  readonly httpStatus = 400;
  constructor(details: ErrorDetail[]) {
    super("Request validation failed", details);
  }
}

export class UnauthorizedError extends AppError {
  readonly errorCode = "UNAUTHORIZED";
  readonly httpStatus = 401;
  constructor(
    // reason chỉ phục vụ log nội bộ, KHÔNG bao giờ được đưa vào response ra client
    // (theo BR-AUTH: token sai chữ ký / hết hạn / thiếu đều trả cùng 1 lỗi 401 chung).
    reason:
      | "MISSING_TOKEN"
      | "INVALID_TOKEN"
      | "EXPIRED_TOKEN" = "INVALID_TOKEN",
  ) {
    super(`Access token rejected: ${reason}`);
  }
}
