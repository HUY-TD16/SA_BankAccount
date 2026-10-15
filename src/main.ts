import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { requestIdMiddleware } from "@src/common/http/middleware";
import { GlobalExceptionFilter } from "@src/common/http/filters";
import {
  ResponseEnvelopeInterceptor,
  HttpLoggingInterceptor,
} from "@src/common/http/interceptors";
import { createGlobalValidationPipe } from "@src/common/http/pipes";
import { LoggerService } from "@src/common/observability";
import { setupSwagger } from "@src/common/http/swagger/swagger.config";

async function bootstrap() {
  // bufferLogs: true để log trong lúc khởi động (trước khi LoggerService sẵn sàng)
  // không bị mất, rồi flush lại khi useLogger() được gọi.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(LoggerService));

  app.setGlobalPrefix("api/v1");

  app.use(requestIdMiddleware);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new HttpLoggingInterceptor(),
    new ResponseEnvelopeInterceptor(),
  );
  app.useGlobalPipes(createGlobalValidationPipe());
  app.enableShutdownHooks();

  // Setup Swagger UI & OpenAPI JSON spec
  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
