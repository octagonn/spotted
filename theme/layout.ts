/**
 * Shared layout constants for chrome that other screens must clear.
 * Keep in sync with app/(tabs)/_layout.tsx — the tab bar imports these too.
 */

/** Floating tab-bar pill row height (pt). */
export const TAB_BAR_ROW_HEIGHT = 56;
/** Gap between the pill and the bottom edge when there is no home indicator. */
export const TAB_BAR_FLOAT_GAP = 16;
/**
 * Vertical space the floating tab bar occupies above the bottom safe-area
 * inset. Screens add their own `insets.bottom` on top of this.
 */
export const TAB_BAR_HEIGHT = TAB_BAR_ROW_HEIGHT + TAB_BAR_FLOAT_GAP;

/** Bottom content padding that fully clears the tab bar plus breathing room. */
export function tabBarClearance(insetBottom: number, extra = 12): number {
  return TAB_BAR_HEIGHT + insetBottom + extra;
}
