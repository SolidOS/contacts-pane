import { solidPane, buildConfig } from "solidos-toolkit/vite";
import { defineConfig } from "vitest/config";
import { isAbsolute } from "node:path";

export default defineConfig({
  plugins: solidPane({
    litDecoratorPaths: ["src/components"],
    sandbox: {
      subject: "https://solidos.solidcommunity.net/Contacts/index.ttl#this",
    },
  }),

  build: buildConfig({
    entry: "src/index.ts",
    overrides: {
      rolldownOptions: {
        output: [
          {
            format: "es",
            preserveModules: true,
            preserveModulesRoot: "src",
            entryFileNames: "[name].esm.js",
          },
          {
            format: "cjs",
            preserveModules: false,
            entryFileNames: "[name].cjs.js",
          },
        ],
        external: (id: string) => {
          return !id.startsWith(".") && !isAbsolute(id);
        },
      },
    },
  }),
  test: {
    environment: "jsdom",
    setupFiles: ["test/helpers/setup.ts"],
    coverage: {
      include: ["src/**/*.[jt]s"],
    },
  },
});
