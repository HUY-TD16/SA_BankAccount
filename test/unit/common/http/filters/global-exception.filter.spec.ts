import { ArgumentsHost, HttpException } from '@nestjs/common';
import { GlobalExceptionFilter } from '@src/common/http/filters/global-exception.filter';
import { AppError } from '@src/common/domain/errors/app.error';
import { UnauthorizedError } from '@src/common/domain/errors/common.errors';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = { requestId: 'test-request-id' };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  describe('AppError (lỗi nghiệp vụ)', () => {
    it('trả về đúng envelope cho AppError', () => {
      filter.catch(new UnauthorizedError('INVALID_TOKEN'), mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token rejected: INVALID_TOKEN',
          details: undefined,
        },
        meta: { requestId: 'test-request-id' },
      });
    });

    it('trả về details khi AppError có details', () => {
      class CustomError extends AppError {
        readonly errorCode = 'CUSTOM_ERROR';
        readonly httpStatus = 400;
        constructor() {
          super('Custom message', [{ field: 'email', reason: 'Invalid format' }]);
        }
      }

      filter.catch(new CustomError(), mockHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(response.error.details).toEqual([
        { field: 'email', reason: 'Invalid format' },
      ]);
    });
  });

  describe('HttpException (không phải AppError)', () => {
    it('xử lý HttpException từ NestJS (fallback)', () => {
      filter.catch(new HttpException('Not Found', 404), mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'HTTP_ERROR', message: 'Not Found' },
        meta: { requestId: 'test-request-id' },
      });
    });
  });

  describe('Unhandled exception (lỗi không xác định)', () => {
    it('trả về 500 cho Error không xác định', () => {
      filter.catch(new Error('Unexpected error'), mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected internal error' },
        meta: { requestId: 'test-request-id' },
      });
    });

    it('KHÔNG trả stack trace ra client (security)', () => {
      const error = new Error('Sensitive internal error');
      error.stack = 'Sensitive stack trace...';

      filter.catch(error, mockHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.error.message).toBe('Unexpected internal error');
      expect(response.error.message).not.toContain('Sensitive');
    });

    it('trả về 500 cho exception không phải Error (string)', () => {
      filter.catch('Some random string error', mockHost);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('requestId trong meta', () => {
    it('đọc requestId từ request', () => {
      mockRequest.requestId = 'custom-id-123';
      filter.catch(new UnauthorizedError(), mockHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.meta.requestId).toBe('custom-id-123');
    });

    it('fallback "unknown" khi thiếu requestId', () => {
      mockRequest.requestId = undefined;
      filter.catch(new UnauthorizedError(), mockHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.meta.requestId).toBe('unknown');
    });
  });
});
