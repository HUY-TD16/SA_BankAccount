import { ExecutionContext } from '@nestjs/common';

/**
 * Mock ExecutionContext cho test Guards / Interceptors / Decorators
 */
export function createMockExecutionContext(options: {
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  user?: unknown;
}): ExecutionContext {
  const request = {
    headers: options.headers ?? {},
    body: options.body,
    query: options.query ?? {},
    params: options.params ?? {},
    user: options.user,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as unknown as ExecutionContext;
}
