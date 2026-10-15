import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication } from "@nestjs/common";

export function setupSwagger(app: INestApplication): void {
  const environment = process.env.NODE_ENV || "development";

  if (environment !== "production") {
    const config = new DocumentBuilder()
      .setTitle("SA Bank Account API")
      .setDescription(
        "API documentation for SA Bank Account System - Phase 1 (Identity, Accounts, Money Movement)",
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
