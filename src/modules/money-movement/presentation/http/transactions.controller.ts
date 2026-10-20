import { successResponse, errorResponse } from '@src/common/http/swagger/response.schemas';
import { transactionResponseSchema } from './dto/money-movement-response.schema';
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

@ApiTags('Money Movement')
@ApiBearerAuth('access-token')
@ApiResponse(errorResponse(400, 'VALIDATION_ERROR: dữ liệu đầu vào không hợp lệ.'))
@ApiResponse(errorResponse(500, 'INTERNAL_ERROR: lỗi nội bộ hệ thống.'))
@ApiResponse(errorResponse(401, 'UNAUTHORIZED: thiếu hoặc không chấp nhận access token.'))
@Controller('accounts') 
export class TransactionController {
  constructor(
    private readonly depositMoneyUseCase: DepositMoneyUseCase,
    private readonly withdrawMoneyUseCase: WithdrawMoneyUseCase,
    private readonly getTransactionHistoryUseCase: GetTransactionHistoryUseCase,
  ) {}

  @ApiOperation({ summary: 'Create a deposit or withdrawal transaction (UC-05, UC-06)' })
  @ApiResponse(successResponse(201, 'Transaction executed successfully', transactionResponseSchema))
  @ApiResponse(errorResponse(400, 'VALIDATION_ERROR: Invalid amount or transaction type'))
  @ApiResponse(errorResponse(404, 'ACCOUNT_NOT_FOUND: Account not found or not owned by user'))
  @ApiResponse(errorResponse(409, 'INSUFFICIENT_FUNDS hoặc ACCOUNT_NOT_ACTIVE'))
  @ApiParam({ name: 'accountId', description: 'UUID of the bank account', format: 'uuid' })
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
  @ApiParam({ name: 'accountId', description: 'UUID of the bank account', format: 'uuid' })
  @ApiResponse(successResponse(200, 'Paginated list of transactions', transactionResponseSchema, true))
  @ApiResponse(errorResponse(404, 'ACCOUNT_NOT_FOUND: Account not found or not owned by authenticated user'))
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
