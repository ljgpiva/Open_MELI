import { callbackUrl, createState, sendJson } from "../_lib/mercadolivre.js";

export default function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Use GET." });
  try {
    const redirectUri = callbackUrl(req);
    const query = new URLSearchParams({ response_type: "code", client_id: process.env.ML_CLIENT_ID || "", redirect_uri: redirectUri, state: createState(redirectUri) });
    if (!process.env.ML_CLIENT_ID) throw new Error("ML_CLIENT_ID não configurada.");
    return res.redirect(302, `https://auth.mercadolivre.com.br/authorization?${query}`);
  } catch (error) { return sendJson(res, 500, { error: error.message }); }
}
