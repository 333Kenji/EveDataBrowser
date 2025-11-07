import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.smoke.test.ts"],
    environment: "node",
    passWithNoTests: false
  }
});
