import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * GraphQL Code Generator config for operation documents.
 *
 * Reads the sobek schema + generated `.graphql` documents from
 * `src/generated/operations/documents/` and emits flat typed document nodes
 * into `src/generated/operations/`.
 */
const config: CodegenConfig = {
  // Live schema only — never the patch overlay. Documents are validated against
  // this schema, so a patch-only field reaching a document fails codegen here
  // rather than the backend at runtime.
  schema: ['./schema/sobek.schema.graphqls'],
  documents: './src/generated/operations/documents/**/*.graphql',
  generates: {
    'src/generated/operations/': {
      preset: 'near-operation-file',
      presetConfig: {
        extension: '.generated.ts',
        baseTypesPath: '../sobekTypes.ts',
        folder: '..', // output to operations/, not operations/documents/
      },
      plugins: [
        'typescript-operations',
        'typed-document-node',
      ],
      config: {
        skipTypename: true,
        preResolveTypes: true,
        useTypeImports: true,
      },
    },
  },
};

export default config;
