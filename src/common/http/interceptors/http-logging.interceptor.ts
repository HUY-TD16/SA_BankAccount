import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Response } from "express";
import { RequestWithId } from "@src/common/http/middleware";

/**
 * HttpLoggingInterceptor - ghi log tự động cho mọi HTTP Request thành công
 * bao gồm: Method, URL, Status Code, Thời gian xử lý (ms) và Request ID.
 *
 * Trường hợp lỗi sẽ do GlobalExceptionFilter ghi log chi tiết (errorCode, message).
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();

    const method = req?.method ?? "UNKNOWN";
    const url = req?.originalUrl ?? req?.url ?? "";
    const requestId = req?.requestId ?? "unknown";
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = res?.statusCode ?? 200;
          const duration = Date.now() - startTime;
          this.logger.log(
            `[${requestId}] ${method} ${url} ${statusCode} +${duration}ms`,
          );
        },
      }),
    );
  }
}
