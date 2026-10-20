import { 
  Body, 
  Controller, 
  Get, 
  HttpCode, 
  HttpStatus, 
  Param, 
  Post, 
  Query 
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { Paginated } from '../../../../common/http/interceptors/response-envelope.interceptor';
import { CurrentUser } from '../../../../common/security/decorators';
import { AccessTokenPayload } from '../../../../common/security/ports';
import { CreateTransactionDto, TransactionTypeDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { DepositMoneyUseCase } from '../../application/use-cases/deposit-money.use-case';
import { WithdrawMoneyUseCase } from '../../application/use-cases/withdraw-money.use-case';
import { GetTransactionHistoryUseCase } from '../../application/use-cases/get-transaction-history.use-case';

@ApiTags('transactions')
@ApiBearerAuth('access-token')
@Controller('accounts') 
export class TransactionController {
  constructor(
    private readonly depositMoneyUseCase: DepositMoneyUseCase,
    private readonly withdrawMoneyUseCase: WithdrawMoneyUseCase,
    private readonly getTransactionHistoryUseCase: GetTransactionHistoryUseCase,
  ) {}

  @ApiOperation({ summary: 'Create a deposit or withdrawal transaction (UC-05, UC-06)' })
  @ApiResponse({ status: 201, description: 'Transaction executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid amount or transaction type' })
  @ApiResponse({ status: 404, description: 'Account not found or not owned by user' })
  @ApiResponse({ status: 409, description: 'Insufficient funds or account closed' })
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
      return this.withdrawMoneyUseCase.execute({
        accountId: accountId,
        userId: user.sub,
        amount: dto.amount,
        description: dto.description,
      });
    }
  }

  @ApiOperation({ summary: 'Get paginated transaction history with filters (UC-06)' })
  @ApiParam({ name: 'accountId', description: 'UUID of the bank account' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  @ApiResponse({ status: 404, description: 'Account not found or not owned by authenticated user' })
  @Get(':accountId/transactions')
  async getTransactions(
    @Param('accountId') accountId: string,
    @Query() query: ListTransactionsQueryDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    const result = await this.getTransactionHistoryUseCase.execute({
      accountId,
      userId: user.sub,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return new Paginated(
      result.items,
      result.page,
      result.limit,
      result.total,
    );
  }
}
