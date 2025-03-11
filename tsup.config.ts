import { defineConfig } from "tsup";
import * as fs from "fs";
import * as path from "path";

// Copy resources to dist folder
function copyResources() {
  const resourcesDir = path.resolve(__dirname, "resources");
  const mediaDir = path.resolve(__dirname, "media");
  const distDir = path.resolve(__dirname, "dist");

  // Create dist directory if it doesn't exist
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  // Copy resources directory
  if (fs.existsSync(resourcesDir)) {
    const distResourcesDir = path.resolve(distDir, "resources");
    if (!fs.existsSync(distResourcesDir)) {
      fs.mkdirSync(distResourcesDir);
    }

    const files = fs.readdirSync(resourcesDir);
    files.forEach((file) => {
      const srcPath = path.resolve(resourcesDir, file);
      const destPath = path.resolve(distResourcesDir, file);
      fs.copyFileSync(srcPath, destPath);
    });
  }

  // Copy media directory
  if (fs.existsSync(mediaDir)) {
    const distMediaDir = path.resolve(distDir, "media");
    if (!fs.existsSync(distMediaDir)) {
      fs.mkdirSync(distMediaDir);
    }

    const files = fs.readdirSync(mediaDir);
    files.forEach((file) => {
      const srcPath = path.resolve(mediaDir, file);
      const destPath = path.resolve(distMediaDir, file);
      fs.copyFileSync(srcPath, destPath);
    });
  }
}

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
  onSuccess: copyResources,
});
