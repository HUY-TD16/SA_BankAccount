import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { UnauthorizedError } from "../../domain/errors/common.errors";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  AccessTokenPayload,
  TOKEN_SERVICE,
  TokenServicePort,
} from "../ports/token-service.port";

function extractBearerToken(authorizationHeader?: string): string | undefined {
  if (!authorizationHeader) return undefined;
  const [scheme, token] = authorizationHeader.split(" ");
  return scheme === "Bearer" && token ? token : undefined;
}

/**
 * AccessTokenGuard - trách nhiệm DUY NHẤT: xác thực danh tính (authentication).
 *
 * Đăng ký 1 LẦN DUY NHẤT làm APP_GUARD toàn cục ở app.module.ts, KHÔNG khai báo
 * @UseGuards(AccessTokenGuard) lặp lại ở từng controller.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedError("MISSING_TOKEN");
    }

    // tokenService.verifyAccessToken phải tự throw UnauthorizedError nếu sai chữ ký/hết hạn.
    // Guard KHÔNG catch riêng để phân biệt lý do ra response - tất cả cùng 1 lỗi 401 chung.
    const payload = await this.tokenService.verifyAccessToken(token);
    request.user = payload;
    return true;
  }
}
