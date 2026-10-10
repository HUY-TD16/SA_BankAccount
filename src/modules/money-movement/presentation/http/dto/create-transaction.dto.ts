import { IsEnum, IsNumberString, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TransactionTypeDto {
    CREDIT = 'CREDIT',
    DEBIT = 'DEBIT',
}

export class CreateTransactionDto {
    @ApiProperty({ example: 'CREDIT', enum: TransactionTypeDto, description: 'Transaction type (CREDIT = Deposit, DEBIT = Withdrawal)' })
    @IsEnum(TransactionTypeDto, { message: 'Type must be either CREDIT or DEBIT' })
    type!: TransactionTypeDto;

    @ApiProperty({ example: '100000', description: 'Transaction amount (Must be a positive integer string)' })
    @IsNumberString({}, { message: 'Amount must be a numeric string' })
    @Matches(/^[1-9]\d*$/, { message: 'Amount must be greater than 0 and cannot start with zero' })
    amount!: string;

    @ApiPropertyOptional({ example: 'Salary deposit', description: 'Transaction description (Optional)' })
    @IsOptional()
    @IsString()
    description?: string;
}

