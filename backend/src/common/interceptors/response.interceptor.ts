import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

/** Convert camelCase string to snake_case */
function toSnake(key: string): string {
  return key.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Recursively converts all object keys from camelCase to snake_case.
 * Leaves primitive values, Buffer, Date, and null untouched.
 */
function deepToSnake(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Buffer || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(deepToSnake);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toSnake(k)] = deepToSnake(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    // Skip serialization for streaming / download responses
    const res = context.switchToHttp().getResponse<{ headersSent?: boolean }>();
    return next.handle().pipe(
      map((data: T) => {
        // If response was already sent (e.g. CSV export via res.send()), pass through
        if (res.headersSent) return { success: true as const, data };
        return {
          success: true as const,
          data: deepToSnake(data) as T,
        };
      }),
    );
  }
}
