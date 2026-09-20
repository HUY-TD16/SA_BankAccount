import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { RequestWithId } from "../middleware/request-id.middleware";

/**
 * Wrapper để use case đánh dấu rõ ràng "đây là kết quả phân trang", thay vì để
 * interceptor tự đoán hình dạng object (duck typing) - tránh đoán sai khi một DTO
 * bình thường tình cờ có field `items`.
 *
 * Use case cho list (VD: ListAccountsUseCase, ListTransactionsUseCase) trả về:
 *   return new Paginated(items, page, limit, total);
 */
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly page: number,
    public readonly limit: number,
    public readonly total: number,
  ) {}
}

interface SuccessEnvelope {
  success: true;
  data: unknown;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: { requestId: string };
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const requestId = request.requestId ?? "unknown";

    return next.handle().pipe(
      map((result: unknown) => {
        // 204 No Content (VD: logout, close account) - controller trả undefined,
        // giữ nguyên body rỗng, không bọc envelope.
        if (result === undefined) return result;

        if (result instanceof Paginated) {
          const envelope: SuccessEnvelope = {
            success: true,
            data: result.items,
            pagination: {
              page: result.page,
              limit: result.limit,
              total: result.total,
              totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
            },
            meta: { requestId },
          };
          return envelope;
        }

        const envelope: SuccessEnvelope = {
          success: true,
          data: result,
          meta: { requestId },
        };
        return envelope;
      }),
    );
  }
}
