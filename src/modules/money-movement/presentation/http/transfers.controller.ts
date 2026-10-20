import { 
  Body, 
  Controller, 
  Post, 
  Headers, 
  Res, 
  HttpStatus, 
  BadRequestException 
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/security/decorators';
import { AccessTokenPayload } from '../../../../common/security/ports';
import { TransferMoneyDto } from './dto/transfer-money.dto';
import { TransferMoneyUseCase } from '../../application/use-cases/transfer-money.use-case';

@ApiTags('transfers')
@ApiBearerAuth('access-token')
@Controller('transfers')
export class TransfersController {
  constructor(
    private readonly transferMoneyUseCase: TransferMoneyUseCase,
  ) {}

  @ApiOperation({ summary: 'Transfer money between two accounts (UC-08)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique UUID key in header to guarantee transfer idempotency',
    required: true,
  })
  @ApiResponse({ status: 201, description: 'Transfer successfully created' })
  @ApiResponse({ status: 200, description: 'Replay of existing transfer with identical Idempotency-Key' })
  @ApiResponse({ status: 400, description: 'Invalid input data or missing Idempotency-Key header' })
  @ApiResponse({ status: 404, description: 'Source or destination account not found' })
  @ApiResponse({ status: 409, description: 'Insufficient funds, closed account, or duplicate key conflict' })
  @Post()
  async transfer(
    @Body() dto: TransferMoneyDto,
    @CurrentUser() user: AccessTokenPayload,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const result = await this.transferMoneyUseCase.execute({
      sourceAccountId: dto.sourceAccountId,
      destinationAccountNumber: dto.destinationAccountNumber,
      amount: dto.amount,
      description: dto.description,
      initiatedByUserId: user.sub,
      idempotencyKey: idempotencyKey.trim(),
    });

    if (result.isReplay) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }

    return result.transfer;
  }
}