# Đọc nhãn dễ hiểu

A mobile-friendly Vietnamese food-label reader for classroom use. Users photograph a packaged-food label, the Cloudflare Worker sends the image to your configured vision-capable LLM provider, and the app renders an educational explanation in Vietnamese.

## Provider contract

The Worker is provider-neutral. It sends an OpenAI-compatible multimodal chat request to `LLM_API_URL`:

- `POST` JSON with `model`, `max_tokens`, and `messages`
- image supplied as a `data:image/...;base64,...` `image_url`
- auth defaults to `Authorization: Bearer <LLM_API_KEY>`
- response text read from `choices[0].message.content` (with common fallbacks)

If your custom provider uses a different request/response schema, update only `providerHeaders()` and `extractProviderText()` in `src/index.js`, plus the request body in `analyze()`.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars
# put your provider URL and API key in .dev.vars
npm run dev
```

Open the local URL shown by Wrangler. The API key stays server-side and is never shipped to the browser.

## Deploy to Cloudflare

```bash
npm install
cf auth login
cf deploy --secrets-file .dev.vars
```

`wrangler.toml` contains non-secret configuration for the model, token limit, and default auth format. The Worker handles `POST /api/analyze`; Cloudflare Assets serves the frontend.

## Isolation and data flow

- Source files are in this local project directory and deploy as one Cloudflare Worker + static Assets project.
- The browser uploads the image to `/api/analyze` on the same Worker; the provider key is never exposed to the browser.
- The Worker forwards the image to the configured provider. The image is therefore also processed under that provider's privacy/retention terms.
- Cloudflare account access, Worker logs, provider access, and any custom domain are controlled separately; this app does not create a shared database or cross-project storage.
- For a classroom rollout, add authentication/rate limiting and decide your image-retention policy before making the URL public.

## Deploy with the Cloudflare CLI

This project uses the Cloudflare CLI command `cf` for deployment:

```bash
cf auth login
cf deploy --secrets-file .dev.vars
```

The `--secrets-file` option uploads the values in `.dev.vars` as Worker secrets during deployment. Keep `.dev.vars` private. The `deploy` npm script runs the same command:

```bash
npm run deploy
```

`cf` is used for deployment and Cloudflare authentication. Local Worker emulation still uses `npm run dev`; the installed `cf` CLI does not provide a local Worker dev-server command.
