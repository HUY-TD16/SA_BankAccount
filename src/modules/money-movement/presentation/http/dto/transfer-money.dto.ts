import { IsString, IsNotEmpty, IsUUID, IsNumberString, IsOptional } from 'class-validator';

export class TransferMoneyDto {
  @IsString()
  @IsNotEmpty()
  sourceAccountId!: string;

  @IsString()
  @IsNotEmpty()
  destinationAccountId!: string;

  @IsNumberString() 
  @IsNotEmpty()
  amount!: string;

  @IsUUID()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  description?: string;
}