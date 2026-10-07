import { AppError } from '@src/common/domain/errors/app.error';

export class AccountNotFoundError extends AppError {
    readonly errorCode = 'ACCOUNT_NOT_FOUND';
    readonly httpStatus = 404;

    constructor() {
        super('Account not found');
    }
}