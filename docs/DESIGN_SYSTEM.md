# Design System

Bearsome's UI is intentionally small and dependency-free: **plain CSS with
design tokens** (CSS custom properties) defined in
[`src/renderer/src/styles.css`](../src/renderer/src/styles.css). No Tailwind, no
CSS-in-JS, no component library. This page is the reference for the visual
language and the reusable patterns so new UI stays consistent.

## Design principles

1. **Dark, game-launcher feel.** Deep neutral backgrounds with a single vivid
   green accent — energetic but not noisy.
2. **Tokens over magic numbers.** Use the CSS variables; don't hardcode colors,
   radii, or shadows.
3. **One accent, used sparingly.** Green signals "the primary action / success".
   Don't paint whole surfaces with it.
4. **Calm hierarchy.** Dimmed text (`--text-dim`) for secondary info, full
   `--text` for primary; elevation via `--bg-elev` layers, not heavy borders.
5. **Feedback is always visible.** Every async action surfaces a busy state,
   a progress bar, and/or a toast.

## Tokens

Defined on `:root`:

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0f1117` | App background |
| `--bg-elev` | `#171a23` | Cards, sidebar, panels (elevation 1) |
| `--bg-elev-2` | `#1f2430` | Inputs, chips, nested rows (elevation 2) |
| `--border` | `#2a3040` | Hairline borders / dividers |
| `--text` | `#e6e9f0` | Primary text |
| `--text-dim` | `#9aa3b8` | Secondary / meta text |
| `--accent` | `#4ade80` | Primary actions, active nav, success |
| `--accent-2` | `#22c55e` | Primary hover |
| `--danger` | `#f87171` | Destructive actions, errors, alpha badge |

### Shape & depth

| Token | Value | Use |
| --- | --- | --- |
| `--radius` | `12px` | Card / panel corner radius (buttons/inputs use ~10px) |
| `--shadow` | `0 8px 30px rgba(0,0,0,.45)` | Modals, toasts, floating elements |

### Typography

- Family: `'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif`.
- Scale (approx., from component CSS): page titles ~20px/700, card titles
  16px/600, body 14px, meta 13px, badges/pills 11–12px uppercase.
- Antialiased (`-webkit-font-smoothing: antialiased`).

## Layout

- **Shell:** a CSS grid `220px | 1fr` — fixed sidebar + scrollable content
  (`.app`, `.sidebar`, `.content`).
- **Sidebar:** brand mark, nav buttons (`.nav-item`, `.active`), and a footer
  badge showing the active loader/version.
- **Browse grid:** `repeat(auto-fill, minmax(280px, 1fr))` responsive card grid
  (`.grid`).
- **Modal:** centered overlay with a `min(720px, 100%)` panel (`.modal-overlay`,
  `.modal`).

## Components & class patterns

| Pattern | Classes | Notes |
| --- | --- | --- |
| Buttons | `.btn` + `.btn-primary` / `.btn-ghost` / `.btn-danger` | Primary = green; ghost = elevated neutral; danger = outlined red. Built-in `:disabled` and active press. |
| Inputs / selects | `.input` | Shared field style; green focus border. |
| Mod card | `.card`, `.card-icon`, `.card-title`, `.card-desc`, `.card-meta`, `.card-actions` | Hover lifts and accents the border. Icon falls back to a letter placeholder (`.card-icon--placeholder`). |
| Version row | `.version-row`, `.version-info`, `.badge` (`.badge-release/-beta/-alpha`) | Release = green, beta = amber, alpha = red. |
| Chips | `.chip` | Category tags. |
| Library row | `.installed-row`, `.installed-icon`, `.installed-info` | Title, filename·size·time, remove button. |
| Toast | `.toast` + `.toast-ok` / `.toast-err` | Bottom-center, auto-dismiss (~4s). |
| Progress | `.progress-toast`, `.progress-track`, `.progress-fill` | Bottom-right download indicator. |
| State blocks | `.state`, `.state-error` | Empty/loading/error placeholders. |
| Pills/badges | `.pill`, `.loader-badge` | Counts and the active-loader badge. |

### Icon fallback convention
When a Modrinth `icon_url` is missing, render a placeholder div using the first
character of the title with `.card-icon--placeholder` (green, uppercase). Reused
across cards, the detail header, and the library.

## Iconography

Emoji are used as lightweight glyphs (🐻 brand, 🔍 Browse, 📦 Library, ⚙
Settings, ⬇ downloads, ❤ followers, ✕ close). This keeps the bundle free of an
icon dependency; swap to an SVG set if richer iconography is needed later.

## Adding new UI — checklist

- Reuse existing tokens and the `.btn` / `.input` / `.card` families before
  inventing new styles.
- Keep destructive actions on `.btn-danger` and confirm-by-design (the user
  initiates removals explicitly).
- Always provide loading, empty, and error states (`.state` / `.state-error`).
- Surface async results with a toast (`flash('ok' | 'err', text)` in `App.tsx`).
- Respect the CSP: images may only load from `cdn.modrinth.com` (and `self`).
  If you need another image host, update the CSP in
  [`src/renderer/index.html`](../src/renderer/index.html) deliberately.
