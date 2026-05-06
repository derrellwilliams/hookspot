# Reusable Components

## Button

**File**: `src/components/ui/Button.jsx` / `ui.module.css`

### Variants
- **primary** (default) — `.btn-primary`
- **secondary** — `.btn-secondary`
- **icon-sm** — `.btn-icon-sm`

### States
- Default
- Hover
- Disabled (opacity 0.5)

### Props
- `variant` — button style variant
- `icon` — optional icon element (rendered in `.btnIcon` span)
- `children` — button text
- `className` — additional CSS classes

---

## Input

**File**: `src/components/ui/Input.jsx` / `ui.module.css`

Basic text input component with theme support.

---

## Card

**File**: `src/components/ui/Card.jsx` / `ui.module.css`

Container component for grouped content (forms, stats, etc.).

---

## AutocompleteInput

**File**: `src/components/ui/AutocompleteInput.jsx` / `ui.module.css`

Text input with autocomplete dropdown suggestions.

---

## Select / SelectWithCustom

**File**: `src/components/ui/Select.jsx` / `SelectWithCustom.jsx`

Dropdown select component with optional custom option support.

---

## Tooltip

**File**: `src/components/ui/Tooltip.jsx` / `ui.module.css`

Hover tooltip for additional information.

---

## FavoritePickerDialog

**File**: `src/components/FavoritePicker/FavoritePickerDialog.jsx`

Modal for selecting which photo to set as a favorite in a slot.

### Props
- `open` — boolean
- `current` — currently selected photo name or null
- `onSelect(photo)` — called when photo is selected
- `onRemove()` — called when current favorite is removed
- `onClose()` — called when dialog closes

---

## ProfileBlob

**File**: `src/components/ProfileBlob.jsx` / `ProfileBlob.module.css`

Animated blob decoration at top of profile page (visual element, no interaction).

---

## Toast

**File**: `src/components/Toast/Toast.jsx` / `Toast.module.css`

Toast notification component for brief messages (managed by Zustand store).

---

## UploadDialog

**File**: `src/components/UploadDialog/UploadDialog.jsx` / `UploadDialog.module.css`

File upload dialog with thumbnail strip preview.

### ThumbStrip
- **File**: `src/components/UploadDialog/ThumbStrip.jsx`
- Thumbnail preview list of selected files before upload

---

## Sidebar & Map Components

Not documented here as they're not used on login, onboarding, catches (feed), or profile pages.
