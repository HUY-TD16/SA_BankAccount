import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { AccessTokenPayload } from "../ports/token-service.port";

/**
 * Lấy user hiện tại (đã gắn bởi AccessTokenGuard) trong controller.
 * Controller KHÔNG được đọc userId từ body/query - luôn dùng decorator này.
 *
 * Ví dụ:
 *   @Post()
 *   create(@CurrentUser() user: AccessTokenPayload, @Body() dto: OpenAccountDto) {
 *     return this.openAccountUseCase.execute(user.sub, dto);
 *   }
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AccessTokenPayload }>();
    return request.user;
  },
);
