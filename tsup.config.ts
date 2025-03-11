import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  target: "node16",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  external: ["vscode"],
  noExternal: ["execa"],
  minify: process.env.NODE_ENV === "production",
  watch: process.env.NODE_ENV === "development",
});
