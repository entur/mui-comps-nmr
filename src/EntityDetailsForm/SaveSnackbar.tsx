/**
 * Save-result toast.
 *
 * The save lifecycle is already reported by the wrappers (`onSaved` /
 * `onError`); this is only its presentation, kept here so every host does not
 * re-derive the same Snackbar-plus-Alert pairing. Nullable `toast` doubles as
 * the open flag — one piece of host state covers message, severity, and
 * visibility.
 */
import { Alert, Snackbar, type SnackbarOrigin } from '@mui/material';

const AUTO_HIDE_MS = 3000;
const ANCHOR: SnackbarOrigin = { vertical: 'bottom', horizontal: 'center' };

/** What to say and how to colour it. */
export interface SaveToast {
  msg: string;
  severity: 'success' | 'error';
}

export interface SaveSnackbarProps {
  /** `null` closes it — the natural shape for `useState<SaveToast | null>(null)`. */
  toast: SaveToast | null;
  onClose: () => void;
  /** Milliseconds before it self-dismisses; `null` keeps it up until dismissed. */
  autoHideDuration?: number | null;
  anchorOrigin?: SnackbarOrigin;
}

/**
 * Render the save-result toast.
 *
 * @param props see {@link SaveSnackbarProps}
 * @returns a Snackbar carrying a filled Alert, or an empty one while closed
 */
export function SaveSnackbar({
  toast,
  onClose,
  autoHideDuration = AUTO_HIDE_MS,
  anchorOrigin = ANCHOR,
}: SaveSnackbarProps) {
  return (
    <Snackbar
      open={toast !== null}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
    >
      {/* Snackbar types its child as required, so an open-less render passes
          `undefined` rather than an Alert with nothing to say. */}
      {toast ? (
        <Alert severity={toast.severity} variant="filled" onClose={onClose}>
          {toast.msg}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
