import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { TransactionTypeDto } from './create-transaction.dto';

function parsePositiveInteger(value: unknown): unknown {
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    return Number(value);
  }
  return value;
}

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, example: 1, default: 1, description: 'Current page number (starts at 1)' })
  @IsOptional()
  @Transform(({ value }) => parsePositiveInteger(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, example: 20, default: 20, description: 'Page size limit (maximum 100)' })
  @IsOptional()
  @Transform(({ value }) => parsePositiveInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: TransactionTypeDto,
    description: 'Filter by transaction type: CREDIT (deposit/transfer in) or DEBIT (withdraw/transfer out)'
  })
  @IsOptional()
  @IsEnum(TransactionTypeDto)
  type?: TransactionTypeDto;

  @ApiPropertyOptional({
    format: 'date-time', example: '2026-09-01T00:00:00.000Z',
    description: 'Filter start date (ISO 8601 format)'
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time', example: '2026-09-30T23:59:59.999Z',
    description: 'Filter end date (ISO 8601 format)'
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
