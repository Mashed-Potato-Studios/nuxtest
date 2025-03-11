import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "happy-dom",
    include: ["**/*.{test,spec}.{js,ts,jsx,tsx}"],
    globals: true,
  },
});
