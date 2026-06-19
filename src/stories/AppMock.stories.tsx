import { useState } from "react";
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

/**
 * App mock: a Paper surface holding a centered Card whose two buttons each open
 * a right-anchored Drawer onto the matching form — "Type" → VehicleTypeForm,
 * "Vehicle" → VehicleForm. Each form's value is owned here so edits round-trip
 * and survive close/reopen.
 */
const AppMock = () => {
  const [open, setOpen] = useState<Flavour>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>(vehicleTypeSample);
  const [vehicle, setVehicle] = useState<Vehicle>(vehicleSample);
  // User choices steering the Drawer forms. Defaults → stacked + editable.
  const [tabStyle, setTabStyle] = useState<TabStyle>("none");
  const [readOnly, setReadOnly] = useState(false);

  const variant = tabStyle === "none" ? "stacked" : "tabs";
  const mode = readOnly ? "view" : "edit";
  // Map the chosen tab style onto the form's Tabs slotProps:
  //  one-line → scrollable single row with `>` scroll chevrons on overflow;
  //  pills    → standard variant + wrapping pill styling (hathor look).
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

  return (
    <Paper
      elevation={0}
      sx={{
        display: "grid",
        // Gutters 1fr left : 3fr right around the centered card column →
        // card center lands at ~25% of the Paper width. Collapse to a single
        // centered column on small screens so the gutters don't crush the card.
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
          sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
        >
          <Stack alignItems="flex-start" spacing={1}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                tabs style
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={tabStyle}
                onChange={(_e, v: TabStyle | null) => v && setTabStyle(v)}
              >
                <ToggleButton value="none">none</ToggleButton>
                <ToggleButton value="one-line">one-line</ToggleButton>
                <ToggleButton value="pills">pills</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <FormControlLabel
              control={<Switch checked={readOnly} onChange={e => setReadOnly(e.target.checked)} />}
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
        </CardContent>
      </Card>

      <Drawer anchor="right" open={open !== null} onClose={() => setOpen(null)}>
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
            <IconButton aria-label="Close" onClick={() => setOpen(null)} size="small">
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
    </Paper>
  );
};

const meta: Meta<typeof AppMock> = {
  title: "compositions/AppMock",
  component: AppMock,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AppMock>;

export const Default: Story = {};
