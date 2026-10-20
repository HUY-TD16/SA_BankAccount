import { objectSchema, uuidSchema, dateSchema } from '@src/common/http/swagger/response.schemas';

export const userResponseSchema = objectSchema({
  id: uuidSchema,
  email: { type: 'string', format: 'email', example: 'customer@example.com' },
  fullName: { type: 'string', example: 'Nguyen Van A' },
  createAt: dateSchema,
});
export const loginResponseSchema = objectSchema({
  accessToken: { type: 'string', description: 'JWT dùng trong Authorization: Bearer <token>.' },
  user: userResponseSchema,
});
