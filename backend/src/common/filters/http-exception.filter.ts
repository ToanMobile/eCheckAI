import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    correlationId?: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        code = this.toErrorCode(exceptionResponse);
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        if (typeof resp['message'] === 'string') {
          code = this.toErrorCode(resp['message']);
          message = resp['message'];
        } else if (Array.isArray(resp['message'])) {
          code = 'VALIDATION_ERROR';
          message = (resp['message'] as string[]).join('; ');
        } else {
          code = this.toErrorCode(exception.message);
          message = exception.message;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        { correlationId: request.correlationId },
      );
      message = exception.message;
    }

    const body: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        statusCode,
        correlationId: request.correlationId,
      },
    };

    response.status(statusCode).json(body);
  }

  private toErrorCode(message: string): string {
    return message
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }
}
