# Frontend Design System — Tokens + Responsive Layout

**Date:** 2026-08-10
**Status:** In progress
**Scope:** Frontend (Next 15) design tokens, responsive layout shell, safe-area support.
**Previous spec:** `docs/superpowers/specs/2026-07-10-frontend-revamp-session-persistence-design.md` (completed rebuild with light theme, avatars, session persistence).

## Goals

1. Konsistensi visual di browser (desktop) dan mobile (iOS/Android).
2. Design tokens untuk warna, radius, shadow, spacing — satu sumber kebenaran.
3. Responsive shell: mobile tetap `max-w-md`, desktop `max-w-2xl` centered.
4. Safe-area padding untuk device dengan notch/home indicator.
5. Minimal perubahan UX flow — hanya struktur layout + tokens.

## Non-Goals

- Mengubah warna palette utama (tetap sky-amber).
- Menambah fitur baru (chat, session management, dll).
- Mengganti avatar system atau Migu character.
- PWA atau installable app.
- Animasi baru yang signifikan.

## Design Tokens

### Warna

| Token | Value | Usage |
|---|---|---|
| `--color-surface` | `#ffffff` | Card backgrounds, panels |
| `--color-surface-raised` | `#f8fafc` | Elevated cards, headers |
| `--color-bg-sky` | `#e0f2fe` | Gradient start |
| `--color-bg-amber` | `#fef3c7` | Gradient end |
| `--color-border` | `#e2e8f0` | Default borders |
| `--color-border-strong` | `#cbd5e1` | Strong borders (hover/focus) |
| `--color-text` | `#0f172a` | Primary text |
| `--color-text-muted` | `#64748b` | Secondary text |
| `--color-accent` | `#f59e0b` | Primary action (amber) |
| `--color-accent-hover` | `#d97706` | Accent hover state |
| `--color-danger` | `#ef4444` | Error/danger |
| `--color-success` | `#22c55e` | Success/complete |
| `--color-blue` | `#3b82f6` | Blue accents (chat bubbles) |

### Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `0.5rem` | Small inputs, badges |
| `--radius-md` | `0.75rem` | Cards, panels |
| `--radius-lg` | `1rem` | Large cards, modals |
| `--radius-full` | `9999px` | Buttons, avatars |

### Shadow

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | Cards |
| `--shadow-lg` | `0 10px 25px rgba(0,0,0,0.1)` | Modals, drawers |
| `--shadow-glow` | `0 0 0 4px rgba(37,99,235,0.15)` | Selected/focus ring |

### Spacing & Typography

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | `0.25rem` | Tight spacing |
| `--space-sm` | `0.5rem` | Small gaps |
| `--space-md` | `1rem` | Standard padding |
| `--space-lg` | `1.5rem` | Large gaps |
| `--space-xl` | `2rem` | Section spacing |
| `--font-sans` | `'Inter', system-ui, -apple-system, sans-serif` | Body font |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | Code/debug |

### Safe Area

| Token | Value | Usage |
|---|---|---|
| `--safe-area-top` | `env(safe-area-inset-top, 0px)` | Top padding |
| `--safe-area-bottom` | `env(safe-area-inset-bottom, 0px)` | Bottom padding |
| `--safe-area-left` | `env(safe-area-inset-left, 0px)` | Left padding |
| `--safe-area-right` | `env(safe-area-inset-bottom, 0px)` | Right padding |

## Responsive Breakpoints

| Breakpoint | Max-width | Layout |
|---|---|---|
| `sm` | 640px | Mobile, full-width with padding |
| `md` | 768px | Tablet, centered shell |
| `lg` | 1024px | Desktop, wider shell |
| `xl` | 1280px | Large desktop, same shell |

### Shell Behavior

- **Mobile (< 640px):** `max-w-md mx-auto px-4 pb-safe`
- **Desktop (≥ 640px):** `max-w-2xl mx-auto px-6 pb-safe`

## Component Changes

### MiguPage.tsx
- Container: `max-w-2xl` di desktop, `max-w-md` di mobile
- Add `pb-safe` class untuk bottom padding
- RoomBackground: reduced opacity di desktop (optional)
- Mic button: fixed bottom dengan safe-area offset

### ScenarioPicker.tsx
- Grid: `grid-cols-2` mobile, `md:grid-cols-3` tablet, `lg:grid-cols-4` desktop
- Card: responsive padding

### SpeakerPicker.tsx
- Full width container (`w-full`)
- Select: responsive width

### RoomBackground.tsx
- Keep as-is, tapi mungkin perlu reduced opacity di desktop untuk readability

## Files Modified

**New:**
- `frontend/app/globals.css` — extended with tokens (currently has basic tokens)

**Modify:**
- `frontend/app/components/MiguPage.tsx` — responsive shell, safe-area
- `frontend/app/components/ScenarioPicker.tsx` — responsive grid
- `frontend/app/components/SpeakerPicker.tsx` — responsive width
- `frontend/app/layout.tsx` — minimal if needed

**Do NOT modify:**
- Avatar system (`Avatar.tsx`, `avatars/*`)
- Migu character (`TalkingMigu.tsx`)
- Session hooks (`useSession.ts`, etc.)
- Business logic

## Testing

1. `npm run build` — clean compile
2. Browser DevTools responsive mode:
   - iPhone SE (375px): verify layout
   - iPhone 14 Pro (390px): verify layout
   - iPad (768px): verify layout
   - Desktop (1280px): verify centered shell
3. iOS Safari: verify safe-area (notch devices)
4. Visual check: colors match tokens, shadows consistent

## Verification Steps

1. Mobile (< 640px): app full-width with `px-4`, mic button fixed bottom
2. Desktop (≥ 640px): app centered with `max-w-2xl`, more breathing room
3. Safe-area: on notched devices, content doesn't hide behind home indicator
4. All existing functionality preserved (mic, chat, TTS, session)
5. No visual regressions in avatar, Migu character, or animations
