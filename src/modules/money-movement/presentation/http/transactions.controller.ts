import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/security/decorators';
import { AccessTokenPayload } from '../../../../common/security/ports';
import { CreateTransactionDto, TransactionTypeDto } from './dto/create-transaction.dto';
import { DepositMoneyUseCase } from '../../application/use-cases/deposit-money.use-case';


@ApiTags('transactions')
@ApiBearerAuth()
@Controller('accounts') 
export class TransactionController {
    constructor(private readonly depositMoneyUseCase: DepositMoneyUseCase) {}

    @ApiOperation({ summary: 'Create a deposit/withdrawal transaction (UC-05, UC-06)' })
    @ApiResponse({ status: 201, description: 'Transaction successful' })
    @Post(':accountId/transactions')
    @HttpCode(HttpStatus.CREATED)
    async createTransaction(
        @Param('accountId') accountId: string,       
        @Body() dto: CreateTransactionDto,
        @CurrentUser() user: AccessTokenPayload,
    ) {
      if (dto.type === TransactionTypeDto.CREDIT) {
        return this.depositMoneyUseCase.execute({
          accountId: accountId,
          userId: user.sub, 
          amount: dto.amount,
          description: dto.description,
        });
      } else {
        throw new Error('Tính năng Rút tiền đang thi công!');
      }

    }
}
