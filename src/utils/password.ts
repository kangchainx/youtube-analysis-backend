import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
};

const scrypt = promisify(nodeScrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: import("crypto").ScryptOptions,
) => Promise<Buffer>;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Hashes a plain text password using scrypt and returns an encoded payload.
 * Payload format: scrypt:<hex salt>:<hex hash>:<N>:<r>:<p>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS);

  return [
    "scrypt",
    salt.toString("hex"),
    derivedKey.toString("hex"),
    SCRYPT_PARAMS.N.toString(),
    SCRYPT_PARAMS.r.toString(),
    SCRYPT_PARAMS.p.toString(),
  ].join(":");
}

/**
 * Verifies a plain text password against a stored scrypt hash payload.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const saltHex = parts[1];
  const hashHex = parts[2];
  const nStr = parts[3];
  const rStr = parts[4];
  const pStr = parts[5];

  if (!saltHex || !hashHex || !nStr || !rStr || !pStr) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const hash = Buffer.from(hashHex, "hex");
  const N = parseInt(nStr, 10);
  const r = parseInt(rStr, 10);
  const p = parseInt(pStr, 10);

  if (Number.isNaN(N) || Number.isNaN(r) || Number.isNaN(p)) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, hash.length, { N, r, p });

  if (derivedKey.length !== hash.length) {
    return false;
  }

  return timingSafeEqual(hash, derivedKey);
}
