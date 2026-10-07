// src/modules/identity/presentation/http/dto/register.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

// (?=.*[a-z]) co chu thuong, (?=.*[A-Z]) co chu hoa, (?=.*\d) co so,
// (?=.*[^A-Za-z0-9]) co ky tu dac biet, \S{8,72} khong khoang trang, dai 8-72
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,72}$/;

export class RegisterDto {
  @ApiProperty({ example: "Nguyen Van A" })
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: "Abcdef1!",
    description: "8-72 ky tu, co hoa/thuong/so/ky tu dac biet",
  })
  @Matches(PASSWORD_REGEX, {
    message:
      "password phai 8-72 ky tu, gom chu hoa, chu thuong, so va ky tu dac biet, khong khoang trang",
  })
  password!: string;

  @ApiProperty({ example: "Abcdef1!" })
  @IsNotEmpty()
  confirmPassword!: string;
}
