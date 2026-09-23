import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { requestIdMiddleware } from "./common/http/middleware";
import { GlobalExceptionFilter } from "./common/http/filters";
import { ResponseEnvelopeInterceptor } from "./common/http/interceptors";
import { createGlobalValidationPipe } from "./common/http/pipes";
import { LoggerService } from "./common/observability";

async function bootstrap() {
  // bufferLogs: true để log trong lúc khởi động (trước khi LoggerService sẵn sàng)
  // không bị mất, rồi flush lại khi useLogger() được gọi.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(LoggerService));

  app.setGlobalPrefix("api/v1");

  app.use(requestIdMiddleware);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalPipes(createGlobalValidationPipe());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
