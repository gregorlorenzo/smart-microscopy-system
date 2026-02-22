# MicroScope Share — Local Test Cases

Run `npm run dev` before starting. Open `http://localhost:5173` in your browser.

**Setup tip:** For tests that require two participants, open a second browser window (not just a tab) or use a private/incognito window side-by-side.

---

## 1. Landing Page

| # | Steps | Expected |
|---|-------|----------|
| 1.1 | Open `http://localhost:5173` | Centered card with microscope icon, "MicroScope Share" title, "Create Session" and "Join Session" buttons |
| 1.2 | Click "Create Session" | Dialog opens with: session name input (auto-focused), a 6-character code in a read-only field, a share link field |
| 1.3 | Click "Join Session" | Dialog opens with: name input (auto-focused), session code input |
| 1.4 | Click "Use standalone mode →" link | Navigates to `/standalone` — existing microscope tool with header and nav |
| 1.5 | Navigate directly to `/standalone/library` | Library page loads with header and nav intact |
| 1.6 | Navigate to any unknown URL (e.g. `/xyz`) | Redirected to 404 page |

---

## 2. Create Session Dialog

| # | Steps | Expected |
|---|-------|----------|
| 2.1 | Open Create dialog, click "Create Session" without entering a name | Button remains disabled, nothing happens |
| 2.2 | Open Create dialog, type a session name | "Create Session" button becomes enabled |
| 2.3 | Click the copy icon next to the session code | Code is copied to clipboard (paste somewhere to verify). Icon briefly shows a checkmark |
| 2.4 | Click the copy icon next to the share link | Full URL (e.g. `http://localhost:5173/session/ABC123`) copied. Icon shows checkmark |
| 2.5 | Enter a session name and press **Enter** | Navigates to `/session/[CODE]` lobby |
| 2.6 | Enter a session name and click "Create Session" | Same — navigates to lobby |
| 2.7 | Close dialog, re-open it | A **new** 6-character code is NOT generated (same code persists for this page load) |

---

## 3. Join Session Dialog

| # | Steps | Expected |
|---|-------|----------|
| 3.1 | Open Join dialog, click "Join Session" with both fields empty | Error: "Please enter your name" |
| 3.2 | Enter a name, leave code empty, click "Join Session" | Error: "Session code must be 6 characters" |
| 3.3 | Enter a name, type 3 characters in the code field, click "Join Session" | Error: "Session code must be 6 characters" |
| 3.4 | Type lowercase in the code field | Characters auto-convert to uppercase |
| 3.5 | Enter a name + valid 6-char code, click "Join Session" | Navigates to `/session/[CODE]` lobby |
| 3.6 | Enter a name + valid 6-char code, press **Enter** in the code field | Same — navigates to lobby |

---

## 4. Session Lobby — Presenter

*Create a session first (from the landing page).*

| # | Steps | Expected |
|---|-------|----------|
| 4.1 | Arrive at lobby after creating a session | Session name shown in heading, session code shown below it, "Presenter" badge visible |
| 4.2 | Check participant list | Your entry shows "(You)" label and a ★ star. Avatar shows first 2 initials of "Presenter" |
| 4.3 | Click "Copy Code" | Code copied. Button label briefly shows "Copied!" |
| 4.4 | Click "Share Link" | Full join URL copied. Button label briefly shows "Copied!" |
| 4.5 | Click "Leave" | Navigates back to landing page. If you then navigate back to the lobby URL directly, you are redirected to `/` |
| 4.6 | Click "Specimen Library" | Navigates to `/session/[CODE]/library` |

---

## 5. Session Lobby — Two Participants (requires two browser windows)

*Window A creates a session. Window B joins using the code.*

| # | Steps | Expected |
|---|-------|----------|
| 5.1 | Window A: Create session "Biology Lab" → arrive at lobby | Lobby shows "Biology Lab", 1 participant |
| 5.2 | Window B: Join session with that code (any name, e.g. "Student 1") → arrive at lobby | Window B shows "Biology Lab" as the session name (learned from presenter's presence) |
| 5.3 | Check Window A | "Student 1" appears in the participant list in real time (no refresh needed) |
| 5.4 | Check Window B | "Presenter" appears in the participant list. "Student 1 (You)" is highlighted in blue |
| 5.5 | Window B: Click "Leave" | Window B returns to landing. Window A: "Student 1" disappears from the list |
| 5.6 | Window B: Copy Code / Share Link buttons | These buttons should **not** be visible to viewers |

---

## 6. Session Stream — Presenter

*From the lobby, click "Start Microscope Stream".*

| # | Steps | Expected |
|---|-------|----------|
| 6.1 | Click "Start Microscope Stream" | Browser asks for camera permission. After granting, camera feed fills the dark screen |
| 6.2 | Check top bar | Session name shown, participant count, library icon, red "Live" badge with pulsing dot |
| 6.3 | Select pen tool (pencil icon) from bottom toolbar | Tool highlights white |
| 6.4 | Draw on the camera feed | Strokes appear over the image |
| 6.5 | Change color using the swatches | New strokes use the selected color |
| 6.6 | Change brush size (small/medium/large dots) | Stroke thickness changes |
| 6.7 | Click Undo (↩ icon) | Last stroke is removed |
| 6.8 | Click Clear (trash icon) | All annotations are removed |
| 6.9 | Select text tool (T icon), click on the feed | A text field appears. Type something and click elsewhere |
| 6.10 | Select pointer tool (arrow icon) | Drawing is disabled; you can click and drag existing annotations |
| 6.11 | Click the library icon (top right) | Navigates to in-session library. Back button returns to stream |
| 6.12 | Click "Back" in top bar | Returns to lobby. Camera stops |

---

## 7. Session Stream — Viewer (requires two browser windows)

*Window A = presenter on stream. Window B = viewer on stream.*

| # | Steps | Expected |
|---|-------|----------|
| 7.1 | Window B arrives at stream before Window A starts | Dark screen with "Waiting for presenter to start the stream…" placeholder |
| 7.2 | Window A starts the stream (camera) | Window B: live frames appear within ~1 second. "Live" badge appears on both |
| 7.3 | Window A draws a stroke | Window B sees the stroke appear after the next annotation broadcast (~500ms) |
| 7.4 | Window A changes colors and draws more | Window B sees correct colors |
| 7.5 | Window A clicks Undo | Window B: that stroke disappears |
| 7.6 | Window A clicks Clear | Window B: all annotations disappear |
| 7.7 | Window B tries to draw (click and drag on the stream) | Nothing happens — viewer canvas is read-only |
| 7.8 | Window B participant count in top bar | Shows correct count of connected participants |
| 7.9 | Window A clicks "Back" (leaves stream) | Window B: frames stop updating, "Live" badge disappears |

---

## 8. In-Session Library

*From the lobby or stream page, navigate to Specimen Library.*

| # | Steps | Expected |
|---|-------|----------|
| 8.1 | Arrive at session library | Sticky top bar with "Back", "Specimen Library" title, "Add Specimen" button |
| 8.2 | Existing saved specimens are visible | Same specimens as in standalone library |
| 8.3 | Search for a specimen by name | List filters in real time |
| 8.4 | Click a specimen card | Detail dialog opens with image, name, description, tags |
| 8.5 | Edit name/description in the dialog, save | Changes persist after closing |
| 8.6 | Click "Back" | Returns to session lobby |
| 8.7 | Click "Add Specimen" | Navigates to stream page (to capture a frame from the live feed) |

---

## 9. Standalone Mode (Regression)

*Verify existing functionality is unaffected.*

| # | Steps | Expected |
|---|-------|----------|
| 9.1 | Go to `http://localhost:5173/standalone` | Full existing app — header with "Microscope" and "Library" nav links |
| 9.2 | Start camera, capture a screenshot | Image appears in annotation panel |
| 9.3 | Draw annotations, save specimen | Specimen appears in library |
| 9.4 | Go to `/standalone/library` | Library shows all saved specimens |
| 9.5 | Nav link "Microscope" | Goes to `/standalone` |
| 9.6 | Nav link "Library" | Goes to `/standalone/library` |
| 9.7 | Video recording — start, stop, download | Works as before |

---

## 10. Edge Cases

| # | Steps | Expected |
|---|-------|----------|
| 10.1 | Navigate directly to `/session/ABC123` without going through the landing page | Redirected to `/` (no sessionStorage data) |
| 10.2 | Navigate directly to `/session/ABC123/stream` without sessionStorage | Redirected to `/` |
| 10.3 | Two presenters join the same session code | Both see each other in the participant list. Both can attempt to stream (Supabase allows it — this is an edge case outside scope) |
| 10.4 | Join with a code that has no active presenter | Lobby shows empty participant list with "Connecting to session..." message |
| 10.5 | Refresh the lobby page mid-session | sessionStorage persists — lobby reloads correctly, participant re-joins presence |
| 10.6 | Refresh the stream page mid-session (presenter) | Camera restarts, broadcasting resumes |

---

## Quick Smoke Test (5 minutes)

If you want a fast pass before the full test:

1. `localhost:5173` → Create Session "Test" → note the code
2. Open private window → Join Session → enter name + code
3. Both arrive at lobby — verify each sees the other
4. Presenter → Start Microscope Stream → grant camera
5. Viewer → Join Stream → verify frames appear
6. Presenter draws → verify viewer sees it
7. Go to `localhost:5173/standalone` → verify existing app still works
