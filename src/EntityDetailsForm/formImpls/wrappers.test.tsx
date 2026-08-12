/**
 * Contract tests for the generated wrappers — driven by `entities.manifest.json`,
 * so a new entity is covered the moment it is generated, with no test to write.
 *
 * These pin what the *generator* must keep emitting, not anything entity-specific:
 * the three load states (pending / settled-empty / failed) and the locked-field
 * display in create mode. Everything entity-shaped (component name, query root,
 * which field is locked, its label) is derived from the manifest and the distilled
 * `FIELDS` registry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ComponentType, ReactNode } from 'react';
import { SobekProvider } from '../../context/SobekContext';
import { humanize } from '../../shared/humanize';
import type { FieldSpec } from '../types';
import * as forms from './index';
import * as entities from '../../entities';
import * as inputKeys from '../../generated/operations/inputKeys';

// cwd-relative, matching how the generator itself reads the manifest.
const MANIFEST = 'entities.manifest.json';
const OWNER_REF = 'NOG:Authority:test';
const NETEX_ID = 'X:Thing:1';
// The one locked field the provider (and therefore the generated wrapper) seeds.
const OWNER_FIELD = 'dataOwnerRef';

interface ManifestEntry {
  entity: string;
  queryRoot: string;
  mutationName: string;
}

const camel = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

const manifest: ManifestEntry[] = JSON.parse(readFileSync(resolve(MANIFEST), 'utf8'));

const mockFns = vi.hoisted(() => ({
  request: vi.fn(),
  setHeaders: vi.fn(),
}));

vi.mock('graphql-request', () => ({
  __esModule: true,
  GraphQLClient: vi.fn().mockImplementation(function (this: any) {
    this.request = mockFns.request;
    this.setHeaders = mockFns.setHeaders;
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SobekProvider value={{ endpoint: 'http://test', dataOwnerRef: OWNER_REF }}>
    {children}
  </SobekProvider>
);

/** Resolve one manifest entry to the generated component + its field registry. */
const bind = (entry: ManifestEntry) => {
  const comp = (forms as Record<string, ComponentType<{ netexId?: string }>>)[
    `${entry.entity}Form`
  ];
  const fields = (entities as Record<string, Record<string, FieldSpec>>)[
    `${camel(entry.entity)}Fields`
  ];
  const mask = (inputKeys as Record<string, Record<string, unknown>>)[
    `${entry.entity}InputKeys`
  ];
  if (!comp) throw new Error(`no generated wrapper exported for ${entry.entity}`);
  if (!fields) throw new Error(`no distilled FIELDS for ${entry.entity}`);
  if (!mask) throw new Error(`no generated input keyset for ${entry.entity}`);
  return { Form: comp, fields, mask };
};

describe.each(manifest.map(e => [e.entity, e] as const))(
  '%s wrapper contract',
  (_name, entry) => {
    const { Form, fields, mask } = bind(entry);
    const rows = (content: unknown[]) => ({ [entry.queryRoot]: { content } });

    beforeEach(() => {
      mockFns.request.mockReset();
      mockFns.setHeaders.mockReset();
    });

    it('renders a not-found state on a settled zero-row load (no blank form)', async () => {
      mockFns.request.mockResolvedValueOnce(rows([]));

      render(<Form netexId={NETEX_ID} />, { wrapper });

      await waitFor(() =>
        expect(screen.getByText(`Not found: ${NETEX_ID}`)).toBeInTheDocument()
      );
      // A blank editable form here would create a new entity on save.
      expect(screen.queryAllByRole('textbox')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });

    it('never shows not-found on the first commit, before the load starts', () => {
      // Regression: `loading` is false on the first commit (LOAD_START dispatches
      // from a passive effect), so a not-found branch gated on it rendered
      // "Not found" for one frame on every mount of an existing entity.
      //
      // Deliberately not RTL's `render`: it wraps in `act()`, which flushes the
      // passive effect before returning and hides the flash entirely. `flushSync`
      // commits synchronously and leaves passive effects scheduled, so `container`
      // holds exactly what the browser would paint first.
      mockFns.request.mockReturnValueOnce(new Promise(() => {}));

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      try {
        flushSync(() => root.render(wrapper({ children: <Form netexId={NETEX_ID} /> })));
        expect(container.textContent).not.toContain('Not found');
        expect(container.textContent).toContain('Loading...');
      } finally {
        act(() => root.unmount());
        container.remove();
      }
    });

    it('surfaces a failed load instead of reporting it as not found', async () => {
      mockFns.request.mockRejectedValueOnce(new Error('boom'));

      render(<Form netexId={NETEX_ID} />, { wrapper });

      await waitFor(() => expect(screen.getByText('Failed to load')).toBeInTheDocument());
      expect(screen.queryByText(`Not found: ${NETEX_ID}`)).toBeNull();
    });

    // `FIELDS` is distilled from the patched schema, the mask from the live one,
    // so the difference is exactly the fields sobek would reject. They must reach
    // the control but never the request.
    const patchOnly = Object.keys(fields).filter(
      k => !fields[k].serverManaged && !fields[k].locked && !(fields[k].path[0] in mask)
    );

    it.runIf(patchOnly.length)('saves no patch-only field', async () => {
      const row = {
        netexId: NETEX_ID,
        ...Object.fromEntries(patchOnly.map(k => [fields[k].path[0], 'x'])),
      };
      mockFns.request
        .mockResolvedValueOnce(rows([row]))
        .mockResolvedValueOnce({ [entry.mutationName]: NETEX_ID })
        .mockResolvedValueOnce(rows([row]));

      render(<Form netexId={NETEX_ID} />, { wrapper });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(mockFns.request).toHaveBeenCalledTimes(3));
      const [, vars] = mockFns.request.mock.calls[1];
      const sent = Object.keys((vars as { input: Record<string, unknown> }).input);
      expect(sent).not.toHaveLength(0);
      expect(sent.filter(k => !(k in mask))).toEqual([]);
    });

    // Locked fields are client-supplied but not user-editable; the wrapper must
    // render them from context in create mode, disabled, without loading anything.
    const lockedKeys = Object.keys(fields).filter(k => fields[k].locked);

    it.runIf(lockedKeys.length)(
      'create mode renders locked fields from context, disabled, with no load',
      () => {
        render(<Form />, { wrapper });

        for (const key of lockedKeys) {
          const input = screen.getByLabelText(humanize(key)) as HTMLInputElement;
          expect(input).toBeDisabled();
          // Only the tenant discriminator is supplied by the provider today; any
          // other locked field would render empty until the generator seeds it.
          if (key === OWNER_FIELD) expect(input.value).toBe(OWNER_REF);
        }
        expect(mockFns.request).not.toHaveBeenCalled();
      }
    );
  }
);
