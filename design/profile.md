# Profile Page CSS

**File**: `src/pages/UserProfilePage.jsx` / `UserProfilePage.module.css`

## Layout

```css
.page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  background: #111113;
}

.scroll {
  max-width: 860px;
  margin: 0 auto;
  padding: 96px 24px 40px;
  position: relative;
}
```

---

## Profile Header

### Avatar

```css
.avatarWrap {
  position: relative;
  flex-shrink: 0;
  width: 112px;
  height: 112px;
  z-index: 1;
}

.avatarBtn {
  position: relative;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  background: none;
  border: none;
  z-index: 1;
}

.avatarImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatarStatic {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  position: relative;
  z-index: 1;
}

.avatarFallback {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Roboto', sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: var(--dark-muted);
  position: relative;
  z-index: 1;
}

.avatarPlaceholder {
  color: var(--dark-muted);
  width: 32px;
  height: 32px;
}

.avatarEditBadge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 26px;
  height: 26px;
  background: #3a3a3a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dark-text);
  pointer-events: none;
}

.avatarInitial {
  font-family: 'Roboto', sans-serif;
  font-size: 28px;
  font-weight: 600;
  color: var(--dark-muted);
}

.avatarOverlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.avatarSpinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hiddenInput {
  display: none;
}
```

### Profile Info

```css
.profileHeader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  position: relative;
}

.profileInfo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.profileNameRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.profileName {
  font-family: 'Space Mono', monospace;
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
}

.profileNameEmpty {
  font-family: 'Space Mono', monospace;
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  font-style: italic;
}

.displayName {
  font-family: 'Space Mono', monospace;
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  text-align: center;
}

.profileBio {
  font-family: 'Roboto', sans-serif;
  font-size: 16px;
  color: #ffffff;
  line-height: 1.5;
  margin: 0;
  text-align: center;
  max-width: 46ch;
}

.profileBioEmpty {
  font-family: 'Roboto', sans-serif;
  font-size: 16px;
  color: #ffffff;
  line-height: 1.5;
  margin: 0;
  text-align: center;
  font-style: italic;
  max-width: 46ch;
}

.bio {
  font-family: 'Roboto', sans-serif;
  font-size: 16px;
  color: #ffffff;
  text-align: center;
  margin: 4px 0 0;
  line-height: 1.5;
  max-width: 320px;
}

.editIconBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--dark-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.editIconBtn:hover {
  color: var(--dark-text);
  background: var(--dark-surface);
}

.editProfileBtn {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(0, 0, 0, 0.5) !important;
}
```

---

## Edit Profile Dialog

```css
.dialogBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 2000;
}

.dialogContent {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  max-width: calc(100vw - 32px);
  background: rgba(0, 0, 0, 0.85);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
  z-index: 2001;
  outline: none;
}

.dialogTitle {
  font-size: 20px;
  font-weight: 500;
  color: rgba(255,255,255,0.7);
  font-family: 'Roboto', sans-serif;
  padding: 20px 20px 16px;
}

.editForm {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 20px;
}

.dialogAvatarRow {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.editNameInput {
  background: var(--dark-surface);
  border: 1px solid var(--dark-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 16px;
  font-weight: 700;
  font-family: 'Roboto', sans-serif;
  color: var(--dark-text);
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.editNameInput:focus {
  border-color: var(--accent);
}

.editBioInput {
  background: var(--dark-surface);
  border: 1px solid var(--dark-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  font-family: 'Roboto', sans-serif;
  color: var(--dark-text);
  outline: none;
  width: 100%;
  box-sizing: border-box;
  resize: none;
  line-height: 1.5;
  transition: border-color 0.15s;
}

.editBioInput:focus {
  border-color: var(--accent);
}

.dialogFooter {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px 20px;
}

.cancelBtn {
  background: none;
  border: none;
  font-size: 14px;
  font-family: inherit;
  color: var(--dark-muted);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}

.cancelBtn:hover {
  color: var(--dark-text);
  background: rgba(255,255,255,0.06);
}

.saveBtn {
  background: var(--accent);
  border: none;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  cursor: pointer;
  padding: 6px 16px;
  border-radius: 8px;
  transition: opacity 0.15s;
}

.saveBtn:disabled {
  opacity: 0.5;
  cursor: default;
}

.saveBtn:not(:disabled):hover {
  opacity: 0.88;
}
```

---

## Favorites Section

```css
.favoritesLabel {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dark-muted);
  margin-bottom: 10px;
}

.favoritesGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 32px;
  position: relative;
  z-index: 1;
}

.favoriteSlot {
  aspect-ratio: 3 / 4;
  background: var(--dark-surface);
  border: 1px dashed var(--dark-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
}

.favoriteSlot:hover {
  border-color: var(--dark-muted);
}

.favoriteSlotFilled {
  border: none;
  flex-direction: column;
  align-items: stretch;
}

.favoriteImg {
  flex: 1;
  width: 100%;
  object-fit: cover;
  display: block;
  min-height: 0;
}

.favoriteMeta {
  flex-shrink: 0;
  background: var(--dark-surface);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.favoriteSpecies {
  font-family: 'Roboto', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.favoriteDatetime {
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  color: #8d8d8d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.favoriteLocation {
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  color: #8d8d8d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.favoriteHint {
  font-size: 22px;
  color: var(--dark-border);
  line-height: 1;
  transition: color 0.15s;
}

.favoriteSlot:hover .favoriteHint {
  color: var(--dark-muted);
}
```

---

## Stats Section

```css
.header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 24px;
}

.title {
  font-family: 'Roboto', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--dark-text);
}

.total {
  font-size: 13px;
  color: var(--dark-muted);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.card {
  background: var(--dark-surface);
  border: 1px solid var(--dark-border);
  border-radius: 16px;
  padding: 20px 20px 8px;
}

.cardLabel {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dark-muted);
  margin-bottom: 8px;
}

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.footer {
  margin-top: 32px;
}
```

---

## States

```css
.loading {
  padding: 60px;
  font-size: 14px;
  color: var(--dark-muted);
  font-family: 'Roboto', sans-serif;
}

.errorState {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 24px;
  font-family: 'Roboto', sans-serif;
  color: var(--dark-muted);
  font-size: 14px;
}

.backBtn {
  background: var(--dark-surface);
  border: 1px solid var(--dark-border);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-family: inherit;
  color: var(--dark-text);
  cursor: pointer;
}

.backBtn:hover {
  background: var(--dark-border);
}
```
