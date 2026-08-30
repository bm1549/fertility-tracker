import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Repo is deployed as a GitHub Pages project site at
// https://<owner>.github.io/fertility-tracker/ — base must match the repo name
// so built asset URLs resolve correctly.
export default defineConfig({
  plugins: [react()],
  base: "/fertility-tracker/",
});
