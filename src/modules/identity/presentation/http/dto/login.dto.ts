// src/modules/identity/presentation/http/dto/login.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, MaxLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: "Abcdef1!" })
  @IsNotEmpty()
  password!: string;
  // KHONG them regex/do dai o day - neu them, loi 400 "password sai dinh dang" se vo
  // tinh tiet lo password policy cho ke tan cong qua kenh login (khac kenh register).
}
