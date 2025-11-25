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
        CalendarUrl: "readonly",
        EventsUrl: "readonly",
        MissalsUrl: "readonly",
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
