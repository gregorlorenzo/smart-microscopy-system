# Mobile UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every page and component fully mobile-friendly by scaling the fixed 800×600 canvas via CSS transforms and applying responsive fixes to toolbars, controls, and layout.

**Architecture:** A new `ScaledCanvasWrapper` component wraps all fixed-size canvas content and scales it to fit its container using `transform: scale()` — no changes to canvas coordinate logic. All other fixes are Tailwind responsive class changes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3.4, Fabric.js v7, Vite 5

**Design doc:** `docs/plans/2026-02-23-mobile-ui-design.md`

---

## Task 1: Add scrollbar-hide utility to global CSS

**Files:**
- Modify: `src/index.css`

The session annotation toolbar will be horizontally scrollable. We need to hide the scrollbar visually on all browsers without removing scroll functionality.

**Step 1: Add the utility class**

In `src/index.css`, add after the existing `@layer base` block:

```css
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

**Step 2: Verify build compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add scrollbar-hide utility class"
```

---

## Task 2: Create ScaledCanvasWrapper component

**Files:**
- Create: `src/components/ui/scaled-canvas-wrapper.tsx`

This component wraps any fixed-size content (default 800×600) and scales it down to fit its container using CSS `transform: scale()`. The outer div uses `aspect-ratio` CSS so its height always matches the scaled content — no JS writes to height, so no ResizeObserver loop.

**Step 1: Create the file**

```tsx
// src/components/ui/scaled-canvas-wrapper.tsx
import { useEffect, useRef, useState } from 'react';

interface ScaledCanvasWrapperProps {
  baseWidth?: number;
  baseHeight?: number;
  children: React.ReactNode;
}

export default function ScaledCanvasWrapper({
  baseWidth = 800,
  baseHeight = 600,
  children,
}: ScaledCanvasWrapperProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      setScale(Math.min(1, el.clientWidth / baseWidth));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseWidth]);

  return (
    <div
      ref={outerRef}
      className="w-full overflow-hidden"
      style={{ aspectRatio: `${baseWidth} / ${baseHeight}` }}
    >
      <div
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/ui/scaled-canvas-wrapper.tsx
git commit -m "feat(ui): add ScaledCanvasWrapper for responsive canvas display"
```

---

## Task 3: Fix AnnotationCanvas scale calculation

**Files:**
- Modify: `src/components/annotations/AnnotationCanvas.tsx`

The current scale logic uses `window.innerWidth - 64` which is imprecise (doesn't account for card padding). Replace with a `ResizeObserver` on a wrapper `ref` that measures the actual container.

**Step 1: Replace the scale logic**

Find and replace the `outerRef` + scale `useEffect` block (lines 19–36) with:

```tsx
const wrapperRef = useRef<HTMLDivElement>(null);
const [scale, setScale] = useState(1);

useEffect(() => {
  const el = wrapperRef.current;
  if (!el) return;

  const update = () => {
    setScale(Math.min(1, el.clientWidth / canvasSize.width));
  };

  update();
  const ro = new ResizeObserver(update);
  ro.observe(el);
  return () => ro.disconnect();
}, [canvasSize.width]);
```

**Step 2: Replace the JSX canvas container**

Find the canvas container JSX (the `<div className="flex justify-center w-full overflow-x-hidden">` block, lines 103–130) and replace it with:

```tsx
{/* Canvas Container */}
<div
  ref={wrapperRef}
  className="w-full overflow-hidden"
  style={{ aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}
>
  <div
    style={{
      width: canvasSize.width,
      height: canvasSize.height,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    }}
  >
    <div
      className="relative border-2 border-gray-300 rounded-lg bg-gray-100 overflow-hidden shadow-md"
      style={{ width: canvasSize.width, height: canvasSize.height }}
    >
      <div ref={containerRef} />
    </div>
  </div>
</div>
```

Note: `outerRef` is no longer used — remove its declaration at line 19 (`const outerRef = useRef<HTMLDivElement>(null);`).

**Step 3: Verify build**

```bash
npm run build
```

Expected: no errors.

**Step 4: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:5173/standalone` in a browser. Resize the window to < 800px wide. The annotation canvas (after capturing a screenshot) should scale down without horizontal scrollbars.

**Step 5: Commit**

```bash
git add src/components/annotations/AnnotationCanvas.tsx
git commit -m "fix(canvas): use ResizeObserver on container ref instead of window.innerWidth"
```

---

## Task 4: Refactor SessionStreamPage — wrap canvas and feeds in ScaledCanvasWrapper

**Files:**
- Modify: `src/pages/SessionStreamPage.tsx`

This is the most impactful change. The live stream view hardcodes `style={{ width: 800, height: 600 }}` on video/image/annotation elements and positions the annotation overlay with `left: 50%; transform: translate(-50%, -50%)`. Replace with a single stacked 800×600 block inside `ScaledCanvasWrapper`.

**Step 1: Add import at the top of the file**

After the existing imports, add:

```tsx
import ScaledCanvasWrapper from '@/components/ui/scaled-canvas-wrapper';
```

**Step 2: Replace the main content area**

Find the `{/* ── Main content ─── */}` div (around line 449). Replace the entire block from `<div className="flex-1 flex items-center justify-center relative overflow-hidden">` through its closing `</div>` (ending just before `{/* Viewer capture bar */}`) with:

```tsx
{/* ── Main content ─────────────────────────────────────────────────────── */}
<div className="flex-1 overflow-hidden flex items-center justify-center p-2 sm:p-0">
  <div className="w-full" style={{ maxWidth: CANVAS_W }}>
    <ScaledCanvasWrapper>
      <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H, background: '#111827' }}>

        {/* Presenter: webcam feed */}
        {isPresenter && cameraSource !== 'esp32' && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: CANVAS_W, height: CANVAS_H, objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Presenter: ESP32-CAM feed */}
        {isPresenter && cameraSource === 'esp32' && currentEspFrame && (
          <img
            src={currentEspFrame}
            alt="ESP32-CAM feed"
            style={{ width: CANVAS_W, height: CANVAS_H, objectFit: 'cover' }}
          />
        )}

        {/* Viewer: received frame */}
        {!isPresenter && isPresenterStreaming && currentFrame && (
          <img
            src={currentFrame}
            alt="Live microscope feed"
            style={{ width: CANVAS_W, height: CANVAS_H }}
          />
        )}

        {/* Viewer: waiting placeholder */}
        {!isPresenter && (!isPresenterStreaming || !currentFrame) && (
          <div
            className="absolute inset-0 flex items-center justify-center text-center text-gray-600"
          >
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm">Waiting for presenter to start the stream…</p>
            </div>
          </div>
        )}

        {/* Annotation canvas overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: isPresenter ? 'auto' : 'none',
          }}
        >
          <div ref={containerRef} />
        </div>

      </div>
    </ScaledCanvasWrapper>
  </div>
</div>
```

**Step 3: Verify build**

```bash
npm run build
```

Expected: no errors.

**Step 4: Manual smoke test — viewer on mobile**

```bash
npm run dev
```

Open the stream page on a phone (or browser DevTools mobile emulation, e.g. iPhone 12 at 390px). The video/annotation area should fill the screen width and maintain 4:3 ratio — no horizontal scrollbar.

Test the annotation toolbar is still accessible below the canvas (it should scroll into view naturally since the canvas no longer overflows).

**Step 5: Commit**

```bash
git add src/pages/SessionStreamPage.tsx
git commit -m "fix(session): wrap stream canvas in ScaledCanvasWrapper for mobile"
```

---

## Task 5: Fix SessionAnnotationToolbar — horizontal scroll + touch targets

**Files:**
- Modify: `src/components/session/SessionAnnotationToolbar.tsx`

Two changes: (1) wrap in a horizontal-scroll container so the toolbar stays one row on mobile without wrapping into multiple rows; (2) increase touch target sizes for mobile.

**Step 1: Update the `btn` helper**

Find the `btn` function (lines 47–54) and replace it:

```tsx
const btn = (active: boolean, disabled = false) =>
  `w-11 h-11 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors ${
    disabled
      ? 'text-gray-600 cursor-not-allowed'
      : active
      ? 'bg-white text-gray-900'
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
  }`;
```

**Step 2: Update color swatches**

Find the color swatch buttons (inside the `COLORS.map`). Change `w-6 h-6` to `w-8 h-8 sm:w-6 sm:h-6`:

```tsx
{COLORS.map((color) => (
  <button
    key={color}
    onClick={() => onColorChange(color)}
    className={`w-8 h-8 sm:w-6 sm:h-6 rounded-full border-2 transition-transform hover:scale-110 ${
      brushColor === color ? 'border-white scale-110' : 'border-gray-600'
    }`}
    style={{ backgroundColor: color }}
    title={color}
  />
))}
```

**Step 3: Wrap toolbar in scroll container**

Replace the outer `<div className="flex items-center justify-center gap-1 px-4 py-3 bg-gray-900/95 backdrop-blur border-t border-gray-800 flex-wrap">` with a two-div structure:

```tsx
<div className="bg-gray-900/95 backdrop-blur border-t border-gray-800">
  <div className="overflow-x-auto scrollbar-hide">
    <div className="flex items-center gap-1 px-4 py-2 min-w-max">
      {/* all existing toolbar content stays here, unchanged */}
    </div>
  </div>
</div>
```

The inner `min-w-max` prevents the items from wrapping; the outer `overflow-x-auto` makes it scrollable. `scrollbar-hide` (added in Task 1) hides the scrollbar visually.

**Step 4: Verify build**

```bash
npm run build
```

Expected: no errors.

**Step 5: Manual smoke test**

Open the session stream page in DevTools at 375px width. The bottom toolbar should be a single scrollable row, not wrapping into multiple rows. Swipe left on the toolbar to reveal more tools.

**Step 6: Commit**

```bash
git add src/components/session/SessionAnnotationToolbar.tsx
git commit -m "fix(toolbar): horizontal scroll + larger touch targets for mobile"
```

---

## Task 6: Fix DrawingToolbar touch targets

**Files:**
- Modify: `src/components/annotations/DrawingToolbar.tsx`

Color swatches are `w-8 h-8` (32px). Increase to `w-10 h-10 sm:w-8 sm:h-8` (40px on mobile) for better fingertip accuracy.

**Step 1: Update color swatches**

Find the color buttons inside `COLORS.map` (lines 63–72). Change `w-8 h-8` to `w-10 h-10 sm:w-8 sm:h-8`:

```tsx
{COLORS.map((color) => (
  <button
    key={color}
    onClick={() => onColorChange(color)}
    className={`w-10 h-10 sm:w-8 sm:h-8 rounded border-2 ${
      brushColor === color ? 'border-blue-500' : 'border-gray-300'
    }`}
    style={{ backgroundColor: color }}
    title={color}
  />
))}
```

**Step 2: Verify build and commit**

```bash
npm run build
git add src/components/annotations/DrawingToolbar.tsx
git commit -m "fix(toolbar): increase color swatch touch targets for mobile"
```

---

## Task 7: Fix CaptureControls — wrap buttons on small screens

**Files:**
- Modify: `src/components/capture/CaptureControls.tsx`

The three buttons ("Capture Screenshot", "Save to Library", "Download") are in `flex gap-2` with no wrap. On screens narrower than ~430px they overflow. One-line fix.

**Step 1: Add flex-wrap**

Find line 42:
```tsx
<div className="flex gap-2">
```

Change to:
```tsx
<div className="flex flex-wrap gap-2">
```

**Step 2: Verify build and commit**

```bash
npm run build
git add src/components/capture/CaptureControls.tsx
git commit -m "fix(controls): add flex-wrap to capture buttons for small screens"
```

---

## Task 8: Fix MicroscopeView placeholder height

**Files:**
- Modify: `src/pages/MicroscopeView.tsx`

The "No Screenshot Captured" placeholder has `min-h-[600px]` which creates a huge blank area on mobile. Replace with `aspect-[4/3]` so it always matches the canvas it will become.

**Step 1: Update the placeholder panel**

Find the placeholder div (around line 276). It currently reads:

```tsx
<div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-6">
  <div className="flex items-center justify-center h-full min-h-[600px]">
```

Change to:

```tsx
<div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-6 aspect-[4/3]">
  <div className="flex items-center justify-center h-full">
```

**Step 2: Verify build and commit**

```bash
npm run build
git add src/pages/MicroscopeView.tsx
git commit -m "fix(microscope): replace min-h-[600px] placeholder with aspect-[4/3]"
```

---

## Task 9: Fix SpecimenGrid pagination for mobile

**Files:**
- Modify: `src/components/library/SpecimenGrid.tsx`

The pagination row shows Previous button + individual page number buttons + Next button. On mobile (< 640px), page number buttons overflow. Hide them on mobile and show "X / Y" text instead.

**Step 1: Replace the pagination inner layout**

Find the pagination section (inside the `{totalPages > 1 && (` block). Replace the inner content div:

```tsx
{/* Before — single row with page numbers */}
<div className="flex items-center justify-between">
  <p className="text-sm text-gray-600">
    Showing {startIndex + 1}-{Math.min(endIndex, specimens.length)} of {specimens.length}
  </p>
  <div className="flex items-center gap-2">
    <Button ...>Previous</Button>
    <div className="flex items-center gap-1">{/* page numbers */}</div>
    <Button ...>Next</Button>
  </div>
</div>
```

Replace with:

```tsx
<div className="flex items-center justify-between gap-2">
  {/* Count label: desktop only */}
  <p className="text-sm text-gray-600 hidden sm:block">
    Showing {startIndex + 1}–{Math.min(endIndex, specimens.length)} of {specimens.length}
  </p>

  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
    <Button
      variant="outline"
      size="sm"
      onClick={() => goToPage(currentPage - 1)}
      disabled={currentPage === 1}
    >
      <ChevronLeft className="w-4 h-4" />
      <span className="hidden sm:inline ml-1">Previous</span>
    </Button>

    {/* Page numbers: desktop only */}
    <div className="hidden sm:flex items-center gap-1">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
        const showPage =
          page === 1 ||
          page === totalPages ||
          (page >= currentPage - 1 && page <= currentPage + 1);

        const showEllipsis =
          (page === 2 && currentPage > 3) ||
          (page === totalPages - 1 && currentPage < totalPages - 2);

        if (showEllipsis) {
          return <span key={page} className="px-2 text-gray-400">...</span>;
        }
        if (!showPage) return null;

        return (
          <Button
            key={page}
            variant={currentPage === page ? 'default' : 'outline'}
            size="sm"
            onClick={() => goToPage(page)}
            className="min-w-[40px]"
          >
            {page}
          </Button>
        );
      })}
    </div>

    {/* Page indicator: mobile only */}
    <span className="sm:hidden text-sm font-medium text-gray-600">
      {currentPage} / {totalPages}
    </span>

    <Button
      variant="outline"
      size="sm"
      onClick={() => goToPage(currentPage + 1)}
      disabled={currentPage === totalPages}
    >
      <span className="hidden sm:inline mr-1">Next</span>
      <ChevronRight className="w-4 h-4" />
    </Button>
  </div>
</div>
```

**Step 2: Verify build and commit**

```bash
npm run build
git add src/components/library/SpecimenGrid.tsx
git commit -m "fix(library): simplify pagination UI for mobile screens"
```

---

## Task 10: Fix SessionLibraryPage content padding

**Files:**
- Modify: `src/pages/SessionLibraryPage.tsx`

`p-6` on the content container is 24px all around on every screen size. Reduce to 16px on mobile.

**Step 1: Update padding**

Find line 51:
```tsx
<div className="max-w-5xl mx-auto p-6 space-y-4">
```

Change to:
```tsx
<div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
```

**Step 2: Verify build and commit**

```bash
npm run build
git add src/pages/SessionLibraryPage.tsx
git commit -m "fix(library): reduce content padding on mobile"
```

---

## Task 11: Final cross-device verification

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Open DevTools → Device Toolbar (Cmd+Shift+M / Ctrl+Shift+M)**

Test each route at **iPhone SE (375px)** and **iPad (768px)** viewport widths:

| Route | What to check |
|-------|--------------|
| `/` (Landing) | Card fits, dialogs fit, no overflow |
| `/session/:code` (Lobby) | Card fits, participant list readable |
| `/session/:code/stream` (Setup) | Camera preview fills width, Go Live button full-width |
| `/session/:code/stream` (Live - presenter) | Canvas scales to fit, annotation toolbar scrollable, no horizontal overflow |
| `/session/:code/stream` (Live - viewer) | Canvas scales to fit, capture bar visible |
| `/session/:code/library` | Search row fits, specimen grid 1-col on phone, pagination simplified |
| `/standalone` | Camera feed full-width, capture buttons wrap, annotation canvas scales |
| `/standalone/library` | Same as session library |

**Step 3: Check for horizontal scrollbars**

At 375px width, no page should have a horizontal scrollbar or allow horizontal scroll on the `<body>`.

**Step 4: Final commit if no issues found**

```bash
git add -A
git commit -m "test: confirm mobile layout across all routes"
```

---

## Summary

| Task | File | Type |
|------|------|------|
| 1 | `src/index.css` | Add `.scrollbar-hide` utility |
| 2 | `src/components/ui/scaled-canvas-wrapper.tsx` | New component |
| 3 | `src/components/annotations/AnnotationCanvas.tsx` | Fix scale measurement |
| 4 | `src/pages/SessionStreamPage.tsx` | Wrap canvas in ScaledCanvasWrapper |
| 5 | `src/components/session/SessionAnnotationToolbar.tsx` | Scroll + touch targets |
| 6 | `src/components/annotations/DrawingToolbar.tsx` | Touch targets |
| 7 | `src/components/capture/CaptureControls.tsx` | flex-wrap |
| 8 | `src/pages/MicroscopeView.tsx` | Replace min-h with aspect-ratio |
| 9 | `src/components/library/SpecimenGrid.tsx` | Mobile pagination |
| 10 | `src/pages/SessionLibraryPage.tsx` | Content padding |
| 11 | All routes | Cross-device verification |
