# OAuth Mercado Livre no Vercel

Backend serverless para autorizar uma conta de Mercado Livre e manter o token renovável fora da planilha e do código local.

## O que este projeto faz

- `GET /api/mercadolivre/authorize`: começa OAuth com `state` assinado e válido por 10 minutos.
- `GET /api/mercadolivre/callback`: recebe o `code`, troca por tokens e salva criptografado no Supabase.
- `GET /api/mercadolivre/access-token`: rota interna para a ferramenta de concorrentes. Retorna um access token válido e renova antes de expirar.

O Mercado Livre gera um novo refresh token a cada uso. Por isso a gravação é atômica no mesmo registro de vendedor.

## Publicar no Vercel

1. Crie um repositório privado com o conteúdo desta pasta `vercel-oauth` e importe-o no Vercel, ou use `vercel` dentro dela.
2. Após o primeiro deploy, defina a URL de produção em `ML_REDIRECT_URI`, por exemplo: `https://ml-oauth-seuusuario.vercel.app/api/mercadolivre/callback`.
3. No Vercel, crie as variáveis de ambiente para **Production** e **Preview**:
   - `ML_CLIENT_ID` e `ML_CLIENT_SECRET` (DevCenter Mercado Livre);
   - `ML_REDIRECT_URI` (a URL acima);
   - `OAUTH_STATE_SECRET`: texto aleatório longo;
   - `TOKEN_ENCRYPTION_KEY`: chave Base64 de 32 bytes;
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`;
   - `INTERNAL_API_SECRET`: texto aleatório longo, usado somente pelo OpenClaw.
4. No Supabase, abra **SQL Editor**, execute o arquivo [`supabase.sql`](./supabase.sql) e guarde as duas credenciais do passo anterior apenas no Vercel.
5. Faça novo deploy para aplicar as variáveis.
6. No DevCenter Mercado Livre, cadastre exatamente a mesma URL de `ML_REDIRECT_URI` como URI de redirect. Habilite `Authorization Code`, `Refresh Token` e `offline_access`, com permissões de leitura para Usuários e Publicação/sincronização.
7. Abra `https://SEU-PROJETO.vercel.app/api/mercadolivre/authorize`, entre na conta do Mercado Livre e confirme o acesso.

## Gerar segredos

No terminal local, sem registrar a saída em arquivos:

```bash
openssl rand -base64 32 # TOKEN_ENCRYPTION_KEY
openssl rand -hex 32    # OAUTH_STATE_SECRET ou INTERNAL_API_SECRET
```

## Segurança

- Não use `ML_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, refresh token ou `INTERNAL_API_SECRET` no navegador, no Git ou no Telegram.
- O endpoint `access-token` exige `Authorization: Bearer <INTERNAL_API_SECRET>`.
- O projeto não tem interface pública além do callback OAuth.
