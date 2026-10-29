import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client';

// Turns database errors that reach the HTTP layer into proper status codes.
// Without this filter, a race such as two parallel sign-ups with one email
// fails with a generic 500 instead of a 409 the client can act on.
export function toHttpException(
  error: Prisma.PrismaClientKnownRequestError,
): HttpException {
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

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const httpException = toHttpException(error);

    if (httpException.getStatus() >= 500) {
      this.logger.error(
        `Unhandled Prisma error ${error.code}: ${error.message}`,
        error.stack,
      );
    }

    super.catch(httpException, host);
  }
}
