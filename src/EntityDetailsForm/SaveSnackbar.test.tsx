/**
 * `SaveSnackbar` is the presentation half of the save lifecycle — the hook
 * already reports it through `onSaved` / `onError`. One nullable prop drives
 * open state, so a host stores one piece of state instead of three.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveSnackbar } from './SaveSnackbar';

describe('SaveSnackbar', () => {
  it('shows nothing when there is no toast', () => {
    render(<SaveSnackbar toast={null} onClose={vi.fn()} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the message, coloured by severity', () => {
    render(
      <SaveSnackbar toast={{ msg: 'Saved VEH:1', severity: 'success' }} onClose={vi.fn()} />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Saved VEH:1');
    expect(alert.className).toMatch(/MuiAlert-filledSuccess/);
  });

  it('renders an error toast as an error alert', () => {
    render(
      <SaveSnackbar toast={{ msg: 'name too long', severity: 'error' }} onClose={vi.fn()} />
    );

    expect(screen.getByRole('alert').className).toMatch(/MuiAlert-filledError/);
  });

  it('reports an explicit dismissal', () => {
    const onClose = vi.fn();
    render(
      <SaveSnackbar toast={{ msg: 'Saved', severity: 'success' }} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
