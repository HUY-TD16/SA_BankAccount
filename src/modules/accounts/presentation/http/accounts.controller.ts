import { successResponse, errorResponse } from '@src/common/http/swagger/response.schemas';
import { accountResponseSchema } from './dto/account-response.schema';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Paginated } from '@src/common/http/interceptors/response-envelope.interceptor';
import { CurrentUser } from '@src/common/security/decorators/current-user.decorator';
import type { AccessTokenPayload } from '@src/common/security/ports/token-service.port';

import { GetAccountUseCase } from '../../application/use-cases/get-account.use-case';
import { ListAccountsUseCase } from '../../application/use-cases/list-accounts.use-case';
import { OpenAccountUseCase } from '../../application/use-cases/open-account.use-case';
import {CloseAccountUseCase} from "../../application/use-cases/close-account.use-case";
import type { BankAccount } from '../../domain/entities/bank-account.entity';

import { AccountIdParamsDto } from './dto/account-id-params.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { OpenAccountDto } from './dto/open-account.dto';

function toAccountResponse(account: BankAccount) {
  return {
    id: account.id,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    accountType: account.accountType,
    currentBalance: account.currentBalance.toDecimalString(),
    currency: account.currency,
    status: account.status,
    createdAt: account.createdAt.toISOString(),
    closedAt: account.closedAt?.toISOString() ?? null,
  };
}

@ApiTags('Accounts')
@ApiBearerAuth('access-token')
@ApiResponse(errorResponse(400, 'VALIDATION_ERROR: dữ liệu đầu vào không hợp lệ.'))
@ApiResponse(errorResponse(500, 'INTERNAL_ERROR: lỗi nội bộ hệ thống.'))
@ApiResponse(errorResponse(401, 'UNAUTHORIZED: thiếu hoặc không chấp nhận access token.'))
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly openAccount: OpenAccountUseCase,
    private readonly listAccounts: ListAccountsUseCase,
    private readonly getAccount: GetAccountUseCase,
    private readonly closeAccount: CloseAccountUseCase,
  ) {}

  @ApiOperation({ summary: 'Mở tài khoản' })
  @ApiResponse(successResponse(201, 'Tạo tài khoản thành công', accountResponseSchema))
  @ApiResponse(errorResponse(400, 'VALIDATION_ERROR: Dữ liệu không hợp lệ'))
  @ApiResponse(errorResponse(401, 'UNAUTHORIZED: Thiếu hoặc không chấp nhận access token'))
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: OpenAccountDto,
  ) {
    const account = await this.openAccount.execute(user.sub, dto);
    return toAccountResponse(account);
  }

  @ApiOperation({ summary: 'Liệt kê tài khoản của tôi' })
  @ApiResponse(successResponse(200, 'Danh sách có phân trang', accountResponseSchema, true))
  @Get()
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListAccountsQueryDto,
  ) {
    const result = await this.listAccounts.execute(user.sub, query);

    return new Paginated(
      result.items.map(toAccountResponse),
      query.page ?? 1,
      query.limit ?? 20,
      result.total,
    );
  }

  @ApiOperation({ summary: 'Xem chi tiết tài khoản của tôi' })
  @ApiParam({ name: 'accountId', description: 'UUID v4 của tài khoản', format: 'uuid' })
  @ApiResponse(successResponse(200, 'Chi tiết tài khoản', accountResponseSchema))
  @ApiResponse(errorResponse(404, 'ACCOUNT_NOT_FOUND: Không tồn tại hoặc không sở hữu'))
  @Get(':accountId')
  async get(
    @CurrentUser() user: AccessTokenPayload,
    @Param() params: AccountIdParamsDto,
  ) {
    const account = await this.getAccount.execute(
      user.sub,
      params.accountId,
    );

    return toAccountResponse(account);
  }

  @ApiOperation({ summary: 'Đóng tài khoản' })
  @ApiParam({ name: 'accountId', description: 'UUID v4 của tài khoản', format: 'uuid' })
  @ApiResponse(successResponse(204, 'Đóng tài khoản thành công'))
  @ApiResponse(errorResponse(401, 'UNAUTHORIZED: Thiếu hoặc không chấp nhận access token'))
  @ApiResponse(errorResponse(404, 'ACCOUNT_NOT_FOUND: Không tồn tại hoặc không sở hữu'))
  @ApiResponse(errorResponse(409, 'ACCOUNT_HAS_BALANCE: Tài khoản vẫn còn số dư'))
  @Delete(':accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async close(
   @CurrentUser() user: AccessTokenPayload,
    @Param() params: AccountIdParamsDto,
  ): Promise<void> {
    await this.closeAccount.execute(user.sub, params.accountId);
  }
}
