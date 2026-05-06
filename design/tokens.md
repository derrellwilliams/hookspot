# Design Tokens

**Reference**: `src/tokens.js`, `src/style.css`

## Colors (CSS Custom Properties)

### Semantic Tokens
Used throughout the app via CSS custom properties:

- **--accent** — Primary action color (buttons, links, focus states)
- **--dark-text** — Main body text color
- **--dark-muted** — Secondary text (labels, hints, disabled)
- **--dark-surface** — Card/panel backgrounds
- **--dark-border** — Border color
- **--dark-bg** — Page background
- **--ui-bg** — Form input background

### Hardcoded Colors (For Reference)

#### Authentication Pages
- Mesh background: `#1A1953` (dark purple)
- Input background: `#3a3a3a` (form inputs on login)
- Input focus: `#444444`
- Input placeholder: `#888888`
- Error text: `#f87171` (red)
- Success text: `#4ade80` (green)
- Text: `#ffffff` (white), `rgba(255, 255, 255, 0.7)` (muted white)

#### Profile Page
- Page background: `#111113` (near black)
- Avatar spinner: `rgba(255,255,255,0.3)` border, `#fff` top
- Dialog overlay: `rgba(0, 0, 0, 0.6)` with blur
- Dialog background: `rgba(0, 0, 0, 0.85)`
- Shadow: `0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)`
- Stats colors: `#8d8d8d` (muted mono text)

---

## Typography

### Font Families
1. **Space Mono** — Branding, headings, large display text
2. **Roboto** — Body text, labels, standard reading
3. **Roboto Mono** — Code-like text (dates, locations, IDs)

### Scale

#### Headings
- **Large** (h1 equiv): Space Mono, 32px, 700, white
  - Profile name / display name
  - Stats title
- **Medium** (h2 equiv): Roboto, 20px-22px, 500-700
  - Dialog title
  - Form title (onboarding)
- **Small** (h3 equiv): Roboto, 16px, 700
  - Section labels, favorite species

#### Body
- **Standard**: Roboto, 14-15px, 400, dark-text
  - Form inputs, body text
- **Small**: Roboto, 11-12px, 500, dark-muted
  - Field labels, hints
- **Tiny**: Roboto Mono, 11px, 400, dark-muted
  - Metadata (dates, times, locations)

#### UI Labels
- Uppercase, 11-12px, 500, letter-spacing 0.07-0.08em
- Used for: form labels, section headers, card labels

---

## Spacing

### Standard Gaps
- `4px` — Small spacing (between icon + text)
- `6px` — Form field gaps
- `8px` — Button/control spacing
- `10px` — Grid gaps
- `12px` — Component gaps, dialog padding
- `16px` — Section spacing
- `20px` — Card padding
- `24px` — Major spacing (page padding, gaps)
- `32px` — Large gaps, stat spacing

### Common Sizing
- **Avatar**: 80px (onboarding), 112px (profile)
- **Icon**: 36px (placeholder), 12-14px (edit badge)
- **Favorite grid**: 4 columns, 10px gap, aspect 3:4

---

## Border Radius

- **Sharp**: 4px (form inputs on auth pages)
- **Rounded**: 8px (form inputs on onboarding/profile)
- **Large**: 12px (favorite cards)
- **Pill**: 50% (avatars, spinners)
- **Card**: 16px (cards, dialogs)

---

## Transitions

- **Standard**: 0.15s (color, background, opacity, border)
- **Spin**: 0.7s linear (avatar spinner animation)

---

## Z-Index Levels

- **0-1**: Background elements (mesh, blob)
- **1**: Main content (form card)
- **2000**: Dialog backdrop
- **2001**: Dialog content

---

## Breakpoints

No explicit breakpoints defined. Uses:
- `clamp()` for responsive typography (e.g., Feed page)
- `max-width` for container centering
- `width: 100%` with `max-width` for responsive cards
