import { describe, it, expect } from 'vitest';
import { distillModule } from './distillTypes';

// Minimal generated-like source exercising every rule.
const SRC = `
export type Maybe<T> = T | null;
export type Scalars = { String: { input: string; output: string }; Int: { input: number; output: number }; Float: { input: number; output: number }; Boolean: { input: boolean; output: boolean } };
export enum Mode { Bus = 'BUS', Rail = 'RAIL' }
export type MultilingualString = { lang?: Maybe<Scalars['String']['output']>; value?: Maybe<Scalars['String']['output']> };
export type Cap = { seating?: Maybe<Scalars['Int']['output']>; total?: Maybe<Scalars['Int']['output']> };
export type Rel = { netexId: Scalars['String']['output']; foo?: Maybe<Scalars['String']['output']> };
export type Thing = {
  netexId: Scalars['String']['output'];
  name?: Maybe<MultilingualString>;
  length?: Maybe<Scalars['Float']['output']>;
  lowFloor?: Maybe<Scalars['Boolean']['output']>;
  mode?: Maybe<Mode>;
  cap?: Maybe<Cap>;
  rel?: Maybe<Rel>;
  version?: Maybe<Scalars['String']['output']>;
};
export type ThingInput = {
  netexId?: Maybe<Scalars['String']['output']>;
  name?: Maybe<MultilingualString>;
  length?: Maybe<Scalars['Float']['output']>;
  lowFloor?: Maybe<Scalars['Boolean']['output']>;
  mode?: Maybe<Mode>;
  cap?: Maybe<Cap>;
  rel?: Maybe<Rel>;
};
`;

describe('distillModule', () => {
  const out = distillModule(SRC, 'Thing', 'ThingInput');

  it('emits the full read interface verbatim (incl. server-managed extras)', () => {
    expect(out).toMatch(/export interface Entity \{/);
    expect(out).toMatch(/version\?: Maybe<Scalars\['String'\]\['output'\]>;/);
  });

  it('maps control kinds and access paths', () => {
    expect(out).toMatch(/name:\s*\{ kind: 'name', path: \['name'\] \}/);
    expect(out).toMatch(/length:\s*\{ kind: 'number', path: \['length'\] \}/);
    expect(out).toMatch(/lowFloor:\s*\{ kind: 'switch', path: \['lowFloor'\] \}/);
    expect(out).toMatch(
      /mode:\s*\{ kind: 'enum', path: \['mode'\], options: Object\.values\(Mode\) \}/
    );
  });

  it('flattens id-less value-objects into leaf fields with 2-element paths', () => {
    expect(out).toMatch(/seating:\s*\{ kind: 'number', path: \['cap', 'seating'\] \}/);
    expect(out).toMatch(/total:\s*\{ kind: 'number', path: \['cap', 'total'\] \}/);
  });

  it('omits relations (object with identity) from FIELDS but keeps them on Entity', () => {
    expect(out).toMatch(/rel\?: Maybe<Rel>;/); // on the interface
    expect(out).not.toMatch(/rel:\s*\{ kind:/); // not in FIELDS
  });

  it('flags server-managed fields (on Entity, not Input)', () => {
    expect(out).toMatch(/version:\s*\{ kind: 'text', path: \['version'\], serverManaged: true \}/);
  });

  it('imports referenced types + enum values, never the entity/input itself', () => {
    expect(out).toMatch(/import \{ Mode \} from '\.\.\/generated\/sobekTypes';/);
    expect(out).toMatch(/import type \{[^}]*\} from '\.\.\/generated\/sobekTypes';/);
    const importLines = out.split('\n').filter(l => l.startsWith('import'));
    expect(importLines.join('\n')).not.toMatch(/\bThing\b/); // never import the entity/input
  });

  it('aborts when an Input field has no Entity counterpart (write-only)', () => {
    const writeOnly = SRC.replace(
      'export type ThingInput = {',
      "export type ThingInput = {\n  dataOwnerRef?: Maybe<Scalars['String']['output']>;"
    );
    expect(() => distillModule(writeOnly, 'Thing', 'ThingInput')).toThrow(/dataOwnerRef/);
  });
});
