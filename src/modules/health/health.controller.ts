import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Public } from "@src/common/security/decorators";
import { PrismaService } from "@src/infrastructure/prisma";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}