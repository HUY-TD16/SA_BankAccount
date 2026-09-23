import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Đánh dấu 1 route là public (không cần Access Token).
 * Mặc định MỌI route đều protected (opt-out, không phải opt-in) tránh quên bảo vệ endpoint mới.
 *
 * Dùng cho: /auth/register, /auth/login, /auth/refresh (dùng refresh cookie riêng,
 * không qua AccessTokenGuard), /auth/forgot-password, /auth/reset-password, /api/docs*.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
