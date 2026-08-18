import fs from "node:fs";
import crypto from "node:crypto";

const KEY_DIR = "./keys";

function ensureKeysExist(): { privateKey: string; publicKey: string } {
  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
  }

  const privPath = `${KEY_DIR}/private.pem`;
  const pubPath = `${KEY_DIR}/public.pem`;

  if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    fs.writeFileSync(privPath, privateKey);
    fs.writeFileSync(pubPath, publicKey);
    return { privateKey, publicKey };
  }

  return {
    privateKey: fs.readFileSync(privPath, "utf-8"),
    publicKey: fs.readFileSync(pubPath, "utf-8"),
  };
}

const keys = ensureKeysExist();

export function signJWT(payload: Record<string, unknown>): string {
  return crypto.sign("SHA256", Buffer.from(JSON.stringify(payload)), {
    key: keys.privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  }).toString("base64");
}

export function verifyJWT(token: string, expectedPayload: Record<string, unknown>): boolean {
  const expectedBuf = Buffer.from(JSON.stringify(expectedPayload));
  return crypto.verify(
    "SHA256",
    expectedBuf,
    { key: keys.publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
    Buffer.from(token, "base64")
  );
}

export function getPublicKey(): string {
  return keys.publicKey;
}
