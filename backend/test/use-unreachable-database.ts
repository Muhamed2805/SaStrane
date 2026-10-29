// Nothing listens on port 1, so every connection attempt is refused at once.
process.env.DATABASE_URL =
  'postgresql://sastrane:sastrane@127.0.0.1:1/sastrane_test';
