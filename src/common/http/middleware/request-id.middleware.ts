import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

/**
 * Thứ tự chạy thực tế của NestJS là:
 *   Middleware -> Guard -> Interceptor(pre) -> Pipe -> Controller -> Interceptor(post) -> Filter
 *
 * => Nên đặt việc SINH requestId ở Middleware (chạy sớm nhất), còn
 * ResponseEnvelopeInterceptor chỉ ĐỌC LẠI request.requestId để đưa vào `meta`.
 * Áp dụng global trong main.ts bằng app.use(requestIdMiddleware), KHÔNG dùng app.useGlobalInterceptors
 * cho phần sinh ID này.
 */
export interface RequestWithId extends Request {
  requestId: string;
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  (req as RequestWithId).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
