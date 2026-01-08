import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig( [
  {
    ignores: ["**/vendor/**", "**/.yarn/**", "**/.pnp.cjs"],
  },
  {
    files: [ "**/*.{js,mjs,cjs}" ],
    plugins: {
      js
    },
    extends: [ "js/recommended" ],
    languageOptions: {
      globals: {
        ...globals.browser,
        $: "readonly",
        jQuery: "readonly",
        Messages: "readonly",
        LiturgicalEventCollection: "readonly",
        LiturgicalEventCollectionKeys: "readonly",
        LitCalMetadata: "readonly",
        AppEnv: "readonly",
        CalendarUrl: "readonly",
        EventsUrl: "readonly",
        MissalsUrl: "readonly",
        MetadataUrl: "readonly",
        DecreesUrl: "readonly",
        TemporaleUrl: "readonly",
        RegionalDataUrl: "readonly",
        BaseUrl: "readonly",
        toastr: "readonly",
        bootstrap: "readonly",
        Cookies: "readonly",
        LITCAL_LOCALE: "writable",
        currentLocale: "writable",
        Auth: "readonly",
      }
    },
    rules: {
      'no-prototype-builtins': 'off'
    }
  },
] );
