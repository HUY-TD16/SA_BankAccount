import { objectSchema, uuidSchema, dateSchema, moneySchema } from '@src/common/http/swagger/response.schemas';
import { ACCOUNT_TYPES } from '../../../domain/enums/account-type';
import { ACCOUNT_STATUSES } from '../../../domain/enums/account-status';

export const accountResponseSchema = objectSchema({
  id: uuidSchema,
  accountNumber: { type: 'string', example: '100000012345' },
  accountName: { type: 'string', example: 'Tài khoản thanh toán' },
  accountType: { type: 'string', enum: [...ACCOUNT_TYPES] },
  currentBalance: moneySchema,
  currency: { type: 'string', example: 'VND' },
  status: { type: 'string', enum: [...ACCOUNT_STATUSES] },
  createdAt: dateSchema,
  closedAt: { ...dateSchema, nullable: true, example: null },
});
