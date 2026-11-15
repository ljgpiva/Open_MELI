import { authorizeService, decrypt, readTokens, refreshToken, saveTokens, sendJson } from "../_lib/mercadolivre.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Use GET." });
  try {
    authorizeService(req);
    let record = await readTokens();
    if (Date.parse(record.expires_at) - Date.now() < 5 * 60 * 1000) {
      const refreshed = await refreshToken(decrypt(record.refresh_token_encrypted));
      record = await saveTokens(refreshed);
    }
    return sendJson(res, 200, { access_token: decrypt(record.access_token_encrypted), expires_at: record.expires_at, seller_id: record.seller_id });
  } catch (error) {
    const status = error.message === "Não autorizado." ? 401 : 500;
    return sendJson(res, status, { error: error.message });
  }
}
