'use strict';
/**
 * Manual CJS mock của @nestjs/common cho Jest unit tests.
 * Chỉ stub những gì src/common/* thực sự import — không cần stub toàn bộ NestJS.
 *
 * Decorator factories (Injectable, Catch, SetMetadata, v.v.) trả về hàm no-op
 * để TypeScript decorator syntax (@ syntax) hoạt động bình thường.
 */

// --- Decorator stubs ---
const noopDecorator = () => () => {};            // @Decorator() → ()=>void
const noopParamDecorator = () => () => {};       // @Inject(token) → ()=>void

const Injectable  = noopDecorator;
const Catch       = noopDecorator;
const SetMetadata = (_key, _val) => noopDecorator();
const Inject      = noopParamDecorator;
const createParamDecorator = (_fn) => noopDecorator();

// --- Base classes ---
class Logger {
  constructor() {}
  log()   {}
  error() {}
  warn()  {}
  debug() {}
  verbose() {}
}

class ConsoleLogger {
  constructor() {}
  log(...args)     { console.log(...args); }
  error(...args)   { console.error(...args); }
  warn(...args)    { console.warn(...args); }
  debug(...args)   { console.debug(...args); }
  verbose(...args) { console.log(...args); }
}

// --- Exception classes ---
class HttpException extends Error {
  constructor(response, status) {
    super(typeof response === 'string' ? response : JSON.stringify(response));
    this.status  = status;
    this.response = response;
  }
  getStatus()   { return this.status; }
  getResponse() { return this.response; }
}

// NestValidationError — plain object shape dùng trong exceptionFactory callback
// Không cần class thật, chỉ cần type shape cho TypeScript; JS chỉ cần object.

// --- ValidationPipe ---
class ValidationPipe {
  constructor(options) {
    this.options = options;
  }
}

// --- Interfaces (types only — không cần runtime value) ---
// ExecutionContext, CallHandler, NestInterceptor, ExceptionFilter, CanActivate,
// ValidationPipeOptions, LoggerService — chỉ là TypeScript interface, không có runtime value.

module.exports = {
  // Decorators
  Injectable,
  Catch,
  SetMetadata,
  Inject,
  createParamDecorator,

  // Classes
  Logger,
  ConsoleLogger,
  HttpException,
  ValidationPipe,

  // Scope enum (dùng đôi khi)
  Scope: { DEFAULT: 0, REQUEST: 1, TRANSIENT: 2 },
};
