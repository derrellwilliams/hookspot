# UI Patterns & Interactions

## Form Patterns

### Authentication Flow (Login → Onboarding)

1. **Login Page**
   - Email entry form → click "Continue"
   - Backend sends OTP to email
   - Form switches to code verification
   - Code entry (6 digits, numeric only) → click "Sign in"
   - Success → redirect to onboarding

2. **Onboarding Page**
   - Avatar upload (required)
   - Username check (async validation)
   - Display name (optional)
   - Bio (optional)
   - All fields validated before "Get started"
   - Success → redirect to home

### Validation Feedback

- **On blur** (input leaves focus):
  - Username: async check availability → field error OR `.inputOk` border + green message
  - Username required pattern: immediate error if invalid format
- **On input**: Real-time formatting (lowercase only, no special chars)
- **On submit**: Revalidate before saving

### Disabled States

Buttons disabled until:
- Login: None (can submit empty)
- Onboarding: Avatar + valid username both required
- Profile edit: None (can save empty name/bio)

---

## Avatar Upload Pattern

### Editable Avatar (Own Profile)

1. Click avatar button or "Upload photo" link
2. Native file picker (image/* only)
3. File read → preview shows immediately (data URL)
4. On profile save → upload to Supabase auth + sync to profiles table

### Avatar Display

- **Circular button** (own profile)
- **Static image** (other profile)
- **Fallback**: First letter initial or placeholder icon
- **Edit indicator**: Small edit badge (only if no image)

---

## Dialog Patterns

### Edit Profile Dialog
- Appears as modal with backdrop blur
- Contains avatar + name + bio fields
- Cancel button closes without saving
- Save button validates + submits
- Disabled during save operation
- Shows loading indicator on avatar upload

### Favorite Picker Dialog
- Grid of photos (own profile only)
- Click slot → open picker
- Select photo → updates slot, saves to DB
- Remove button → clears slot
- Close → dismiss without picking

---

## Profile Header Patterns

### Own Profile
- Avatar (clickable, upload on click)
- Name (clickable edit button)
- Bio (shows placeholder if empty)
- Edit Profile button (opens dialog)
- Stats below

### Other Profile
- Avatar (static, non-interactive)
- Name (heading)
- Bio (if set)
- Follow/Unfollow button
- Stats below

### Stats Section
- Only shows if user has GPS-tagged photos
- Dynamic charts rendered by `renderStats()`
- Monthly, daily, species, weather breakdowns

---

## Grid Patterns

### Favorites Grid
- 4 equal-width columns
- 3:4 aspect ratio (portrait)
- Empty slots: dashed border, "+" hint
- Filled slots: image + metadata overlay
- Own profile: slots are clickable
- Other profile: read-only (but still visible if populated)

### Stats Cards
- 1-column on mobile-ish, 2-column pairs on desktop
- Dark surface background
- Label above, chart content below
- Responsive grid with explicit 2-col sections

---

## Loading States

### Async Operations

1. **Username availability check**
   - Border shows "checking..." message
   - Debounced API call
   - Success/error feedback on result

2. **Avatar upload**
   - Overlay spinner on avatar during upload
   - Button disabled while uploading
   - Clears on success/error

3. **Profile save**
   - Save button shows "Saving…" text
   - Buttons disabled during save
   - Dialog closes on success

4. **Page load** (profile, stats)
   - "Loading…" message shown
   - Error state if fetch fails

---

## Error Handling

### Form Validation
- Inline error messages (red text below field)
- `.fieldError` class styling
- Clear error on input change or focus

### Network Errors
- Toast message (for profile update, follow/unfollow)
- Dialog error message (for edit save failures)
- Red error text, stays visible until retry

### Not Found
- Profile not found → error state with "Go back" button

---

## Accessibility

### Keyboard Navigation
- Tab through form fields
- Enter to submit forms
- Esc to close dialogs (via Radix UI)

### Semantic HTML
- Proper `<label>` elements with `htmlFor`
- `<button type="submit">` for form submissions
- `aria-label` on icon-only buttons
- `role` attributes via Radix UI components

### ARIA
- Dialog: Radix UI handles `role="dialog"`, focus trap
- Buttons: aria-label on icon buttons
- Images: alt text on avatars, catch photos

---

## Responsive Behavior

### Full Viewport Pages (Login, Onboarding, Profile)
- Fixed or absolute positioning
- Overflow handling (scroll on profile)
- Container max-width (profile: 860px)
- Centered content

### Forms
- Cards max-width: 400px
- Full width with padding on mobile
- Responsive grid gaps
- Touch-friendly button sizes (44px+ height)

### Grid Responsive
- Favorites: always 4 columns (may stack on small screens)
- Stats: 2-column pairs, may stack

---

## Animation & Transitions

### Hover Effects
- Button opacity changes (0.88)
- Border color transitions (0.15s)
- Background transitions (0.15s)

### Loading States
- Avatar spinner: continuous rotation (0.7s linear)
- Opacity transitions on disable (0.15s)

### No Page Transitions
- SPA navigation via React Router (instant)
- No page load animations

---

## Dark Mode

All components follow dark theme:
- Dark surfaces
- Light text
- Muted accents for secondary info
- No light mode variants currently
