import type { Options } from 'tsup';

export const tsup: Options = {
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  minify: true,
  bundle: true,
  skipNodeModulesBundle: true,
  entryPoints: ['lib/index.ts'],
  watch: false,
  target: 'esnext',
  outDir: 'dist',
  entry: ['lib/**/*.ts'],
};
