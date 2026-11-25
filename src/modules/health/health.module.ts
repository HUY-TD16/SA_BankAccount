import { Module } from "@nestjs/common";
import { PrismaModule } from "@src/infrastructure/prisma";
import { HealthController } from "./health.controller";

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
