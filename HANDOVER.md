# Food Label AI — Start Here

This file is the operating manual for a non-technical owner using an AI coding agent to maintain this project.

## 1. What this project does

A user takes a photo of a packaged-food label. The app sends the image to a configured vision-capable LLM provider and displays an easy-to-read Vietnamese explanation:

- product name and analysis confidence
- energy and nutrients
- ingredients and additives visible in the image
- positive points and things to watch
- practical suggestions
- a classroom discussion question

The app is a Cloudflare Worker with a static frontend. There is no database in this project.

## 2. Important rule

Never put an API key in `public/`, HTML, CSS, browser JavaScript, screenshots, Git commits, or chat messages. API keys belong in local `.dev.vars` or Cloudflare Worker secrets only. Do not hand over `.dev.vars` itself.

## 3. File map

| File | Purpose | Safe for a beginner to edit? |
|---|---|---|
| `public/index.html` | Page structure and Vietnamese labels | Yes, for text/layout |
| `public/styles.css` | Colors, spacing, responsive mobile design | Yes, carefully |
| `public/app.js` | Browser upload flow and result rendering | Only with an AI agent |
| `src/index.js` | Cloudflare API endpoint, provider request, prompts, result validation | Yes, with an AI agent |
| `wrangler.toml` | Worker compatibility and fallback configuration | Yes |
| `cloudflare.config.ts` | Cloudflare `cf` CLI deployment configuration | Yes, review model ID |
| `.dev.vars` | Local-only secrets and settings; ignored by Git | Yes, never share it |
| `.dev.vars.example` | Safe template for local settings | Yes |
| `README.md` | Technical setup notes | Yes |
| `HANDOVER.md` | This guide | Yes |

## 4. First-time local setup

Install Node.js first, then open a terminal in this project folder.

```bash
npm install
cp .dev.vars.example .dev.vars
```

Open `.dev.vars` and fill in the provider details:

```env
LLM_API_URL="https://your-provider.example/v1/chat/completions"
LLM_API_KEY="your-private-api-key"
LLM_MODEL="your-vision-model-id"
LLM_API_KEY_HEADER="authorization"
LLM_API_KEY_PREFIX="Bearer "
```

Start the app:

```bash
npm run dev
```

Open the local URL shown by Wrangler, normally:

```text
http://localhost:8787
```

Upload a clear JPG, PNG, or WebP food-label image. The image must be 10 MB or smaller.

## 5. Provider requirements

The current adapter expects an OpenAI-compatible vision chat API:

- HTTP `POST` to `LLM_API_URL`
- JSON body containing `model`, `max_tokens`, and `messages`
- the image sent as a `data:image/...;base64,...` URL inside `image_url`
- response text normally at `choices[0].message.content`

If the provider uses a different format, tell the AI agent:

> Adapt `src/index.js` for this provider. Keep the browser API unchanged. Update the request body, authentication header, and response parser. Do not expose the API key to the browser. Run syntax checks after editing.

The relevant functions are:

- `providerHeaders()` — authentication headers
- `analyze()` — request URL and request body
- `extractProviderText()` — response parsing

## 6. Change the model

For local testing, edit `.dev.vars`:

```env
LLM_MODEL="exact-model-id-from-provider"
```

For Cloudflare, edit `wrangler.toml`:

```toml
[vars]
LLM_MODEL = "exact-model-id-from-provider"
LLM_MAX_TOKENS = "3600"
```

Then deploy again.

## 7. Customize the prompt

In `src/index.js`, edit:

```js
const SYSTEM_PROMPT = `...`;
const USER_PROMPT = `...`;
```

- `SYSTEM_PROMPT` defines the assistant's role and general behavior.
- `USER_PROMPT` defines the task, output format, and analysis rules.

The frontend expects these JSON fields:

```text
product_name
confidence
summary
level
energy
nutrients
ingredients
positives
watchouts
tips
student_question
disclaimer
```

If you rename or remove fields, the page may show blank sections. When changing the output structure, ask the AI agent to update both `src/index.js` and `public/app.js` together.

A good prompt change request:

> Change the food-label prompt to focus more on added sugar and serving size. Keep the existing JSON field names and Vietnamese output. Do not add API keys. Update only the prompt unless a code change is required, then run the checks.

## 8. Deploy to Cloudflare

Log in once:

```bash
cf auth login
```

Store the provider key as a Cloudflare secret:

```bash
cf deploy --secrets-file .dev.vars
```

This deploys the Worker and uploads the values in `.dev.vars` as Worker secrets. Keep `.dev.vars` private. To deploy without uploading local secrets, use:

```bash
cf deploy
```

Then deploy updates with:

```bash
npm run deploy
```

The deployment creates or updates the Worker named `read-food-label` in the Cloudflare account selected by `cf auth login`. Review `cloudflare.config.ts` before deploying; its model ID must match the provider used by the new owner. The static website is served from the same Worker project.

## 9. Test the API directly

With `npm run dev` running:

```bash
curl -X POST \
  -F "image=@/absolute/path/to/food-label.jpg" \
  http://localhost:8787/api/analyze
```

A successful response is JSON. An error response usually means one of these:

- the provider URL is wrong
- the API key is missing or expired
- the model ID is wrong
- the provider does not support image input
- the provider is not OpenAI-compatible
- the image is too large or not JPG/PNG/WebP

## 10. Safe change workflow with an AI agent

Use this workflow every time:

1. Make a copy or create a Git commit before changing code.
2. Tell the AI agent exactly what outcome you want.
3. Ask it to inspect the relevant files before editing.
4. Ask it to make the smallest change possible.
5. Ask it to run:

   ```bash
   node --check src/index.js
   node --check public/app.js
   ```

6. Test locally with a real label image.
7. Deploy only after the local test works.
8. Test the deployed URL on a phone.

Useful request template:

> I need to change [describe the result]. Inspect the project first. Keep the existing Cloudflare deployment and provider configuration. Do not change the API response field names unless necessary. Do not touch or print secrets. Make the smallest change, run syntax checks, and summarize the files changed and how I can test it.

## 11. Privacy and classroom notes

- The uploaded image is sent to the configured LLM provider for analysis.
- Do not upload student faces, names, phone numbers, or unrelated personal information.
- The current app has no login, rate limiting, or usage quota.
- Before a public classroom launch, ask an AI agent to add authentication/rate limiting and review the provider's data-retention settings.
- The result is educational guidance, not medical advice.

## 12. If something breaks

Give the AI agent:

1. the exact command you ran
2. the full error message
3. whether it happened locally or after deployment
4. which file was changed last
5. whether the provider works independently

Do not paste `.dev.vars`, API keys, cookies, or private Cloudflare tokens into the chat.
