import { Prisma } from '../generated/prisma/client';

// Tells a database that cannot be reached right now apart from a failed
// query. Prisma 7 with the pg adapter reports an outage in several shapes,
// depending on where the driver notices it:
// - a known request error with a Prisma connection code, such as P1017
//   when the server closes the connection;
// - a known request error carrying a socket error code, such as ECONNREFUSED;
// - a known request error P2039 wrapping an SQLSTATE, such as 57P03 while
//   the server starts up;
// - a plain pg Error without a code, such as "Connection terminated
//   unexpectedly" or "Connection terminated due to connection timeout";
// - an AggregateError from Node with a socket error code, when every address
//   of the host refuses the connection.
// Wrong credentials (P1000) and a missing database (P1003) are left out:
// they are configuration mistakes that do not go away on a retry.

const PRISMA_CONNECTION_CODES = new Set([
  'P1001', // Cannot reach the database server.
  'P1002', // The server was reached but timed out.
  'P1008', // The operation timed out.
  'P1017', // The server closed the connection.
  'P2024', // Timed out waiting for a connection from the pool.
]);

const SOCKET_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

// SQLSTATE class 08 is "connection exception". 57P01 to 57P03 mean the
// server is shutting down, recovering from a crash or starting up.
const UNAVAILABLE_SQLSTATE = /^(08|57P0[123])/;

// pg throws these as plain errors without a code.
const PG_CONNECTION_MESSAGE =
  /^(Connection terminated|timeout exceeded when trying to connect)/;

function errorCode(error: object): unknown {
  return 'code' in error ? error.code : undefined;
}

function driverSqlState(error: Prisma.PrismaClientKnownRequestError) {
  const meta = error.meta as
    { driverAdapterError?: { cause?: { originalCode?: unknown } } } | undefined;
  const sqlState = meta?.driverAdapterError?.cause?.originalCode;
  return typeof sqlState === 'string' ? sqlState : undefined;
}

export function isDatabaseUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  if (error instanceof Prisma.PrismaClientInitializationError) return true;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (PRISMA_CONNECTION_CODES.has(error.code)) return true;
    if (SOCKET_ERROR_CODES.has(error.code)) return true;
    const sqlState = driverSqlState(error);
    return sqlState !== undefined && UNAVAILABLE_SQLSTATE.test(sqlState);
  }

  const code = errorCode(error);
  if (typeof code === 'string' && SOCKET_ERROR_CODES.has(code)) return true;

  return error instanceof Error && PG_CONNECTION_MESSAGE.test(error.message);
}
