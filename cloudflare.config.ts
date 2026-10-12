import { bindings, defineConfig } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .dev.vars, .dev.vars.example. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 */

export default defineConfig({
	worker: {
		name: "read-food-label",
		compatibilityDate: "2026-10-03",
		entrypoint: "src/index.js",
		assets: {
			runWorkerFirst: [
				"/api/*",
			],
		},
		env: {
			LLM_MODEL: bindings.text("gemini-3.8-flash-high"),
			LLM_MAX_TOKENS: bindings.text("3600"),
			LLM_API_KEY_HEADER: bindings.text("authorization"),
			LLM_API_KEY_PREFIX: bindings.text("Bearer "),
			ASSETS: bindings.assets(),
		},
	},
});
