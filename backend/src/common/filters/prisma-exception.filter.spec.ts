import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toHttpException } from './prisma-exception.filter';

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
    ['P1001', HttpStatus.INTERNAL_SERVER_ERROR],
  ])('maps %s to HTTP %i', (code, status) => {
    expect(toHttpException(prismaError(code)).getStatus()).toBe(status);
  });

  it('does not leak database details to the client', () => {
    const response = toHttpException(prismaError('P1001')).getResponse();

    expect(JSON.stringify(response)).not.toContain('database error');
  });
});
