// Tokens are signed and verified with one fixed algorithm, so a token that
// claims a different algorithm in its header is always rejected.
export const JWT_ALGORITHM = 'HS256';
