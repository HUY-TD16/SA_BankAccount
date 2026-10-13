import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  ACCOUNT_STATUSES,
  type AccountStatus,
} from '../../../domain/enums/account-status';

function parsePositiveInteger(value: unknown): unknown {
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    return Number(value);
  }

  return value;
}

export class ListAccountsQueryDto {
  @ApiPropertyOptional({ enum: [...ACCOUNT_STATUSES] })
  @IsOptional()
  @IsIn([...ACCOUNT_STATUSES])
  status?: AccountStatus;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parsePositiveInteger(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parsePositiveInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}