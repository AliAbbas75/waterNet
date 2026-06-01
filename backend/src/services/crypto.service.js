const crypto = require("crypto");

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey() {
  const raw = process.env.AUTH_MASTER_KEY;
  if (!raw) {
    const err = new Error("Missing AUTH_MASTER_KEY");
    err.statusCode = 500;
    throw err;
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    const err = new Error("AUTH_MASTER_KEY must be 32 bytes (base64 encoded)");
    err.statusCode = 500;
    throw err;
  }
  return key;
}

function encryptText(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptText(payload) {
  const key = getKey();
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

module.exports = { encryptText, decryptText, hashToken };
