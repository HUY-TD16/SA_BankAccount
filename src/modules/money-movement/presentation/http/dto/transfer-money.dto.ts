import { IsString, IsNotEmpty, IsUUID, IsNumberString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferMoneyDto {
  @ApiProperty({ example: '81ed4895-3bc6-46c9-b7b2-c0e86b978a10', description: 'Source account UUID' })
  @IsUUID()
  @IsNotEmpty()
  sourceAccountId!: string;

  @ApiProperty({ example: '100000012345', description: 'Destination bank account number' })
  @IsString()
  @IsNotEmpty()
  destinationAccountNumber!: string;

  @ApiProperty({ example: '100000', description: 'Transfer amount (positive numeric integer string)' })
  @IsNumberString()
  @Matches(/^[1-9]\d*$/, { message: 'Amount must be greater than 0 and cannot start with zero' })
  @IsNotEmpty()
  amount!: string;

  @ApiPropertyOptional({ example: 'Tien an trua', description: 'Transfer description (Optional)' })
  @IsOptional()
  @IsString()
  description?: string;
}