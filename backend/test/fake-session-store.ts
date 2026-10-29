// In-memory stand-in for the Session and RefreshToken tables. It supports
// only the queries SessionsService makes, so the e2e tests can follow the
// cookie flow end to end without a database.

type SessionRow = {
  id: string;
  userId: string;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
};

type RefreshTokenRow = {
  id: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  createdAt: Date;
};

type Where = Record<string, unknown>;

function matches(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') {
      return (condition as Where[]).some((part) => matches(row, part));
    }
    const value = row[key];
    if (condition instanceof Date) {
      return value instanceof Date && value.getTime() === condition.getTime();
    }
    if (condition !== null && typeof condition === 'object') {
      const { gt, lte } = condition as { gt?: Date; lte?: Date };
      if (!(value instanceof Date)) return false;
      if (gt && !(value > gt)) return false;
      if (lte && !(value <= lte)) return false;
      return true;
    }
    return value === condition;
  });
}

export function createFakeSessionStore(
  findUser: (id: string) => Record<string, unknown>,
) {
  const sessions: SessionRow[] = [];
  const refreshTokens: RefreshTokenRow[] = [];
  let nextId = 1;
  const id = (prefix: string) => `${prefix}-${nextId++}`;

  const session = {
    create: ({
      data,
    }: {
      data: {
        userId: string;
        userAgent?: string;
        expiresAt: Date;
        refreshTokens: { create: { tokenHash: string; expiresAt: Date } };
      };
    }) => {
      const now = new Date();
      const row: SessionRow = {
        id: id('session'),
        userId: data.userId,
        userAgent: data.userAgent ?? null,
        createdAt: now,
        lastUsedAt: now,
        expiresAt: data.expiresAt,
        revokedAt: null,
        revokedReason: null,
      };
      sessions.push(row);
      refreshTokens.push({
        id: id('token'),
        sessionId: row.id,
        rotatedAt: null,
        createdAt: now,
        ...data.refreshTokens.create,
      });
      return Promise.resolve({ id: row.id });
    },
    deleteMany: ({ where }: { where: Where }) => {
      const removed = sessions.filter((row) => matches(row, where));
      for (const row of removed) sessions.splice(sessions.indexOf(row), 1);
      return Promise.resolve({ count: removed.length });
    },
    findFirst: ({ where }: { where: Where }) => {
      const row = sessions.find((candidate) => matches(candidate, where));
      return Promise.resolve(row ? { id: row.id } : null);
    },
    update: ({ where, data }: { where: { id: string }; data: object }) => {
      const row = sessions.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error(`No session ${where.id}`);
      Object.assign(row, data);
      return Promise.resolve(row);
    },
    updateMany: ({ where, data }: { where: Where; data: object }) => {
      const rows = sessions.filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data);
      return Promise.resolve({ count: rows.length });
    },
  };

  const refreshToken = {
    findUnique: ({
      where,
      select,
    }: {
      where: { tokenHash: string };
      select: { session?: object };
    }) => {
      const row = refreshTokens.find(
        (candidate) => candidate.tokenHash === where.tokenHash,
      );
      if (!row) return Promise.resolve(null);
      if (!select.session) return Promise.resolve({ ...row });
      const owner = sessions.find(
        (candidate) => candidate.id === row.sessionId,
      ) as SessionRow;
      return Promise.resolve({
        ...row,
        session: { ...owner, user: findUser(owner.userId) },
      });
    },
    create: ({
      data,
    }: {
      data: Omit<RefreshTokenRow, 'id' | 'rotatedAt' | 'createdAt'>;
    }) => {
      if (refreshTokens.some((row) => row.tokenHash === data.tokenHash)) {
        throw new Error('Unique constraint failed on tokenHash');
      }
      const row = {
        id: id('token'),
        rotatedAt: null,
        createdAt: new Date(),
        ...data,
      };
      refreshTokens.push(row);
      return Promise.resolve(row);
    },
    deleteMany: ({ where }: { where: Where }) => {
      const removed = refreshTokens.filter((row) => matches(row, where));
      for (const row of removed) {
        refreshTokens.splice(refreshTokens.indexOf(row), 1);
      }
      return Promise.resolve({ count: removed.length });
    },
    updateMany: ({ where, data }: { where: Where; data: object }) => {
      const rows = refreshTokens.filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data);
      return Promise.resolve({ count: rows.length });
    },
  };

  return {
    session,
    refreshToken,
    sessions,
    refreshTokens,
    reset() {
      sessions.length = 0;
      refreshTokens.length = 0;
    },
  };
}
