import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception.message || null;
    const errorResponse = exception.getResponse() || null;

    // The path without its query string: a query can carry a code or token.
    const path = request.path;
    const logData = {
      statusCode: status,
      path,
      method: request.method,
      timestamp: new Date().toISOString(),
      message,
      errorResponse,
    };

    // Don't log authentication/authorization errors (4xx status codes related to auth).
    // Never log headers, query or body: they carry cookies, tokens, codes,
    // passwords and email addresses.
    if (status >= 500) {
      this.logger.error(
        `HTTP Exception: ${status} - ${request.method} ${path}`,
        logData,
      );
    } else if (status !== 401 && status !== 403 && status !== 404) {
      // Only log non-auth 4xx errors
      this.logger.debug(`HTTP ${status} - ${request.method} ${path}`, logData);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message,
    });
  }
}
