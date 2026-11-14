# Design: Petaniaga

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: modern-minimal
- Shape of the first page: App screen — map-first harvest discovery split
- Theme: custom (vibe: "pasar seakrab chat WhatsApp")
- Axes: light/grotesk-sans/chromatic-emerald · posture: utilitarian

## Tokens
`src/styles/tokens.css` is the source of truth. The roles:
```css
:root {
  --color-paper: oklch(93.8% 0.014 82);
  --color-paper-2: oklch(100% 0 0);
  --color-paper-3: oklch(97.2% 0.006 85);
  --color-ink: oklch(19.5% 0.018 205);
  --color-ink-2: oklch(37.5% 0.018 205);
  --color-muted: oklch(50.5% 0.016 205);
  --color-rule: oklch(92.5% 0.007 205);
  --color-accent: oklch(51.5% 0.118 168);
  --color-accent-ink: oklch(100% 0 0);
  --color-wa: oklch(55% 0.155 154);
  --color-bubble: oklch(95.5% 0.065 142);
  --color-focus: oklch(51.5% 0.118 168);
  --font-display: "Helvetica Neue", "Segoe UI", Roboto, "Noto Sans", system-ui, -apple-system, sans-serif;
  --font-body: "Helvetica Neue", "Segoe UI", Roboto, "Noto Sans", system-ui, -apple-system, sans-serif;
  --radius-card: 12px;
  --radius-pill: 9999px;
  --rule-hair: 1px;
  --shadow-card: 0 1px 1px oklch(19.5% 0.018 205 / 0.08);
}
```
The spacing, typography, radius, and motion tokens live in `src/styles/tokens.css`.

## Controls
- Primary: `--color-accent` (or `--color-wa` for WhatsApp order) · `10px` radius · `44px` min height
- Secondary: `--color-paper-2` with `1px solid var(--color-rule-strong)` · same radius and height

## Motion
- Character: brisk; `transform`, `opacity`, and `background-color` only (never `transition: all`); under `prefers-reduced-motion: reduce` everything ends at once.

## Exports
`src/styles/tokens.css`, `src/styles/base.css`, and `@theme` bridge in `src/routes/layout.css` (Tailwind v4).
