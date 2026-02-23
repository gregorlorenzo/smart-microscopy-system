# Mobile UI Design — Smart Microscopy System

**Date:** 2026-02-23
**Scope:** Full mobile responsiveness for both Session and Standalone modes
**Approach:** CSS Scale-to-Fit Canvas + Responsive Wrappers (Approach A)

---

## Problem Summary

The app has two primary flows, both requiring mobile support:

- **Session mode** — viewers join live streams from phones; presenters annotate in real-time
- **Standalone mode** — microscope operators capture and annotate specimens

### Critical Issues Found

1. `SessionStreamPage.tsx` hardcodes `style={{ width: 800, height: 600 }}` on every video, image, and annotation overlay element — causes horizontal overflow on any screen narrower than 800px.
2. `AnnotationCanvas.tsx` uses `window.innerWidth - 64` for scale calculation — imprecise; doesn't account for card padding or actual container width.
3. `CaptureControls.tsx` — `flex gap-2` with no wrap; 3 buttons overflow on screens < ~430px.
4. `SessionAnnotationToolbar.tsx` — color swatches `w-6 h-6` (24px) are below minimum touch target; all toolbar items in one flex-wrap row wrap into 3–4 rows on mobile, eating excessive vertical space.
5. `DrawingToolbar.tsx` — same touch target issues.
6. `MicroscopeView.tsx` — `min-h-[600px]` on the "no screenshot" placeholder creates a huge blank area on mobile.
7. `SpecimenGrid.tsx` — pagination with individual page buttons too cramped on small screens.
8. `SessionLibraryPage.tsx` — `p-6` padding slightly excessive on mobile.

### Already Responsive (No Changes Needed)
- `Header.tsx`, `Navigation.tsx` — already use responsive classes
- `SessionLandingPage.tsx`, `SessionLobbyPage.tsx` — centered cards, already work on mobile
- `SpecimenDetailDialog.tsx` — `grid-cols-1 md:grid-cols-2` already stacks on mobile
- Session stream **setup screen** — already uses `width: 100%; aspectRatio: 4/3`

---

## Solution Design

### Section 1: Canvas Scale-to-Fit System

**New file:** `src/components/ui/scaled-canvas-wrapper.tsx`

A reusable wrapper that scales fixed-size canvas content to fit its container using CSS transforms.

**Behaviour:**
- Outer div: `w-full`, `aspect-ratio: 4/3` — always occupies `containerWidth × containerWidth×0.75` space
- `ResizeObserver` on outer div reads its `clientWidth`
- Computes `scale = Math.min(1, outerWidth / 800)` — never upscales
- Inner div: exactly `800×600`, `transform: scale(scale)`, `transformOrigin: top left`

**Why no ResizeObserver loop:**
Scale changes only the inner div's CSS `transform`, which is off-flow and does not affect the outer div's width. The outer div's height is governed purely by `aspect-ratio: 4/3` in CSS — never written by JS. No feedback loop possible.

**Why pointer events still work:**
Fabric.js v7 computes pointer position as `(clientX - boundingRect.left) / (boundingRect.width / canvasWidth)`. When the canvas element is CSS-scaled, `boundingRect.width` shrinks proportionally, so the ratio auto-corrects. `e.scenePoint` remains accurate for drawing.

**SessionStreamPage refactor:**
Current structure uses an absolutely-positioned annotation overlay centered over a sibling video element. Replace with a single stacked layout inside `ScaledCanvasWrapper`:

```
<ScaledCanvasWrapper>
  <div style={{ position: 'relative', width: 800, height: 600 }}>
    <video />  |  <img />  |  <WaitingPlaceholder />
    <div style={{ position: 'absolute', inset: 0 }} pointerEvents={isPresenter ? 'auto' : 'none'}>
      <div ref={containerRef} />   {/* annotation canvas */}
    </div>
  </div>
</ScaledCanvasWrapper>
```

**AnnotationCanvas fix:**
Replace `window.innerWidth - 64` with a `ResizeObserver` on a wrapping `ref` div — same safe pattern, measures actual container width.

---

### Section 2: Toolbars & Touch Targets

**SessionAnnotationToolbar — horizontally scrollable:**
Wrapping to multiple rows on a phone screen consumes 40%+ of the viewing area. Instead, make the toolbar a single horizontally-scrollable row:

```tsx
<div className="overflow-x-auto scrollbar-hide">
  <div className="flex items-center gap-1 px-4 py-2 min-w-max bg-gray-900/95 ...">
    {/* all items */}
  </div>
</div>
```

Touch target sizes:
- Tool/action buttons: `w-9 h-9` → `w-11 h-11 sm:w-9 sm:h-9` (44px on mobile)
- Color swatches: `w-6 h-6` → `w-8 h-8 sm:w-6 sm:h-6` (32px on mobile — acceptable for grouped palette)

**DrawingToolbar (standalone):**
Already has `flex-wrap` — items flow to a second row with room. Apply same touch target increases. No scrolling needed.

**CaptureControls:**
`flex gap-2` → `flex flex-wrap gap-2`. Buttons have sufficient height from shadcn defaults.

---

### Section 3: Layout & Spacing

**MicroscopeView placeholder:**
`min-h-[600px]` on the "No Screenshot Captured" dashed panel → `aspect-[4/3]`. The placeholder will be proportional to the canvas that replaces it.

**SpecimenGrid pagination:**
Hide individual page number buttons on mobile, show "Page X of Y" text instead:

```tsx
{/* page numbers: desktop only */}
<div className="hidden sm:flex items-center gap-1">...</div>

{/* mobile: simple text */}
<span className="sm:hidden text-sm text-gray-600">
  Page {currentPage} of {totalPages}
</span>
```

**SessionLibraryPage:**
Content padding `p-6` → `p-4 sm:p-6`.

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `src/components/ui/scaled-canvas-wrapper.tsx` | New | Reusable CSS scale-to-fit wrapper component |
| `src/pages/SessionStreamPage.tsx` | Modify | Wrap video/img/canvas in ScaledCanvasWrapper; refactor overlay stacking |
| `src/components/annotations/AnnotationCanvas.tsx` | Modify | Use ResizeObserver on containerRef instead of window.innerWidth |
| `src/components/session/SessionAnnotationToolbar.tsx` | Modify | Horizontal scroll wrapper; larger touch targets |
| `src/components/annotations/DrawingToolbar.tsx` | Modify | Larger touch targets on swatches and mode buttons |
| `src/components/capture/CaptureControls.tsx` | Modify | Add flex-wrap |
| `src/pages/MicroscopeView.tsx` | Modify | Replace min-h-[600px] with aspect-[4/3] on placeholder |
| `src/components/library/SpecimenGrid.tsx` | Modify | Simplified mobile pagination |
| `src/pages/SessionLibraryPage.tsx` | Modify | p-6 → p-4 sm:p-6 |

---

## Non-Goals

- Dark mode
- Pinch-to-zoom on the canvas
- Navigation redesign (already works)
- Any change to canvas coordinate system or broadcast logic
