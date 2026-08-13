/**
 * `EditFooter` is presentational — it holds no state and knows nothing about
 * saving. These pin the two things a host actually depends on: the buttons are
 * inert unless there is something to act on, and every string is overridable
 * (the library carries no i18n).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditFooter } from './EditFooter';

const save = () => screen.getByRole('button', { name: 'Save' });
const cancel = () => screen.getByRole('button', { name: 'Cancel' });

describe('EditFooter', () => {
  it('renders both actions inert while the form is clean', () => {
    render(<EditFooter dirty={false} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(save()).toBeDisabled();
    expect(cancel()).toBeDisabled();
  });

  it('wakes both actions once dirty and reports the click', () => {
    const onSave = vi.fn(), onCancel = vi.fn();
    render(<EditFooter dirty onSave={onSave} onCancel={onCancel} />);

    fireEvent.click(save());
    fireEvent.click(cancel());

    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('locks both actions while a save is in flight', () => {
    const onSave = vi.fn(), onCancel = vi.fn();
    render(<EditFooter dirty saving onSave={onSave} onCancel={onCancel} />);

    // Not just double-submit: discarding mid-flight would restore a baseline
    // the in-flight save is about to replace.
    expect(save()).toBeDisabled();
    expect(cancel()).toBeDisabled();
  });

  it('honours `disabled` even when dirty', () => {
    render(<EditFooter dirty disabled onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(save()).toBeDisabled();
    expect(cancel()).toBeDisabled();
  });

  it('states the session status, and takes localized strings for every word', () => {
    const { rerender } = render(
      <EditFooter dirty={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText('All changes saved')).toBeInTheDocument();

    rerender(<EditFooter dirty onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    rerender(
      <EditFooter
        dirty
        onSave={vi.fn()}
        onCancel={vi.fn()}
        labels={{ save: 'Lagre', cancel: 'Avbryt', dirty: 'Ulagrede endringer' }}
      />
    );
    expect(screen.getByRole('button', { name: 'Lagre' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avbryt' })).toBeInTheDocument();
    expect(screen.getByText('Ulagrede endringer')).toBeInTheDocument();
  });
});
