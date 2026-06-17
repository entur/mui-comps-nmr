import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * GraphQL Code Generator config (The Guild's `@graphql-codegen`).
 *
 * Reads the sobek schema snapshot that `scripts/fetchSchema.ts` downloads to
 * `schema/sobek.schema.graphqls` and emits `src/generated/sobekTypes.ts` with
 * the `typescript` plugin. Enums are emitted as runtime TypeScript enums (not
 * plain string-union types) so the form can both type-check against them and
 * iterate their members for `<MenuItem>` lists.
 *
 * Canonical schema source (see README): https://entur.github.io/sobek/schema.graphqls
 */
const config: CodegenConfig = {
  schema: './schema/sobek.schema.graphqls',
  generates: {
    'src/generated/sobekTypes.ts': {
      plugins: ['typescript'],
      config: {
        enumsAsTypes: false,
        scalars: { DateTime: 'string', Long: 'number' },
        skipTypename: true,
        useTypeImports: true,
      },
    },
  },
};

export default config;
