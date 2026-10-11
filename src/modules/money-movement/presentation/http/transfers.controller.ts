import { Body, Controller, HttpCode, HttpStatus, Post, BadRequestException, Headers} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/security/decorators';
import { AccessTokenPayload } from '../../../../common/security/ports';
import { TransferMoneyDto } from './dto/transfer-money.dto';
import { TransferMoneyUseCase } from '../../application/use-cases/transfer-money.use-case';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(
    private readonly transferMoneyUseCase: TransferMoneyUseCase,
  ) {}

  @ApiOperation({ summary: 'Transfer money between two accounts (UC-08)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique UUID key to prevent duplicate transfers',
    required: false,
  })
  @ApiResponse({ status: 201, description: 'Transfer successful' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 409, description: 'Insufficient funds or duplicate transaction' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async transfer(
    @Body() dto: TransferMoneyDto,
    @CurrentUser() user: AccessTokenPayload,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    const idempotencyKey = idempotencyHeader || dto.idempotencyKey;
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key is required (either in Header or Body)');
    }

    return this.transferMoneyUseCase.execute({
      sourceAccountId: dto.sourceAccountId,
      destinationAccountId: dto.destinationAccountId,
      amount: dto.amount,
      description: dto.description,
      initiatedByUserId: user.sub,
      idempotencyKey: idempotencyKey,
    });
  } 
}


