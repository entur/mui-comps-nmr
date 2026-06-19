import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import type { Vehicle, VehicleType } from "../index";
import {
  VehicleForm,
  VehicleTypeForm,
  vehicleLayout,
  vehicleTypeLayout,
  vehicleSample,
  vehicleTypeSample,
} from "./initDataSets";

// Width of the form Drawer (right anchor).
const DRAWER_WIDTH = 480;

/** Which entity flavour the Drawer is showing (null = closed). */
type Flavour = "type" | "vehicle" | null;

/**
 * How section tabs are presented:
 * - `none`      → no tabs at all (stacked sections).
 * - `one-line`  → scrollable tabs on a single line, swipe/wheel to reach overflow.
 * - `pills`     → wrapping pill/segmented tabs (hathor's VehicleTypeForm style):
 *                 no underline indicator, filled active pill, tabs wrap onto a
 *                 second line when the rail is too narrow.
 */
type TabStyle = "none" | "one-line" | "pills";

/**
 * Tabs `slotProps` reproducing hathor's wrapping pill tabs. Needs the
 * `standard` variant (scrollable forces a single non-wrapping row) plus a
 * flex-wrap container and filled-pill tab styling.
 */
const PILL_TABS_SX = {
  minHeight: 0,
  "& .MuiTabs-indicator": { display: "none" },
  "& .MuiTabs-flexContainer": { flexWrap: "wrap", gap: 0.75 },
  "& .MuiTab-root": {
    minHeight: 30,
    px: 1.25,
    py: 0.25,
    borderRadius: 1,
    textTransform: "none",
    bgcolor: "action.hover",
    color: "text.secondary",
  },
  "& .MuiTab-root.Mui-selected": {
    bgcolor: "primary.main",
    color: "primary.contrastText",
  },
} as const;

/* ------------------------------------------------------------------ *\
   Dirty tracking (client-side — the lib is pure: controlled, no save)
\* ------------------------------------------------------------------ */

/** Snapshot deep-equality. Entity values keep a stable key order (samples +
 *  immutable `setPath` updates preserve insertion order), so a JSON compare is
 *  a sufficient dirty check for a story — no deep-equal dependency needed. */
const eq = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Pair a controlled `value` with a committed baseline so the host can tell when
 * a form is dirty. The form factory stays save-agnostic; this is the client's
 * job, demonstrated here.
 *
 * @param initial Seed value, also the first baseline.
 * @returns `{ value, setValue, dirty, save, cancel }` — `save` adopts the live
 *          value as the new baseline; `cancel` reverts edits back to it.
 */
function useEditable<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [baseline, setBaseline] = useState<T>(initial);
  return {
    value,
    setValue,
    dirty: !eq(value, baseline),
    save: () => setBaseline(value),
    cancel: () => setValue(baseline),
  };
}

/* ------------------------------------------------------------------ *\
   Tab-style selector (shared by the mock cards)
\* ------------------------------------------------------------------ */

/**
 * Track a tab style and derive the form's section `variant` + Tabs `slotProps`:
 * `none` stacks (no tabs); `one-line` scrolls on one row with `>` chevrons;
 * `pills` wraps into hathor's filled pills.
 *
 * @param initial Starting style (default `none`).
 * @returns `{ tabStyle, setTabStyle, variant, slotProps }`.
 */
function useTabStyle(initial: TabStyle = "none") {
  const [tabStyle, setTabStyle] = useState<TabStyle>(initial);
  const variant = tabStyle === "none" ? "stacked" : "tabs";
  const slotProps =
    tabStyle === "pills"
      ? { tabs: { variant: "standard" as const, sx: PILL_TABS_SX } }
      : {
          tabs: {
            variant: "scrollable" as const,
            scrollButtons: "auto" as const,
            allowScrollButtonsMobile: true,
          },
        };
  return { tabStyle, setTabStyle, variant, slotProps } as const;
}

/** Captioned none|one-line|pills toggle, as placed in the mock cards. */
const TabStyleToggle = ({
  value,
  onChange,
}: {
  value: TabStyle;
  onChange: (v: TabStyle) => void;
}) => (
  <Stack spacing={0.5}>
    <Typography variant="caption" color="text.secondary">
      tabs style
    </Typography>
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_e, v: TabStyle | null) => v && onChange(v)}
    >
      <ToggleButton value="none">none</ToggleButton>
      <ToggleButton value="one-line">one-line</ToggleButton>
      <ToggleButton value="pills">pills</ToggleButton>
    </ToggleButtonGroup>
  </Stack>
);

/* ------------------------------------------------------------------ *\
   Shared mock chrome
\* ------------------------------------------------------------------ */

/** Human label per Drawer flavour. */
const FLAVOUR_LABEL: Record<NonNullable<Flavour>, string> = {
  type: "Vehicle Type",
  vehicle: "Vehicle",
};

/**
 * Shared mock surface: the responsive Paper grid with a left-biased Card column
 * (golden-ish 25% on `md`+, single centered column below it), plus the
 * right-anchored Drawer. Each story passes its card body as `children` and its
 * form Drawer as `drawer`.
 *
 * @param children Card body (controls + launch buttons).
 * @param drawer   The `<Drawer>` element, rendered as a sibling of the Card.
 */
const MockShell = ({
  children,
  drawer,
}: {
  children: ReactNode;
  drawer: ReactNode;
}) => (
  <Paper
    elevation={0}
    sx={{
      display: "grid",
      // Gutters 1fr left : 3fr right around the centered card column → card
      // center lands at ~25% of the Paper width. Collapse to a single centered
      // column on small screens so the gutters don't crush the card.
      gridTemplateColumns: { xs: "1fr", md: "1fr auto 3fr" },
      justifyItems: { xs: "center", md: "stretch" },
      alignItems: "start",
      gap: { xs: 3, md: 8 },
      minHeight: "100vh",
      p: { xs: 2, sm: 4, md: 8 },
      bgcolor: "grey.100",
    }}
  >
    <Card sx={{ gridColumn: { xs: "1", md: 2 }, maxWidth: 360, width: "100%" }}>
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        {children}
      </CardContent>
    </Card>
    {drawer}
  </Paper>
);

/**
 * App mock: a Paper surface holding a centered Card whose two buttons each open
 * a right-anchored Drawer onto the matching form — "Type" → VehicleTypeForm,
 * "Vehicle" → VehicleForm. Each form's value is owned here so edits round-trip
 * and survive close/reopen.
 */
const AppMock = () => {
  const [open, setOpen] = useState<Flavour>(null);
  const [vehicleType, setVehicleType] =
    useState<VehicleType>(vehicleTypeSample);
  const [vehicle, setVehicle] = useState<Vehicle>(vehicleSample);
  // User choices steering the Drawer forms. Defaults → stacked + editable.
  const { tabStyle, setTabStyle, variant, slotProps } = useTabStyle();
  const [readOnly, setReadOnly] = useState(false);

  const mode = readOnly ? "view" : "edit";

  return (
    <MockShell
      drawer={
        <Drawer
          anchor="right"
          open={open !== null}
          onClose={() => setOpen(null)}
        >
          {/* Cap at the viewport so the Drawer never overflows on screens
            narrower than DRAWER_WIDTH; go full-width below the sm breakpoint. */}
          <Box
            sx={{
              width: { xs: "100vw", sm: DRAWER_WIDTH },
              maxWidth: "100vw",
              boxSizing: "border-box",
              p: { xs: 2, sm: 3 },
            }}
          >
            {/* Close affordance — essential on the full-width (xs) sheet where no
              backdrop is exposed to tap; harmless on the wider sheet too. Sticky
              so it stays reachable while the form scrolls. */}
            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                display: "flex",
                justifyContent: "flex-end",
                mb: 1,
              }}
            >
              <IconButton
                aria-label="Close"
                onClick={() => setOpen(null)}
                size="small"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            {open === "type" && (
              <VehicleTypeForm
                mode={mode}
                variant={variant}
                slotProps={slotProps}
                layout={vehicleTypeLayout}
                value={vehicleType}
                onChange={setVehicleType}
              />
            )}
            {open === "vehicle" && (
              <VehicleForm
                mode={mode}
                variant={variant}
                slotProps={slotProps}
                layout={vehicleLayout}
                value={vehicle}
                onChange={setVehicle}
              />
            )}
          </Box>
        </Drawer>
      }
    >
      <Stack alignItems="flex-start" spacing={1}>
        <TabStyleToggle value={tabStyle} onChange={setTabStyle} />
        <FormControlLabel
          control={
            <Switch
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
            />
          }
          label="read-only"
        />
      </Stack>
      <Typography variant="body1" align="center">
        Click a button to open its Form in a Drawer
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => setOpen("type")}>
          Type
        </Button>
        <Button variant="contained" onClick={() => setOpen("vehicle")}>
          Vehicle
        </Button>
      </Stack>
    </MockShell>
  );
};

/**
 * Save-or-cancel variant: the Drawer becomes a full-height shell — titled
 * header · scrolling form · a sticky action footer that stays dormant until the
 * form is dirty, then wakes (amber pulsing status dot, live label, active
 * Save/Cancel). Dirtiness is tracked per entity via `useEditable`; the form
 * factory itself knows nothing of save — that's the host's concern.
 */
const SaveOrCancelMock = () => {
  const [open, setOpen] = useState<Flavour>(null);
  const type = useEditable<VehicleType>(vehicleTypeSample);
  const vehicle = useEditable<Vehicle>(vehicleSample);
  const { tabStyle, setTabStyle, variant, slotProps } = useTabStyle();
  // The editable bound to whichever flavour the Drawer is showing.
  const active = open ? { type, vehicle }[open] : null;
  const dirty = active?.dirty ?? false;
  const close = () => setOpen(null);

  return (
    <MockShell
      drawer={
        <Drawer anchor="right" open={open !== null} onClose={close}>
          <Box
            sx={{
              width: { xs: "100vw", sm: DRAWER_WIDTH },
              maxWidth: "100vw",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
            }}
          >
            {/* Header: entity title + close X. */}
            <Box
              sx={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: { xs: 2, sm: 3 },
                py: 1.5,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {open && FLAVOUR_LABEL[open]}
              </Typography>
              <IconButton aria-label="Close" onClick={close} size="small">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Scrolling form body — the only part that overflows. `minHeight: 0`
              lets this flex child shrink below its content height on short
              viewports so its own scroll kicks in and the footer stays pinned
              (without it, a tall form pushes the footer out of the drawer). */}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                px: { xs: 2, sm: 3 },
                py: 2,
              }}
            >
              {open === "type" && (
                <VehicleTypeForm
                  mode="edit"
                  variant={variant}
                  slotProps={slotProps}
                  layout={vehicleTypeLayout}
                  value={type.value}
                  onChange={type.setValue}
                />
              )}
              {open === "vehicle" && (
                <VehicleForm
                  mode="edit"
                  variant={variant}
                  slotProps={slotProps}
                  layout={vehicleLayout}
                  value={vehicle.value}
                  onChange={vehicle.setValue}
                />
              )}
            </Box>

            {/* Sticky action footer: dormant when clean, lit when dirty. */}
            <Box
              sx={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1.5,
                px: { xs: 2, sm: 3 },
                py: 1.5,
                borderTop: 1,
                borderColor: dirty ? "warning.main" : "divider",
                bgcolor: (theme) =>
                  dirty
                    ? alpha(theme.palette.warning.main, 0.08)
                    : "background.paper",
                boxShadow: dirty
                  ? "0 -10px 28px -20px rgba(0,0,0,0.55)"
                  : "none",
                transition: (theme) =>
                  theme.transitions.create(
                    ["background-color", "border-color", "box-shadow"],
                    {
                      duration: theme.transitions.duration.short,
                    },
                  ),
              }}
            >
              {/* Status: pulsing dot + live label. */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box
                  sx={{
                    position: "relative",
                    width: 8,
                    height: 8,
                    display: "inline-flex",
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: dirty ? "warning.main" : "success.light",
                      transition: (theme) =>
                        theme.transitions.create("background-color"),
                    }}
                  />
                  {dirty && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        bgcolor: "warning.main",
                        animation: "soPulse 1.6s ease-out infinite",
                        "@keyframes soPulse": {
                          "0%": { transform: "scale(1)", opacity: 0.6 },
                          "70%, 100%": { transform: "scale(2.8)", opacity: 0 },
                        },
                      }}
                    />
                  )}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: dirty ? "warning.dark" : "text.secondary",
                    fontWeight: 500,
                  }}
                >
                  {dirty ? "Unsaved changes" : "All changes saved"}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="inherit"
                  size="small"
                  disabled={!dirty}
                  onClick={() => active?.cancel()}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!dirty}
                  onClick={() => active?.save()}
                  sx={
                    dirty
                      ? {
                          animation: "saveGlow 2.4s ease-in-out infinite",
                          "@keyframes saveGlow": {
                            "0%, 100%": { boxShadow: 1 },
                            "50%": { boxShadow: 6 },
                          },
                        }
                      : undefined
                  }
                >
                  Save
                </Button>
              </Stack>
            </Box>
          </Box>
        </Drawer>
      }
    >
      <TabStyleToggle value={tabStyle} onChange={setTabStyle} />
      <Typography variant="body1" align="center">
        Edit a field — Save / Cancel wake up once the form is dirty
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => setOpen("type")}>
          Type
        </Button>
        <Button variant="contained" onClick={() => setOpen("vehicle")}>
          Vehicle
        </Button>
      </Stack>
    </MockShell>
  );
};

const meta: Meta<typeof AppMock> = {
  title: "compositions/AppMock",
  component: AppMock,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AppMock>;

export const SaveAndCancel: Story = { render: () => <SaveOrCancelMock /> };
export const Barebone: Story = {};
