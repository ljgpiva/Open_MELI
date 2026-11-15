import crypto from "node:crypto";

const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada.`);
  return value;
};

export const callbackUrl = (req) => {
  const configured = process.env.ML_REDIRECT_URI;
  if (configured) return configured;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}/api/mercadolivre/callback`;
};

export const sendJson = (res, status, body) => res.status(status).json(body);

const encode = (value) => Buffer.from(value).toString("base64url");
const decode = (value) => Buffer.from(value, "base64url").toString("utf8");

export function createState(redirectUri) {
  const payload = encode(JSON.stringify({ iat: Date.now(), nonce: crypto.randomUUID(), redirectUri }));
  const signature = crypto.createHmac("sha256", required("OAUTH_STATE_SECRET")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(state) {
  const [payload, signature] = String(state || "").split(".");
  if (!payload || !signature) throw new Error("State OAuth ausente ou inválido.");
  const expected = crypto.createHmac("sha256", required("OAUTH_STATE_SECRET")).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("State OAuth não confere.");
  const parsed = JSON.parse(decode(payload));
  if (!parsed.iat || Date.now() - parsed.iat > 10 * 60 * 1000) throw new Error("State OAuth expirado. Reinicie a autorização.");
  return parsed;
}

export async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: required("ML_CLIENT_ID"),
    client_secret: required("ML_CLIENT_SECRET"),
    code,
    redirect_uri: redirectUri,
  });
  return tokenRequest(body);
}

export async function refreshToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: required("ML_CLIENT_ID"),
    client_secret: required("ML_CLIENT_SECRET"),
    refresh_token: refreshToken,
  });
  return tokenRequest(body);
}

async function tokenRequest(body) {
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mercado Livre recusou o token: ${data.error || response.status}`);
  return data;
}

function encryptionKey() {
  const key = Buffer.from(required("TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY deve ser uma chave Base64 de 32 bytes.");
  return key;
}

export function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decrypt(value) {
  const payload = Buffer.from(value, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}

export function authorizeService(req) {
  const presented = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const expected = required("INTERNAL_API_SECRET");
  if (!presented || presented.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected))) {
    throw new Error("Não autorizado.");
  }
}

const supabase = () => ({ url: required("SUPABASE_URL").replace(/\/$/, ""), key: required("SUPABASE_SERVICE_ROLE_KEY") });

export async function saveTokens(tokens) {
  const { url, key } = supabase();
  const record = {
    seller_id: String(tokens.user_id),
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    expires_at: new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  const response = await fetch(`${url}/rest/v1/ml_oauth_tokens?on_conflict=seller_id`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(record) });
  if (!response.ok) throw new Error(`Não foi possível salvar tokens (${response.status}).`);
  return record;
}

export async function readTokens() {
  const { url, key } = supabase();
  const response = await fetch(`${url}/rest/v1/ml_oauth_tokens?select=*&order=updated_at.desc&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Não foi possível ler tokens (${response.status}).`);
  const [record] = await response.json();
  if (!record) throw new Error("Conta Mercado Livre ainda não autorizada.");
  return record;
}
