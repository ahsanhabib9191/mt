import dotenv from 'dotenv';
import { AppError, errorHandler, asyncHandler } from '../lib/middleware/error-handler';
import type { IncomingMessage, ServerResponse } from 'http';

dotenv.config();

function makeReq(headers: Record<string, string> = {}): IncomingMessage {
  return { headers, socket: { remoteAddress: '127.0.0.1' } } as any;
}

function makeRes(): ServerResponse & { statusCode: number; _headers: Record<string, string>; _body: string } {
  const res: any = {
    statusCode: 200,
    _headers: {},
    _body: '',
    setHeader(key: string, value: string) {
      this._headers[key] = value;
    },
    end(body: string) {
      this._body = body;
    },
  };
  return res;
}

async function run() {
  console.log('Testing error handler middleware...');

  // Test AppError static constructors
  const badRequest = AppError.badRequest('Missing field', { field: 'email' });
  if (badRequest.statusCode !== 400) throw new Error('badRequest status code incorrect');
  if (badRequest.code !== 'BAD_REQUEST') throw new Error('badRequest code incorrect');
  if (!badRequest.details || badRequest.details.field !== 'email') {
    throw new Error('badRequest details incorrect');
  }

  const unauthorized = AppError.unauthorized('Invalid token');
  if (unauthorized.statusCode !== 401) throw new Error('unauthorized status code incorrect');
  if (unauthorized.code !== 'UNAUTHORIZED') throw new Error('unauthorized code incorrect');

  const forbidden = AppError.forbidden('Access denied');
  if (forbidden.statusCode !== 403) throw new Error('forbidden status code incorrect');
  if (forbidden.code !== 'FORBIDDEN') throw new Error('forbidden code incorrect');

  const notFound = AppError.notFound('Resource not found');
  if (notFound.statusCode !== 404) throw new Error('notFound status code incorrect');
  if (notFound.code !== 'NOT_FOUND') throw new Error('notFound code incorrect');

  const internal = AppError.internal('Server error', { stack: 'test' });
  if (internal.statusCode !== 500) throw new Error('internal status code incorrect');
  if (internal.code !== 'INTERNAL') throw new Error('internal code incorrect');

  // Test errorHandler function
  const req = makeReq({ 'x-request-id': 'test-123' });
  const res = makeRes();
  const next = () => { };

  const testError = AppError.badRequest('Test error', { test: true });
  errorHandler(testError, req as any, res as any, next as any);

  if (res.statusCode !== 400) throw new Error('errorHandler did not set correct status code');
  if (res._headers['Content-Type'] !== 'application/json') {
    throw new Error('errorHandler did not set content-type');
  }

  const responseBody = JSON.parse(res._body);
  if (responseBody.status !== 'error') throw new Error('Response status incorrect');
  if (responseBody.code !== 'BAD_REQUEST') throw new Error('Response code incorrect');
  if (responseBody.message !== 'Test error') throw new Error('Response message incorrect');
  if (responseBody.requestId !== 'test-123') throw new Error('Response requestId incorrect');
  if (!responseBody.timestamp) throw new Error('Response timestamp missing');

  // Test errorHandler with non-AppError (should convert to internal error)
  const res2 = makeRes();
  const genericError = new Error('Generic error');
  errorHandler(genericError, req as any, res2 as any, next as any);

  if (res2.statusCode !== 500) throw new Error('Generic error should result in 500');
  const response2 = JSON.parse(res2._body);
  if (response2.code !== 'INTERNAL') throw new Error('Generic error should have INTERNAL code');

  // Test asyncHandler wrapper
  let handlerCalled = false;
  const successHandler = asyncHandler(async (req, res) => {
    handlerCalled = true;
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
  });

  const reqSuccess = makeReq();
  const resSuccess = makeRes();
  await successHandler(reqSuccess as any, resSuccess as any, next as any);

  if (!handlerCalled) throw new Error('asyncHandler did not call wrapped handler');
  if (resSuccess.statusCode !== 200) throw new Error('Success handler status incorrect');

  // Test asyncHandler with thrown error
  const errorHandler2 = asyncHandler(async (req, res) => {
    throw AppError.forbidden('No access');
  });

  const reqError = makeReq({ 'x-request-id': 'error-456' });
  const resError = makeRes();
  await errorHandler2(reqError as any, resError as any, next as any);

  if (resError.statusCode !== 403) throw new Error('asyncHandler did not handle thrown error');
  const errorResponse = JSON.parse(resError._body);
  if (errorResponse.code !== 'FORBIDDEN') throw new Error('Error response code incorrect');
  if (errorResponse.message !== 'No access') throw new Error('Error message incorrect');

  // Test error response structure in production mode
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const resProd = makeRes();
  const prodError = AppError.internal('Internal details', { sensitive: 'data' });
  errorHandler(prodError, req as any, resProd as any, next as any);

  const prodResponse = JSON.parse(resProd._body);
  if (prodResponse.details !== undefined) {
    throw new Error('Production mode should not expose error details');
  }

  process.env.NODE_ENV = originalEnv;

  // Test error with missing request ID
  const reqNoId = makeReq();
  const resNoId = makeRes();
  errorHandler(AppError.notFound('Missing'), reqNoId as any, resNoId as any, next as any);

  const responseNoId = JSON.parse(resNoId._body);
  if (responseNoId.requestId !== '') throw new Error('Missing requestId should be empty string');

  // Test AppError properties
  const customError = new AppError('Custom', 418, 'CUSTOM_CODE', { custom: true }, false);
  if (customError.statusCode !== 418) throw new Error('Custom status code incorrect');
  if (customError.code !== 'CUSTOM_CODE') throw new Error('Custom code incorrect');
  if (customError.isOperational !== false) throw new Error('isOperational flag incorrect');

  console.log('✅ All error handler tests passed');
}

run().catch((err) => {
  console.error('❌ Error handler tests failed:', err.message);
  process.exit(1);
});