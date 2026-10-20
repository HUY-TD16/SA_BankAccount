import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication } from "@nestjs/common";

export function setupSwagger(app: INestApplication): void {
  const environment = process.env.NODE_ENV || "development";

  if (environment !== "production") {
    const config = new DocumentBuilder()
      .setTitle("SA Bank Account API")
      .setDescription(
        "SA Bank Account API — Identity, Accounts, Money Movement. Đăng ký và đăng nhập để lấy data.accessToken, sau đó nhập token vào Authorize (không thêm Bearer). Tiền VND dùng chuỗi số nguyên. Response thành công có success/data/meta; danh sách thêm pagination. Lỗi có success/error/meta. X-Request-Id dùng để truy vết. Đóng tài khoản trả 204, body rỗng.",
      )
      .setVersion("1.0.0")
      .addServer("/", "Current server")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          name: "JWT",
          description: "Enter JWT access token",
          in: "header",
        },
        "access-token",
      )
      .addTag("Identity", "Authentication & User Management")
      .addTag("Accounts", "Bank Account Management")
      .addTag("Money Movement", "Deposits, Withdrawals & Transfers")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document, {
      jsonDocumentUrl: "api/docs.json",
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: "alpha",
        operationsSorter: "alpha",
      },
    });
  }
}
