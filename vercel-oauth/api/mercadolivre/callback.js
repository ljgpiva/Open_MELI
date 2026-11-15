import { exchangeCode, saveTokens, sendJson, verifyState } from "../_lib/mercadolivre.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Use GET." });
  try {
    if (req.query.error) throw new Error(`Autorização negada: ${req.query.error}`);
    if (!req.query.code) throw new Error("Código de autorização ausente.");
    const state = verifyState(req.query.state);
    const tokens = await exchangeCode(req.query.code, state.redirectUri);
    await saveTokens(tokens);
    return res.status(200).send("Integração Mercado Livre autorizada. Você já pode fechar esta janela.");
  } catch (error) { return sendJson(res, 400, { error: error.message }); }
}
