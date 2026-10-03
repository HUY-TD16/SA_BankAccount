import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { LoggerService } from "@src/common/observability";

/**
 * PrismaService
 *
 * Bọc PrismaClient, gắn lifecycle hook với NestJS module lifecycle:
 * - OnModuleInit: $connect() khi app khởi động (fail-fast nếu DB không sẵn sàng)
 * - OnModuleDestroy: $disconnect() khi app shutdown (cần app.enableShutdownHooks()
 *   trong main.ts để hook này thực sự được gọi khi nhận SIGTERM, ví dụ docker compose down)
 *
 * Không chứa transaction helper, không chứa middleware query logging.
 * Việc bọc prisma.$transaction() thuộc về UnitOfWorkPort/PrismaUnitOfWork
 * ở modules/money-movement — KHÔNG đặt ở đây (xem db.md mục 3.4 và mục 9).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const connectionString = configService.getOrThrow<string>("database.url");
    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log("Database connection established", PrismaService.name);
    } catch (error) {
      this.logger.error(
        "Failed to establish database connection",
        error instanceof Error ? error.stack : undefined,
        PrismaService.name,
      );
      // Re-throw để app crash ngay lúc startup thay vì chạy "trông như bình thường"
      // với kết nối DB hỏng — đúng nguyên tắc fail-fast.
      throw error;
    }
  }

  //   async onModuleDestroy(): Promise<void> {
  //     await this.$disconnect();
  //     this.logger.log("Database connection closed", PrismaService.name);
  //   }
  // }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log("Database connection closed", PrismaService.name);
    } catch (error) {
      this.logger.error(
        "Error during database disconnection",
        error instanceof Error ? error.stack : undefined,
        PrismaService.name,
      );
      // KHÔNG re-throw ở đây — app đang shutdown rồi, crash thêm không có ích
    }
  }
}
