/**
 * Component tests for the generated `VehicleForm` wrapper.
 *
 * The wrapper is auto-generated — these tests pin the *contract* the generator
 * must keep emitting: not-found state on a settled zero-row load, and the
 * display-only `dataOwnerRef` fallback in create mode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SobekProvider } from '../../context/SobekContext';
import { VehicleForm } from './vehicle';

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

const OWNER_REF = 'NOG:Authority:test';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SobekProvider value={{ endpoint: 'http://test', dataOwnerRef: OWNER_REF }}>
    {children}
  </SobekProvider>
);

describe('VehicleForm', () => {
  beforeEach(() => {
    mockFns.request.mockReset();
    mockFns.setHeaders.mockReset();
  });

  it('renders a not-found state on a settled zero-row load (no blank form)', async () => {
    mockFns.request.mockResolvedValueOnce({ vehicles: { content: [] } });

    render(<VehicleForm netexId="VEH:99" />, { wrapper });

    await waitFor(() => expect(screen.getByText('Not found: VEH:99')).toBeInTheDocument());
    expect(screen.queryByLabelText('Registration number')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('create mode renders an empty form with the context dataOwnerRef locked', () => {
    render(<VehicleForm />, { wrapper });

    const owner = screen.getByLabelText('Data owner ref') as HTMLInputElement;
    expect(owner.value).toBe(OWNER_REF);
    expect(owner).toBeDisabled();
    expect(mockFns.request).not.toHaveBeenCalled();
  });
});
