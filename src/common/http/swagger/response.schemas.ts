import type { ApiResponseOptions } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export function objectSchema(properties: Record<string, SchemaObject>, required = Object.keys(properties)): SchemaObject {
  return { type: 'object', required, properties };
}

export const uuidSchema: SchemaObject = { type: 'string', format: 'uuid', example: '81ed4895-3bc6-46c9-b7b2-c0e86b978a10' };
export const dateSchema: SchemaObject = { type: 'string', format: 'date-time', example: '2026-10-20T08:00:00.000Z' };
export const moneySchema: SchemaObject = { type: 'string', pattern: '^\\d+$', example: '100000', description: 'Số tiền VND nguyên, biểu diễn bằng chuỗi để giữ độ chính xác.' };
const metaSchema = objectSchema({ requestId: uuidSchema });
const headers = { 'X-Request-Id': { description: 'Mã truy vết của request.', schema: uuidSchema } };

/** Matches ResponseEnvelopeInterceptor, including the empty 204 response. */
export function successResponse(status: number, description: string, data?: SchemaObject, paginated = false): ApiResponseOptions {
  if (status === 204) return { status, description, headers };
  const properties: Record<string, SchemaObject> = {
    success: { type: 'boolean', enum: [true] },
    data: paginated ? { type: 'array', items: data! } : data!,
    meta: metaSchema,
  };
  if (paginated) properties.pagination = objectSchema({
    page: { type: 'integer', minimum: 1, example: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, example: 20 },
    total: { type: 'integer', minimum: 0, example: 0 },
    totalPages: { type: 'integer', minimum: 1, example: 1 },
  });
  return { status, description, headers, schema: objectSchema(properties) };
}

/** Matches GlobalExceptionFilter; details is absent for errors without field details. */
export function errorResponse(status: number, description: string): ApiResponseOptions {
  return { status, description, headers, schema: objectSchema({
    success: { type: 'boolean', enum: [false] },
    error: objectSchema({
      code: { type: 'string', description: 'Mã lỗi nghiệp vụ hoặc HTTP_ERROR/INTERNAL_ERROR.' },
      message: { type: 'string' },
      details: { type: 'array', items: objectSchema({ field: { type: 'string' }, reason: { type: 'string' } }) },
    }, ['code', 'message']),
    meta: metaSchema,
  }) };
}
