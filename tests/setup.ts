import "dotenv/config";

// Integration tests must never touch the development database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";
