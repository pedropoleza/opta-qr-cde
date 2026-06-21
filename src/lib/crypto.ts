import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Criptografia simétrica (AES-256-GCM) para segredos em repouso (token do GHL
// por organização). Chave derivada do JWT_SIGNING_KEY. Valores cifrados levam o
// prefixo "enc:"; valores legados em texto puro são retornados como estão.
function key(): Buffer {
  return createHash("sha256")
    .update(process.env.JWT_SIGNING_KEY ?? "")
    .digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "enc:" + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("enc:")) return value; // legado/texto puro
  try {
    const raw = Buffer.from(value.slice(4), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
