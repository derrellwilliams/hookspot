# Authentication Pages CSS

## Login Page (`LoginPage.module.css`)

### Layout Classes

```css
.page {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
```

### Background

```css
.bgMesh {
  position: absolute;
  inset: 0;
}

.meshNoise {
  width: 100%;
  height: 100%;
  background-color: #1A1953;  /* Dark purple gradient base */
}

.meshOverlay {
  position: absolute;
  inset: 0;
  background-image: url(/noise.svg);
  opacity: 0.28;
  pointer-events: none;
}
```

### Content

```css
.wordmark {
  font-family: 'Space Mono', monospace;
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
}

.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.card {
  background: var(--dark-surface);
  border: 1px solid var(--dark-border);
  border-radius: 16px;
  padding: 32px 28px;
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
```

### Form Elements

```css
.label {
  font-size: 11px;
  font-weight: 500;
  color: var(--dark-muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 4px;
  border: none;
  background: #3a3a3a;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition: background 0.15s;
}

.input:focus {
  background: #444444;
}

.input::placeholder {
  color: #888888;
}

.button {
  width: 100%;
  padding: 12px;
  border-radius: 4px;
  border: none;
  background: var(--accent);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.button:disabled {
  opacity: 0.6;
  cursor: default;
}

.button:not(:disabled):hover {
  opacity: 0.88;
}

.error {
  font-size: 13px;
  color: #f87171;
}

.sent {
  font-family: 'Roboto', sans-serif;
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}

.resend {
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  color: var(--dark-muted);
  cursor: pointer;
  text-align: center;
}

.resend:hover {
  color: rgba(255, 255, 255, 0.6);
}
```

---

## Onboarding Page (`OnboardingPage.module.css`)

### Layout

```css
.page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 24px;
  gap: 24px;
}

.bgMesh {
  position: absolute;
  inset: 0;
}

.meshNoise {
  width: 100%;
  height: 100%;
  background-color: #1A1953;
}

.meshOverlay {
  position: absolute;
  inset: 0;
  background-image: url(/noise.svg);
  opacity: 0.28;
  pointer-events: none;
}

.wordmark {
  font-family: 'Space Mono', monospace;
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  position: relative;
  z-index: 1;
}

.card {
  background: var(--dark-surface);
  border: 1px solid var(--dark-border);
  border-radius: 16px;
  padding: 32px 28px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
  z-index: 1;
}

.title {
  font-size: 20px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Roboto', sans-serif;
  margin: 0;
}
```

### Avatar Upload

```css
.avatarField {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.avatarRow {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatarWrap {
  position: relative;
  width: 80px;
  height: 80px;
}

.avatarBtn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  background: var(--ui-bg);
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatarImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatarPlaceholder {
  color: var(--dark-muted);
}

.avatarEditBadge {
  position: absolute;
  bottom: 0;
  right: 0;
}

.label {
  font-size: 11px;
  font-weight: 500;
  color: var(--dark-muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.required {
  color: var(--accent);
}
```

### Form Fields

```css
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input {
  background: var(--ui-bg);
  border: 1px solid var(--dark-border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 15px;
  font-family: 'Roboto', sans-serif;
  color: var(--dark-text);
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: var(--accent);
}

.inputError {
  border-color: #f87171 !important;
}

.inputOk {
  border-color: #4ade80 !important;
}

.textarea {
  background: var(--ui-bg);
  border: 1px solid var(--dark-border);
  border-radius: 8px;
  padding: 10px 12px;
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

.textarea:focus {
  border-color: var(--accent);
}

.fieldError {
  font-size: 12px;
  color: #f87171;
}

.fieldHint {
  font-size: 12px;
  color: var(--dark-muted);
}

.fieldOk {
  font-size: 12px;
  color: #4ade80;
}

.saveError {
  font-size: 13px;
  color: #f87171;
}

.saveBtn {
  background: var(--accent);
  border: none;
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  cursor: pointer;
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

## Shared Auth Patterns

- Both pages use mesh background (dark purple #1A1953 + noise overlay)
- Form cards are max 400px width, centered
- All inputs use `--dark-*` tokens from global style.css
- Validation feedback colors: red #f87171 (error), green #4ade80 (success)
- Typography: Space Mono (branding), Roboto (body)
