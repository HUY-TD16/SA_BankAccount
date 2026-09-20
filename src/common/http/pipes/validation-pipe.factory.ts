import {
  ValidationError as NestValidationError,
  ValidationPipe,
  ValidationPipeOptions,
} from "@nestjs/common";
import { ErrorDetail } from "../../domain/errors/app.error";
import { ValidationError } from "../../domain/errors/common.errors";

function flattenValidationErrors(
  errors: NestValidationError[],
  parentPath = "",
): ErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownReasons: ErrorDetail[] = error.constraints
      ? Object.values(error.constraints).map((reason) => ({
          field: path,
          reason,
        }))
      : [];
    const childReasons = error.children?.length
      ? flattenValidationErrors(error.children, path)
      : [];
    return [...ownReasons, ...childReasons];
  });
}

/**
 * Cấu hình ValidationPipe DUY NHẤT của toàn hệ thống - áp dụng global trong main.ts,
 * KHÔNG khai báo lại @UsePipes(new ValidationPipe(...)) riêng ở từng controller.
 *
 * exceptionFactory ném ValidationError (AppError) thay vì để Nest tự throw
 * BadRequestException mặc định, để GlobalExceptionFilter xử lý theo đúng MỘT đường
 * duy nhất (AppError -> envelope), không có 2 format lỗi 400 khác nhau trong hệ thống.
 */
export function createValidationPipeOptions(): ValidationPipeOptions {
  return {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    exceptionFactory: (errors: NestValidationError[]) =>
      new ValidationError(flattenValidationErrors(errors)),
  };
}

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe(createValidationPipeOptions());
}
