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

@ApiTags('accounts')
@ApiBearerAuth('bearerAuth')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly openAccount: OpenAccountUseCase,
    private readonly listAccounts: ListAccountsUseCase,
    private readonly getAccount: GetAccountUseCase,
    private readonly closeAccount: CloseAccountUseCase,
  ) {}

  @ApiOperation({ summary: 'Mở tài khoản' })
  @ApiResponse({ status: 201, description: 'Tạo tài khoản thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
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
  @ApiResponse({ status: 200, description: 'Danh sách có phân trang' })
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
  @ApiParam({ name: 'accountId', description: 'UUID của tài khoản' })
  @ApiResponse({ status: 200, description: 'Chi tiết tài khoản' })
  @ApiResponse({ status: 404, description: 'Không tồn tại hoặc không sở hữu' })
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
  @ApiParam({ name: 'accountId', description: 'UUID của tài khoản' })
  @ApiResponse({ status: 204, description: 'Đóng tài khoản thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 404, description: 'Không tồn tại hoặc không sở hữu' })
  @ApiResponse({ status: 409, description: 'Tài khoản vẫn còn số dư' })
  @Delete(':accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async close(
   @CurrentUser() user: AccessTokenPayload,
    @Param() params: AccountIdParamsDto,
  ): Promise<void> {
    await this.closeAccount.execute(user.sub, params.accountId);
  }
}