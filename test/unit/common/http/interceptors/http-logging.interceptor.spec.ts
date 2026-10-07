import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";
import { HttpLoggingInterceptor } from "@src/common/http/interceptors/http-logging.interceptor";

describe("HttpLoggingInterceptor", () => {
  let interceptor: HttpLoggingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let loggerLogSpy: jest.SpyInstance;

  function buildContext(options?: {
    requestId?: string;
    method?: string;
    originalUrl?: string;
    statusCode?: number;
  }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          requestId: options?.requestId,
          method: options?.method ?? "POST",
          originalUrl: options?.originalUrl ?? "/api/v1/auth/login",
        }),
        getResponse: () => ({
          statusCode: options?.statusCode ?? 200,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  function buildHandler(returnValue: unknown): CallHandler {
    return { handle: () => of(returnValue) };
  }

  beforeEach(() => {
    interceptor = new HttpLoggingInterceptor();
    loggerLogSpy = jest
      .spyOn((interceptor as any).logger, "log")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("ghi log dung format khi request thanh cong", (done) => {
    mockExecutionContext = buildContext({
      requestId: "req-123",
      method: "POST",
      originalUrl: "/api/v1/auth/register",
      statusCode: 201,
    });

    interceptor
      .intercept(mockExecutionContext, buildHandler({ id: "1" }))
      .subscribe(() => {
        expect(loggerLogSpy).toHaveBeenCalledTimes(1);
        expect(loggerLogSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /\[req-123\] POST \/api\/v1\/auth\/register 201 \+\d+ms/,
          ),
        );
        done();
      });
  });

  it("fallback 'unknown' khi thieu requestId va dung url mac dinh", (done) => {
    mockExecutionContext = buildContext({
      requestId: undefined,
      method: "GET",
      originalUrl: undefined,
      statusCode: 200,
    });

    interceptor
      .intercept(mockExecutionContext, buildHandler([]))
      .subscribe(() => {
        expect(loggerLogSpy).toHaveBeenCalledTimes(1);
        expect(loggerLogSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[unknown\] GET \/api\/v1\/auth\/login 200 \+\d+ms/),
        );
        done();
      });
  });
});
