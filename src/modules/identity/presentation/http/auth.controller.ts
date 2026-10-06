// src/modules/identity/presentation/http/auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "@src/common/security/decorators";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterUserUseCase } from "../../application/use-cases/register-user.use-case";
import { LoginUseCase } from "../../application/use-cases/login.use-case";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @ApiOperation({ summary: "Dang ky user moi" })
  @ApiResponse({ status: 201, description: "Tao user thanh cong" })
  @ApiResponse({ status: 400, description: "Du lieu khong hop le" })
  @ApiResponse({ status: 409, description: "Email da ton tai" })
  @Public() // BAT BUOC - thieu dong nay se bi AccessTokenGuard chan 401
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    // Controller CHI goi use case - khong query DB, khong kiem tra logic,
    // khong tu ky JWT o day.
    return this.registerUserUseCase.execute(dto);
  }

  @ApiOperation({ summary: "Dang nhap, nhan JWT access token" })
  @ApiResponse({ status: 200, description: "Dang nhap thanh cong" })
  @ApiResponse({ status: 401, description: "Email hoac mat khau khong dung" })
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }
}
