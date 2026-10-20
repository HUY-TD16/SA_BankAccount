import { successResponse, errorResponse } from '@src/common/http/swagger/response.schemas';
import { transferResponseSchema } from './dto/money-movement-response.schema';
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

@ApiTags('Money Movement')
@ApiBearerAuth('access-token')
@ApiResponse(errorResponse(400, 'VALIDATION_ERROR: dữ liệu đầu vào không hợp lệ.'))
@ApiResponse(errorResponse(500, 'INTERNAL_ERROR: lỗi nội bộ hệ thống.'))
@ApiResponse(errorResponse(401, 'UNAUTHORIZED: thiếu hoặc không chấp nhận access token.'))
@Controller('transfers')
export class TransfersController {
  constructor(
    private readonly transferMoneyUseCase: TransferMoneyUseCase,
  ) {}

  @ApiOperation({ summary: 'Transfer money between two accounts (UC-08)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Khóa không rỗng do client tạo; được trim và dùng cùng tài khoản nguồn để nhận lại kết quả giao dịch trước đó. Khi thử lại, gửi cùng khóa và payload.',
    required: true,
    schema: { type: 'string', minLength: 1, example: 'transfer-20261020-001' },
  })
  @ApiResponse(successResponse(201, 'Transfer successfully created', transferResponseSchema))
  @ApiResponse(successResponse(200, 'Replay of existing transfer with identical Idempotency-Key', transferResponseSchema))
  @ApiResponse(errorResponse(400, 'VALIDATION_ERROR, SAME_ACCOUNT_TRANSFER hoặc HTTP_ERROR khi thiếu Idempotency-Key'))
  @ApiResponse(errorResponse(404, 'ACCOUNT_NOT_FOUND: Source or destination account not found'))
  @ApiResponse(errorResponse(409, 'INSUFFICIENT_FUNDS hoặc ACCOUNT_NOT_ACTIVE'))
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