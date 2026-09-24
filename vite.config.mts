import type { PluginOption } from "vite"
import { isAbsolute } from "node:path"
import { solidPane, buildConfig } from "solidos-toolkit/vite"
import { defineConfig } from "vitest/config"

// `vite build --watch` reruns bundle hooks for every emitted file. Keep the
// inner loop to one ESM output and skip declaration generation so watch mode
// does not churn itself or downstream package watchers.
const isWatch = process.argv.includes("--watch")

const build = buildConfig({
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
        return !id.startsWith(".") && !isAbsolute(id)
      },
    },
  },
})
if (isWatch && build && Array.isArray(build.rolldownOptions?.output)) {
  build.rolldownOptions.output = build.rolldownOptions.output.filter(
    (o: { format?: string }) => o.format === 'es',
  )
}

type ConcretePlugin = Extract<PluginOption, { name: string }>

const flattenPlugins = async (input: unknown): Promise<ConcretePlugin[]> => {
  if (!input) return []
  const resolved = await input
  if (!resolved) return []
  if (Array.isArray(resolved)) {
    const nested = await Promise.all(resolved.map(flattenPlugins))
    return nested.flat()
  }
  return [resolved as ConcretePlugin]
}

const plugins = (await flattenPlugins(
  solidPane({
    litDecoratorPaths: ["src/components"],
    sandbox: {
      subject: "https://solidos.solidcommunity.net/Contacts/index.ttl#this",
    },
  }),
)).filter((p) => !(isWatch && /dts/i.test(p.name)))

export default defineConfig({
  build,
  plugins,
  test: {
    environment: "jsdom",
    setupFiles: ["test/helpers/setup.ts"],
    coverage: {
      include: ["src/**/*.[jt]s"],
    },
  },
})
