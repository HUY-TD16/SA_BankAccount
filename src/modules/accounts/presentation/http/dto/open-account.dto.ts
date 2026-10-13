import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';

import {
  ACCOUNT_TYPES,
  type AccountType,
} from '../../../domain/enums/account-type';

export class OpenAccountDto {
  @ApiProperty({ example: 'Tài khoản thanh toán' })
  @IsString()
  accountName!: string;

  @ApiProperty({ enum: [...ACCOUNT_TYPES], example: 'PAYMENT' })
  @IsIn([...ACCOUNT_TYPES])
  accountType!: AccountType;

  @ApiProperty({
    example: '500000',
    description: 'Số nguyên VND không âm, truyền dưới dạng chuỗi',
  })
  @IsString()
  @Matches(/^\d+$/)
  initialDeposit!: string;
}