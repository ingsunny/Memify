import {
  scrypt,
  randomBytes,
  createHash,
  timingSafeEqual,
  createHmac,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt, 64)).toString("hex")}`;
}
export async function checkPassword(password, stored) {
  const [salt, key] = stored.split(":");
  const derived = await derive(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(key, "hex"));
}
export function signedHeaders(secret, path, body) {
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}\n${nonce}\nPOST\n${path}\n${body}`)
    .digest("hex");
  return {
    "content-type": "application/json",
    "x-memify-timestamp": timestamp,
    "x-memify-nonce": nonce,
    "x-memify-signature": signature,
  };
}
