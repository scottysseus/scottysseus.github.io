// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import expressiveCode from "astro-expressive-code";

// https://astro.build/config
export default defineConfig({
  site: "https://scottysseus.github.io/",
  integrations: [
    expressiveCode({
      themes: ["rose-pine-dawn", "rose-pine-moon"],
      useDarkModeMediaQuery: false,
      themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
    }),
    mdx(),
    sitemap(),
    tailwind(),
  ],
});
