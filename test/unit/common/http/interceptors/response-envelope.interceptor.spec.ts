import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import {
  Paginated,
  ResponseEnvelopeInterceptor,
} from '@src/common/http/interceptors/response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  let interceptor: ResponseEnvelopeInterceptor;
  let mockExecutionContext: ExecutionContext;

  function buildContext(requestId?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ requestId }),
      }),
    } as unknown as ExecutionContext;
  }

  function buildHandler(returnValue: unknown): CallHandler {
    return { handle: () => of(returnValue) };
  }

  beforeEach(() => {
    interceptor = new ResponseEnvelopeInterceptor();
    mockExecutionContext = buildContext('test-request-id');
  });

  describe('Success response (non-paginated)', () => {
    it('bọc data thường trong success envelope', (done) => {
      const testData = { id: '1', name: 'Test' };

      interceptor.intercept(mockExecutionContext, buildHandler(testData)).subscribe((result) => {
        expect(result).toEqual({
          success: true,
          data: testData,
          meta: { requestId: 'test-request-id' },
        });
        done();
      });
    });

    it('bọc array trong success envelope', (done) => {
      const testData = [{ id: '1' }, { id: '2' }];

      interceptor.intercept(mockExecutionContext, buildHandler(testData)).subscribe((result) => {
        expect(result).toEqual({
          success: true,
          data: testData,
          meta: { requestId: 'test-request-id' },
        });
        done();
      });
    });
  });

  describe('Paginated response', () => {
    it('bọc Paginated trong success envelope với pagination meta', (done) => {
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const paginated = new Paginated(items, 1, 10, 25);

      interceptor.intercept(mockExecutionContext, buildHandler(paginated)).subscribe((result) => {
        expect(result).toEqual({
          success: true,
          data: items,
          pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
          meta: { requestId: 'test-request-id' },
        });
        done();
      });
    });

    it('tính totalPages đúng khi total chia hết cho limit', (done) => {
      interceptor
        .intercept(mockExecutionContext, buildHandler(new Paginated([], 2, 10, 20)))
        .subscribe((result: any) => {
          expect(result.pagination.totalPages).toBe(2);
          done();
        });
    });

    it('tính totalPages đúng khi total chia có dư', (done) => {
      interceptor
        .intercept(mockExecutionContext, buildHandler(new Paginated([], 1, 10, 23)))
        .subscribe((result: any) => {
          expect(result.pagination.totalPages).toBe(3);
          done();
        });
    });

    it('totalPages = 1 khi total = 0', (done) => {
      interceptor
        .intercept(mockExecutionContext, buildHandler(new Paginated([], 1, 10, 0)))
        .subscribe((result: any) => {
          expect(result.pagination.totalPages).toBe(1);
          done();
        });
    });
  });

  describe('204 No Content', () => {
    it('giữ nguyên undefined — không bọc envelope', (done) => {
      interceptor
        .intercept(mockExecutionContext, buildHandler(undefined))
        .subscribe((result) => {
          expect(result).toBeUndefined();
          done();
        });
    });
  });

  describe('requestId fallback', () => {
    it('fallback "unknown" khi thiếu requestId', (done) => {
      const ctx = buildContext(undefined);

      interceptor
        .intercept(ctx, buildHandler({ data: 'test' }))
        .subscribe((result: any) => {
          expect(result.meta.requestId).toBe('unknown');
          done();
        });
    });
  });
});
