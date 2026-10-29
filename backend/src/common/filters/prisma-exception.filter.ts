import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client';
import { isDatabaseUnavailable } from '../../prisma/database-unavailable';

// Turns database errors that reach the HTTP layer into proper status codes.
// Without this filter, a race such as two parallel sign-ups with one email
// fails with a generic 500 instead of a 409 the client can act on, and a
// database outage looks like a bug instead of a 503.
// Returns undefined for errors that do not come from the database.
export function toHttpException(error: unknown): HttpException | undefined {
  if (isDatabaseUnavailable(error)) {
    return new ServiceUnavailableException('Database unavailable');
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return undefined;
  }

  switch (error.code) {
    // Unique constraint failed.
    case 'P2002':
      return new ConflictException('Resource already exists');
    // Foreign key constraint failed, e.g. the parent row was just deleted.
    case 'P2003':
      return new ConflictException('Related resource no longer exists');
    // Record required by the operation was not found.
    case 'P2025':
      return new NotFoundException('Resource not found');
    default:
      return new InternalServerErrorException();
  }
}

// Lines of a Prisma message that only point at the calling code: the
// "Invalid `prisma.user.findUnique()` invocation in" header, the file
// position and the numbered source excerpt.
const PRISMA_LOCATION_LINE =
  /^(Invalid `.*` invocation|.*:\d+:\d+$|(→\s*)?\d+(\s|$))/;

// One line for the log: the error class, its code and the problem, without
// the source excerpt Prisma adds. Some messages, such as ECONNREFUSED, carry
// no problem text at all.
export function summarizeError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const code = 'code' in error ? ` ${String(error.code)}` : '';
  const problem = error.message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !PRISMA_LOCATION_LINE.test(line))
    .at(-1);
  return `${error.name}${code}${problem ? `: ${problem}` : ''}`;
}

// Catches every error, because pg reports some outages as plain errors.
// Errors that do not come from the database get Nest's default handling.
@Catch()
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const httpException = toHttpException(error);
    if (!httpException) {
      super.catch(error, host);
      return;
    }

    if (httpException instanceof ServiceUnavailableException) {
      this.logger.warn(`Database unavailable: ${summarizeError(error)}`);
    } else if (httpException.getStatus() >= 500) {
      this.logger.error(
        `Unhandled Prisma error: ${summarizeError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    super.catch(httpException, host);
  }
}
