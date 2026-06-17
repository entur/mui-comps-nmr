import type { Preview } from '@storybook/react-vite';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

/**
 * Storybook-only MUI theme. Consumers supply their own theme in production —
 * this exists purely to present the components on a clean, branded surface.
 * A restrained Entur-leaning palette (deep teal) with IBM Plex Sans (loaded in
 * `preview-head.html`) instead of the default Roboto.
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#11616f' },
    secondary: { main: '#e8663d' },
    background: { default: '#f4f1ea', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
  },
});

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { default: 'paper' },
  },
  decorators: [
    Story => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
