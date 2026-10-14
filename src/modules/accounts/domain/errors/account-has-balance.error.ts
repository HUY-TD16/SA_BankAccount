import { AppError } from '@src/common/domain/errors/app.error';

export class AccountHasBalanceError extends AppError {
  readonly errorCode = 'ACCOUNT_HAS_BALANCE';
  readonly httpStatus = 409;

  constructor() {
    super('Account balance must be zero before closing');
  }
}