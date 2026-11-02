# UI design

Minimal, light interface built with shadcn/ui (Radix, "nova" preset), Tailwind CSS v4 and Motion
(`motion/react`, the Framer Motion library).

## Principles

- **Neutral surfaces, one warm accent.** Primary is a deep orange (`--primary`), tuned for ≥ 4.5:1 contrast
  with its foreground in light and dark themes. Status colours (`--success`, `--warning`, `--info`,
  `--destructive`) are reserved for state.
- **Status is never colour alone (NFR-28).** Order/payment badges always carry an icon and a text label.
- **Subtle motion.** Short fades and springs (≤ 350 ms) for entrances, shared-layout highlights for active
  navigation and tabs, animated progress for order tracking, number pop on cart count. `MotionConfig
  reducedMotion="user"` disables movement for users who prefer reduced motion.
- **Loading, empty, success, error states (NFR-26).** Every async section has a skeleton fallback,
  empty states have an icon + action, mutations toast success or a human-readable error, and `app/error.tsx`
  never exposes stack traces.
- **Responsive (NFR-30–32).** Student pages: sticky header with a bottom-border tab bar on mobile, sticky
  "View cart" bar on menus. Staff/admin: sidebar on ≥ md, horizontally scrolling pill nav on mobile.
  Controls are ≥ 28 px tall.
- **Forms (NFR-24, NFR-27).** Labels on every input, `*` for required fields, inline error text linked via
  `aria-describedby`, server-side validation messages per field.

## Screens

| Area | Routes |
|---|---|
| Public / student | `/`, `/stalls`, `/stalls/[id]`, `/cart`, `/orders`, `/orders/[code]`, `/notifications`, `/profile`, `/privacy`, `/login`, `/register` |
| Staff | `/staff` (order board), `/staff/menu`, `/staff/slots`, `/staff/forecast`, `/staff/reports`, `/staff/notifications` |
| Admin | `/admin`, `/admin/stalls`, `/admin/users`, `/admin/reports`, `/admin/settings`, `/admin/audit` |

## Charts

Reports use a single-series bar chart (one metric at a time on one axis, hover/focus tooltips, table view)
and ranked bars for top items. The bar colour `--chart-bar` (#c2410c light / #d9732a dark) was validated
for lightness band and ≥ 3:1 contrast against the card surface. Reports only show actual values; forecasts
live on their own page and are labelled as estimates (FR-92).
