import { HttpException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { isDatabaseUnavailable } from './database-unavailable';

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

function wrappedSqlState(originalCode: string) {
  return knownError('P2039', {
    driverAdapterError: {
      name: 'DriverAdapterError',
      cause: { originalCode, kind: 'postgres' },
    },
  });
}

function socketError(code: string) {
  return Object.assign(new AggregateError([], ''), { code });
}

// The shapes below were captured from Prisma 7.10 with @prisma/adapter-pg
// while the database was stopped, restarting or unreachable.
describe('isDatabaseUnavailable', () => {
  it.each([
    ['a refused connection', knownError('ECONNREFUSED')],
    ['a connection the server closed', knownError('P1017')],
    ['an unreachable server', knownError('P1001')],
    ['an exhausted connection pool', knownError('P2024')],
    ['a server that is starting up', wrappedSqlState('57P03')],
    ['a server that is shutting down', wrappedSqlState('57P01')],
    ['a connection exception', wrappedSqlState('08006')],
    [
      'a pg connection timeout',
      new Error('Connection terminated due to connection timeout'),
    ],
    [
      'a dropped pg connection',
      new Error('Connection terminated unexpectedly'),
    ],
    ['a refused connection on every address', socketError('ECONNREFUSED')],
    [
      'a failed client start',
      new Prisma.PrismaClientInitializationError('cannot connect', 'test'),
    ],
  ])('detects %s', (_, error) => {
    expect(isDatabaseUnavailable(error)).toBe(true);
  });

  it.each([
    ['a unique constraint failure', knownError('P2002')],
    ['a missing record', knownError('P2025')],
    ['wrong database credentials', knownError('P1000')],
    ['a missing database', knownError('P1003')],
    ['a failed query', wrappedSqlState('42P01')],
    ['an application error', new Error('Listing not found')],
    ['an HTTP exception', new HttpException('Conflict', 409)],
    ['a value that is not an error', 'ECONNREFUSED'],
    ['null', null],
  ])('ignores %s', (_, error) => {
    expect(isDatabaseUnavailable(error)).toBe(false);
  });
});
