import { HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { summarizeError, toHttpException } from './prisma-exception.filter';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: 'test',
  });
}

describe('toHttpException', () => {
  it.each([
    ['P2002', HttpStatus.CONFLICT],
    ['P2003', HttpStatus.CONFLICT],
    ['P2025', HttpStatus.NOT_FOUND],
    ['P1001', HttpStatus.SERVICE_UNAVAILABLE],
    ['ECONNREFUSED', HttpStatus.SERVICE_UNAVAILABLE],
    ['P1000', HttpStatus.INTERNAL_SERVER_ERROR],
  ])('maps %s to HTTP %i', (code, status) => {
    expect(toHttpException(prismaError(code))?.getStatus()).toBe(status);
  });

  it('maps a pg error without a code to 503', () => {
    const error = new Error('Connection terminated unexpectedly');

    expect(toHttpException(error)?.getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it('leaves errors that do not come from the database alone', () => {
    expect(toHttpException(new Error('boom'))).toBeUndefined();
    expect(toHttpException(new NotFoundException())).toBeUndefined();
  });

  it('logs one line without the source excerpt', () => {
    // As Prisma 7 formats it when it can read the calling file.
    const location = [
      '',
      'Invalid `this.prisma.user.findUnique()` invocation in',
      'C:\\app\\dist\\auth\\auth.service.js:183:43',
      '',
      '  182 ',
      '→ 183     const user = await this.prisma.user.findUnique(',
    ];
    const refused = new Prisma.PrismaClientKnownRequestError(
      location.join('\n'),
      { code: 'ECONNREFUSED', clientVersion: 'test' },
    );
    const closed = new Prisma.PrismaClientKnownRequestError(
      [...location, 'Server has closed the connection.'].join('\n'),
      { code: 'P1017', clientVersion: 'test' },
    );

    expect(summarizeError(refused)).toBe(
      'PrismaClientKnownRequestError ECONNREFUSED',
    );
    expect(summarizeError(closed)).toBe(
      'PrismaClientKnownRequestError P1017: Server has closed the connection.',
    );
    expect(
      summarizeError(new Error('Connection terminated unexpectedly')),
    ).toBe('Error: Connection terminated unexpectedly');
  });

  it('does not leak database details to the client', () => {
    for (const code of ['P1000', 'P1001']) {
      const response = toHttpException(prismaError(code))?.getResponse();

      expect(JSON.stringify(response)).not.toContain('database error');
    }
  });
});
