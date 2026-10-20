import { objectSchema, uuidSchema, dateSchema, moneySchema } from '@src/common/http/swagger/response.schemas';

export const transactionResponseSchema = objectSchema({
  id: uuidSchema,
  accountId: uuidSchema,
  transferId: { ...uuidSchema, nullable: true, example: null },
  transactionType: { type: 'string', enum: ['CREDIT', 'DEBIT'] },
  referenceType: { type: 'string', enum: ['OPENING_DEPOSIT', 'CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT'] },
  amount: moneySchema,
  balanceAfter: moneySchema,
  status: { type: 'string', enum: ['COMPLETED'], example: 'COMPLETED' },
  description: { type: 'string', nullable: true, example: null },
  createdAt: dateSchema,
});
export const transferResponseSchema = objectSchema({
  id: uuidSchema,
  sourceAccountId: uuidSchema,
  destinationAccountId: uuidSchema,
  initiatedByUserId: uuidSchema,
  amount: moneySchema,
  description: { type: 'string', nullable: true, example: null },
  idempotencyKey: { type: 'string', example: 'transfer-20261020-001' },
  status: { type: 'string', enum: ['COMPLETED'], example: 'COMPLETED' },
  createdAt: dateSchema,
});
