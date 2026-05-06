# Design System — Hook Spot

Reference for all styles and components used on **Login, Onboarding, Profile, and Feed** pages.

## Token Reference

From `src/style.css`:

```css
:root {
  --accent: #2563eb;              /* Primary action (buttons, focus) */
  --dark-surface: #2c2c2e;        /* Card/input backgrounds */
  --dark-border: #3a3a3c;         /* Borders */
  --dark-text: #f4f4f5;           /* Main text */
  --dark-muted: #a1a1aa;          /* Secondary text, hints */
  --ui-bg: #202020;               /* Form input bg */
}
```

Additional colors used directly in page CSS:
- Auth pages mesh: `#1A1953` (dark purple)
- Error: `#f87171` (red)
- Success: `#4ade80` (green)
- Overlay: `rgba(0, 0, 0, 0.6)` with blur

## Font Stack

- **Space Mono** — Branding, headings
- **Roboto** — Body, labels
- **Roboto Mono** — Code/metadata text

## Pages & Their CSS

| Page | Module CSS | Usage |
|------|-----------|-------|
| Login | `LoginPage.module.css` | Auth form with mesh background |
| Onboarding | `OnboardingPage.module.css` | Profile setup form with avatar upload |
| Profile | `UserProfilePage.module.css` | Profile display, favorites, stats, dialog |
| Feed | `FeedPage.module.css` | Placeholder only |

## UI Components

### Button
- **primary** (default) — Accent background, white text
- **secondary** — Dark surface, muted text
- **icon-sm** — Small circular icon button

Used on: Onboarding (upload), Profile (edit), throughout app

### Form Inputs
- **input** — Text input with dark theme, focus state
- **textarea** — Multi-line input (onboarding, profile)

Both from `ui.module.css` + page-specific overrides.

### Card
- Dark surface container, border, rounded corners
- Used for: form cards, stat cards, favorites

## Page-Specific Styles

### Login Page
- Mesh background animation
- Centered form card
- Email → code verification flow

### Onboarding Page
- Similar mesh background
- Avatar upload field
- Form validation states
- Username availability checking

### Profile Page
- Profile header (avatar + name + bio)
- Edit profile dialog (Radix UI)
- Favorites grid (4 columns)
- Stats display (charts from renderStats)
- Own vs other profile states

### Feed Page
- Minimal — just "Coming soon" placeholder

## See Also

- `src/tokens.js` — JS mirror of CSS tokens
- `src/style.css` — Global styles
- `src/components/ui/ui.module.css` — Shared button/input/card styles
