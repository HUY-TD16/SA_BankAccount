// AppError - base class cho mọi lỗi nghiệp vụ hệ thống

export interface ErrorDetail {
  field: string;
  reason: string;
}

export abstract class AppError extends Error {
  abstract readonly errorCode: string;
  abstract readonly httpStatus: number;
  readonly details?: ErrorDetail[];

  protected constructor(message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
