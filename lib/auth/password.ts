import "server-only";
import bcrypt from "bcryptjs";

// bcrypt with cost 12 (NFR-06). Plaintext passwords are never stored or logged.
const COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Compared against when the email is unknown, so response time does not reveal
// whether an account exists (FR-09).
export const DUMMY_HASH = "$2b$12$6/t3H2AULXsYYg1joD6wte2scJEC5qSOhqbaBBtaaZ8FlIhZBOxBG";
