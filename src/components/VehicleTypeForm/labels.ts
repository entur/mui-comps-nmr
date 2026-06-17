/**
 * Label injection for {@link VehicleTypeForm}.
 *
 * The library carries no i18n runtime dependency. Every visible string is
 * requested through a `t(key, fallback)` function whose default simply returns
 * the English `fallback`. A consumer already running an i18n framework (e.g.
 * `react-i18next`) can pass its own `t` to translate by `key`; everyone else
 * gets the English baseline for free.
 */

/**
 * Translate function shape — `(key, fallback) => string`. Compatible with
 * `react-i18next`'s `t` (which accepts a key and a default-value string).
 *
 * @param key      Stable translation key (e.g. `vehicleType.field.name`).
 * @param fallback English default returned when no translation is wired up.
 */
export type TFn = (key: string, fallback: string) => string;

/** Default `t`: ignore the key, return the English fallback verbatim. */
export const defaultT: TFn = (_key, fallback) => fallback;
