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
        CalendarURL: "readonly",
        EventsURL: "readonly",
        MissalsURL: "readonly",
        RegionalDataURL: "readonly",
        BaseURL: "readonly",
        toastr: "readonly",
        bootstrap: "readonly",
        Cookies: "readonly",
        LITCAL_LOCALE: "writable",
        currentLocale: "writable",
      }
    },
    rules: {
      'no-prototype-builtins': 'off'
    }
  },
] );
