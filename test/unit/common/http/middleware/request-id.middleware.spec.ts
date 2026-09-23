import { Request, Response, NextFunction } from 'express';
import {
  requestIdMiddleware,
  RequestWithId,
} from '@src/common/http/middleware/request-id.middleware';

describe('requestIdMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = { setHeader: jest.fn() };
    mockNext = jest.fn();
  });

  it('sinh requestId vào request', () => {
    requestIdMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    const req = mockRequest as RequestWithId;
    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
  });

  it('set header X-Request-Id vào response', () => {
    requestIdMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    const req = mockRequest as RequestWithId;
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
  });

  it('gọi next() để tiếp tục middleware chain', () => {
    requestIdMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('sinh UUID khác nhau mỗi lần gọi', () => {
    const req1 = {} as Request;
    const req2 = {} as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;

    requestIdMiddleware(req1, res, jest.fn());
    requestIdMiddleware(req2, res, jest.fn());

    expect((req1 as RequestWithId).requestId).not.toBe((req2 as RequestWithId).requestId);
  });

  it('requestId có format UUID v4', () => {
    requestIdMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect((mockRequest as RequestWithId).requestId).toMatch(uuidRegex);
  });
});
