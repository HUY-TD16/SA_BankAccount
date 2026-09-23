import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { AppError, ErrorDetail } from "../../domain/errors/app.error";
import { redactSensitive } from "../../observability/logger.service";
import { RequestWithId } from "../middleware/request-id.middleware";

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
  meta: { requestId: string };
}

/**
 * GlobalExceptionFilter - điểm DUY NHẤT trong toàn bộ hệ thống biết cách map lỗi
 * sang HTTP response. Vì mỗi AppError subclass đã tự khai báo errorCode/httpStatus
 * của chính nó, filter này KHÔNG cần một bảng mapping thủ công (switch/Map) liệt kê
 * từng error class - thêm 1 lỗi nghiệp vụ mới ở bất kỳ module nào KHÔNG cần sửa file này.
 *
 * Nguyên tắc bắt buộc (phase1-security-error-design.md mục 6.3):
 * - KHÔNG bao giờ trả error.stack hoặc message gốc của exception lạ (không phải AppError) ra client.
 * - Filter KHÔNG tự rollback gì - rollback tiền do Prisma $transaction xử lý khi promise reject,
 *   filter chỉ chạy sau khi DB đã rollback xong.
 * - meta.requestId luôn có mặt, kể cả lỗi 500 (đọc từ request.requestId do middleware gắn sẵn).
 *
 * Đăng ký 1 lần duy nhất ở main.ts: app.useGlobalFilters(new GlobalExceptionFilter());
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request?.requestId ?? "unknown";

    if (exception instanceof AppError) {
      this.logger.warn(
        `[${requestId}] ${exception.errorCode}: ${exception.message}`,
        redactSensitive(exception.details ?? []),
      );
      const body: ErrorEnvelope = {
        success: false,
        error: {
          code: exception.errorCode,
          message: exception.message,
          details: exception.details,
        },
        meta: { requestId },
      };
      response.status(exception.httpStatus).json(body);
      return;
    }

    // Fallback an toàn: một số exception hạ tầng (VD: NestJS tự throw khi route not found)
    // vẫn là HttpException nhưng không phải AppError. Không nên xảy ra với lỗi nghiệp vụ
    // nếu mọi nơi đều tuân thủ throw AppError, nhưng vẫn xử lý để không rơi xuống nhánh 500.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logger.warn(
        `[${requestId}] HttpException ${status}: ${exception.message}`,
      );
      const body: ErrorEnvelope = {
        success: false,
        error: { code: "HTTP_ERROR", message: exception.message },
        meta: { requestId },
      };
      response.status(status).json(body);
      return;
    }

    // Lỗi không xác định (Prisma raw error, bug code...): KHÔNG trả message/stack gốc.
    const stack =
      exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(`[${requestId}] Unhandled exception`, stack);
    const body: ErrorEnvelope = {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Unexpected internal error" },
      meta: { requestId },
    };
    response.status(500).json(body);
  }
}
