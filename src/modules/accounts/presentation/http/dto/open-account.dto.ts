import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';

import {
  ACCOUNT_TYPES,
  type AccountType,
} from '../../../domain/enums/account-type';

export class OpenAccountDto {
  @ApiProperty({ example: 'Tài khoản thanh toán', description: 'Tên sau khi trim phải dài 1–100 ký tự.' })
  @IsString()
  accountName!: string;

  @ApiProperty({ enum: [...ACCOUNT_TYPES], example: 'PAYMENT' })
  @IsIn([...ACCOUNT_TYPES])
  accountType!: AccountType;

  @ApiProperty({
    type: String, pattern: '^\\d+$', example: '500000',
    description: 'Số nguyên VND từ 0 đến 999999999999999999, truyền dưới dạng chuỗi',
  })
  @IsString()
  @Matches(/^\d+$/)
  initialDeposit!: string;
}