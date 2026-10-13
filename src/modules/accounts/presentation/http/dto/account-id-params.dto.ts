import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AccountIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  accountId!: string;
}