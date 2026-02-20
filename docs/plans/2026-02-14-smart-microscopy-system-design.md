# Smart Microscopy System - Design Document

**Date:** February 14, 2026
**Timeline:** 3 weeks to working prototype
**Developer:** Solo development
**Target Users:** Biology/science students (capstone project presentation)

---

## Project Overview

A web-based smart microscopy system that allows students to view specimens through a camera, annotate images with drawing tools, save specimens to a library, and capture screenshots/videos for lab reports and presentations.

### MVP Features (Must-Have for Demo)

1. **Annotations with Drawing Tools**
   - Freehand pen (variable sizes, colors)
   - Text labels
   - Undo/redo functionality
   - Nice-to-have: Shapes, measurements, color coding

2. **Specimen Library**
   - Save and organize specimens
   - Search and filter
   - View saved specimens with annotations
   - Delete specimens

3. **Screenshot & Basic Video Recording**
   - Screenshot with baked-in annotations (PNG export)
   - Basic video recording of live feed (60s max, WebM format)
   - Download capabilities

### Technical Constraints

- No ESP-32Cam available → Use webcam/phone camera as temporary solution
- Free tier services preferred (can upgrade for 1 month if needed for demo performance)
- Must work on desktop and mobile browsers (hybrid web app)
- Offline-first with cloud sync (localStorage + Supabase)
- Student doesn't code → Solo developer optimizing for speed

---

## Section 1: System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│           Browser (Desktop/Mobile)              │
│  ┌───────────────────────────────────────────┐  │
│  │   React SPA (Vite)                        │  │
│  │                                           │  │
│  │  ├─ Camera Module (MediaDevices API)     │  │
│  │  ├─ Canvas Layer (Fabric.js)             │  │
│  │  ├─ Specimen Library (React components)  │  │
│  │  └─ Export Module (Screenshots/Video)    │  │
│  │                                           │  │
│  │  localStorage (Offline-first cache)      │  │
│  └───────────────┬───────────────────────────┘  │
└────────────────┼─────────────────────────────────┘
                 │
          Network (sync when online)
                 │
                 ▼
    ┌────────────────────────────┐
    │   Supabase Backend         │
    ├────────────────────────────┤
    │ • PostgreSQL (specimens)   │
    │ • Auth (optional login)    │
    │ • Storage (images/videos)  │
    │ • Realtime (future sync)   │
    └────────────────────────────┘
```

### Key Design Decisions

1. **Offline-First Strategy**: All data writes go to localStorage first, then sync to Supabase in background. Students can work without internet, data syncs when connected.

2. **Camera Integration**: Use browser's MediaDevices API to access webcam/phone camera. No ESP-32Cam needed for MVP - students can use phone camera via mobile browser or connect USB webcam.

3. **Progressive Enhancement**: Core features (view, annotate, save locally) work without login. Cloud sync requires account (optional for demo).

4. **Mobile-Responsive**: Single codebase adapts to screen size. Touch gestures for mobile, mouse for desktop.

---

## Section 2: Component Structure

### App Component Hierarchy

```
App (routing + auth context)
│
├── Layout
│   ├── Header (logo, sync status, user menu)
│   └── Navigation (specimens, settings)
│
├── MicroscopeView (main workspace)
│   ├── CameraFeed
│   │   ├── StreamSelector (choose camera device)
│   │   └── CameraControls (zoom, focus, flip)
│   │
│   ├── AnnotationCanvas (Fabric.js layer)
│   │   ├── DrawingToolbar (pen, text, shapes, undo/redo)
│   │   └── ColorPicker
│   │
│   └── CaptureControls
│       ├── ScreenshotButton
│       ├── VideoRecordButton
│       └── SaveToLibraryButton
│
├── SpecimenLibrary (grid/list view)
│   ├── SpecimenCard (thumbnail, name, date, annotations)
│   ├── SearchFilter (filter by name, date, tags)
│   └── SpecimenDetail (view saved specimen + annotations)
│
└── SettingsPanel
    ├── CameraSettings
    ├── SyncSettings (enable/disable cloud sync)
    └── ExportSettings
```

### Shared Components (shadcn/ui)

- Button, Input, Dialog, Dropdown, Toast notifications
- Card, Tabs, Badge
- Loading spinners, error boundaries

### State Management

- **React Context** for global state (user, sync status, current specimen)
- **Local state (useState)** for component-specific UI
- **TanStack Query** for Supabase data fetching/caching (handles loading, errors, refetching automatically)

### Folder Structure

```
src/
├── components/
│   ├── camera/
│   ├── annotations/
│   ├── library/
│   └── ui/ (shadcn components)
├── lib/
│   ├── supabase.ts (client setup)
│   ├── storage.ts (localStorage wrapper)
│   └── sync.ts (offline-online sync logic)
├── hooks/
│   ├── useCamera.ts
│   ├── useAnnotations.ts
│   └── useSpecimens.ts
└── types/
    └── specimen.ts (TypeScript interfaces)
```

---

## Section 3: Data Models & Storage

### TypeScript Data Models

```typescript
interface Specimen {
  id: string;                    // UUID
  name: string;                  // e.g., "Onion Cell Sample"
  description?: string;
  capturedAt: Date;
  imageUrl: string;              // Base64 or cloud URL
  videoUrl?: string;             // Optional video recording
  annotations: Annotation[];
  tags?: string[];               // e.g., ["plant", "mitosis"]
  syncedToCloud: boolean;
  userId?: string;               // Optional if logged in
}

interface Annotation {
  id: string;
  type: 'freehand' | 'text' | 'shape';
  data: FabricObject;            // Fabric.js serialized object
  color: string;
  createdAt: Date;
}

interface SyncStatus {
  lastSyncedAt?: Date;
  pendingUploads: string[];      // Specimen IDs waiting to sync
  isOnline: boolean;
}
```

### localStorage Schema

```javascript
// Key: 'sms_specimens'
{
  specimens: Specimen[],
  syncStatus: SyncStatus,
  settings: UserSettings
}

// Max ~5MB storage (browser limit ~10MB)
// Strategy: Store thumbnails locally, full images in Supabase
```

### Supabase Database Schema

```sql
-- Table: specimens
CREATE TABLE specimens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  image_url TEXT,              -- Supabase Storage URL
  video_url TEXT,
  annotations JSONB,           -- Store annotation data as JSON
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supabase Storage buckets:
-- 'specimen-images' (public, for images)
-- 'specimen-videos' (public, for video recordings)

-- Row Level Security (RLS):
-- Users can only access their own specimens
-- OR specimens can be public (for classroom sharing - future feature)
```

### Data Flow

1. **Capture**: Student takes screenshot → saves to localStorage immediately → UI updates instantly
2. **Background sync**: If online + logged in → upload image to Supabase Storage → save metadata to PostgreSQL → mark as synced
3. **Offline**: All operations work in localStorage, queue syncs for later
4. **On reconnect**: Sync queue processes pending uploads automatically

---

## Section 4: Core Features Implementation

### Feature 1: Camera Feed & Capture

**Camera Access:**
```typescript
// Use MediaDevices API
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: 'environment',  // Back camera on mobile
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  }
})
```

**Implementation:**
- `<video>` element displays live camera stream
- Enumerate available cameras (front/back on phones, multiple webcams)
- Camera selector dropdown for multi-camera devices
- Touch/pinch zoom on mobile, scroll zoom on desktop
- Auto-adjust for portrait/landscape orientation

**Temporary Microscope Solution:**
- Phone camera in mobile browser works as "digital microscope"
- Students can use phone macro mode or attach clip-on macro lenses
- USB webcam on desktop for traditional microscope setup

---

### Feature 2: Annotation Canvas (Fabric.js)

**Canvas Setup:**
- Fabric.js canvas overlays the video/captured image
- Transparent layer for drawing on top of specimen
- Canvas matches image dimensions exactly

**Drawing Tools (MVP):**

1. **Freehand Pen** (Priority 1)
   - Variable brush size (5px, 10px, 15px)
   - Color picker (6 preset colors for speed)
   - Smooth drawing with touch/mouse

2. **Text Labels** (Priority 1)
   - Click to place text box
   - Editable font size
   - Arrow connector (future: nice-to-have)

3. **Undo/Redo** (Priority 1)
   - Fabric.js built-in history
   - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)

4. **Shapes** (Priority 2 - if time permits)
   - Circle, rectangle, arrow
   - Highlight areas of interest

**Annotation Persistence:**
- Serialize Fabric.js canvas to JSON
- Save with specimen metadata
- Reload annotations when viewing saved specimen

---

### Feature 3: Specimen Library

**Library View:**
- Grid layout (3 columns desktop, 1-2 mobile)
- Each card shows: thumbnail, name, date, annotation count
- Click to open detail view

**Features:**
- **Search/filter** by name or tags
- **Sort** by date (newest first)
- **Delete** specimens (with confirmation)
- **Export** individual specimen (download image with annotations)

**Detail View:**
- Full-size image with annotations rendered
- Edit name/description
- View metadata (capture date, file size)
- Re-annotate option (opens in MicroscopeView)

---

### Feature 4: Screenshot & Video Recording

**Screenshot:**
```typescript
// Merge video frame + canvas annotations
1. Capture current video frame to canvas
2. Render Fabric.js annotations on top
3. Export as PNG (canvas.toBlob())
4. Save to localStorage + upload to Supabase Storage
```

**Video Recording (Basic):**
```typescript
// Use MediaRecorder API
const stream = canvas.captureStream(30); // 30fps
const recorder = new MediaRecorder(stream);
// Records video element only (annotations NOT live-recorded)
// This is Option B from earlier discussion
```

**Video Flow:**
- Red recording indicator while recording
- Max 60 seconds per recording (keeps file size manageable)
- Save as WebM format (best browser support)
- Upload to Supabase Storage when syncing

**Export Options:**
- Download screenshot (PNG, includes annotations)
- Download video (WebM, live feed only)
- Future: Export all specimens as ZIP

---

## Section 5: Error Handling & Edge Cases

### Camera Permissions & Access

**Permission Denied:**
- Show friendly error message: "Camera access needed to view specimens"
- Provide instructions to enable camera in browser settings
- Fallback: Allow uploading images from device (File Input API)

**No Camera Available:**
- Desktop without webcam → File upload mode
- Graceful degradation: specimen library still works

**Camera Stream Errors:**
- Timeout after 10 seconds if stream doesn't load
- Retry button with clear error message
- Log errors for debugging (console only, not to user)

---

### Offline Mode & Sync Conflicts

**Network Detection:**
```typescript
// Monitor online/offline status
window.addEventListener('online', syncPendingData);
window.addEventListener('offline', showOfflineIndicator);
```

**Offline Behavior:**
- Toast notification: "Working offline - changes will sync when connected"
- All features work normally (localStorage only)
- Sync icon shows "pending" state

**Sync Conflicts:**
- Since students work individually (no multi-user editing), conflicts unlikely
- If same specimen edited on two devices: last-write-wins strategy
- Future improvement: conflict resolution UI

---

### Storage Limits

**localStorage Limits (~10MB per domain):**

**Strategy:**
- Store only thumbnails locally (max 200KB each)
- Full images go to Supabase immediately when online
- Limit: ~30 specimens cached locally before prompting to sync/delete old ones

**Warning System:**
- Check storage usage before saving: `navigator.storage.estimate()`
- Show warning at 80% capacity: "Storage almost full - sync to cloud or delete old specimens"
- Auto-cleanup: Offer to delete synced specimens from localStorage

**Supabase Free Tier (1GB storage):**
- Monitor usage in dashboard
- For demo: 1GB = ~500 high-res images, plenty for presentation
- If needed: Upgrade to Pro ($25/month) for presentation week

---

### Browser Compatibility

**Supported Browsers (Modern evergreens):**
- Chrome/Edge 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅ (iPhone/iPad)
- Mobile browsers (Chrome/Safari on iOS/Android) ✅

**Known Issues:**
- **Safari**: MediaRecorder API limited support → Use polyfill or skip video recording on Safari
- **Older browsers**: Show upgrade notice if critical APIs missing

**Feature Detection:**
```typescript
if (!navigator.mediaDevices?.getUserMedia) {
  // Show error: "Please use a modern browser"
}
```

---

### Demo Day Edge Cases

**Presentation Checklist:**
1. **Pre-load sample specimens** with annotations (impressive examples)
2. **Test on presentation device** (projector resolution, camera access)
3. **Offline mode ready** in case WiFi fails during demo
4. **Clear cache option** to start fresh for demo
5. **Backup plan**: Screen recording of working demo if live fails

**Performance Optimizations for Demo:**
- Lazy load images in library (only load visible thumbnails)
- Debounce canvas renders during fast drawing
- Preconnect to Supabase to avoid cold start latency

---

## Section 6: Testing Strategy

### Testing Approach (Pragmatic for 3-Week Timeline)

**No automated tests for MVP** - focus on rapid development and manual testing. Add tests post-demo if project continues.

**Manual Testing Phases:**

**Week 1-2: Feature Testing**
- Test each feature as you build it
- Use browser DevTools for debugging
- Test on both desktop and mobile from day 1

**Week 3: Integration & Demo Prep**
- Full user flow testing
- Cross-browser testing
- Demo rehearsal

---

### Feature Testing Checklist

**Camera Module:**
- [ ] Camera stream displays correctly (desktop webcam)
- [ ] Camera stream displays correctly (mobile front/back camera)
- [ ] Camera selector switches between devices
- [ ] Handles permission denial gracefully
- [ ] Fallback to file upload works

**Annotation Canvas:**
- [ ] Freehand drawing works (mouse + touch)
- [ ] Text labels can be added and edited
- [ ] Color picker changes annotation color
- [ ] Undo/redo works correctly
- [ ] Annotations save with specimen
- [ ] Annotations reload when viewing saved specimen
- [ ] Canvas scales correctly on mobile

**Specimen Library:**
- [ ] Specimens display in grid
- [ ] Search/filter works
- [ ] Click opens detail view
- [ ] Delete removes specimen (with confirmation)
- [ ] Empty state shows helpful message

**Screenshot/Video:**
- [ ] Screenshot captures video frame + annotations
- [ ] Screenshot downloads as PNG
- [ ] Video recording starts/stops
- [ ] Video saves to library
- [ ] Max 60-second limit enforced

**Sync & Storage:**
- [ ] localStorage saves immediately
- [ ] Supabase sync works when online
- [ ] Offline mode shows correct indicator
- [ ] Sync resumes when back online
- [ ] Storage limit warning appears at 80%

---

### Browser Compatibility Testing

**Primary Test Devices (Week 3):**

1. **Desktop Chrome** (your dev environment) - main testing
2. **Mobile Chrome (Android)** - borrow student's phone or use Chrome DevTools device emulation
3. **Mobile Safari (iPhone)** - critical for iOS users
4. **Desktop Safari** (if Mac available) - video recording fallback test

**Testing Priority:**
- Chrome first (most students will use)
- Safari iOS second (many students have iPhones)
- Firefox/Edge optional (likely works if Chrome works)

**Quick Cross-Browser Test:**
- Open app in each browser
- Test camera, annotate, screenshot, save
- Verify no console errors
- Fix blocking bugs only

---

### Demo Day Preparation

**Week 3 - Dry Run Schedule:**

**Day 1-2 (Mon-Tue):** Feature complete, fix critical bugs

**Day 3-4 (Wed-Thu):**
- Create 3-5 impressive demo specimens with annotations
- Test on presentation device (student's laptop/tablet)
- Screen record full demo as backup

**Day 5 (Fri):**
- Full dress rehearsal (time the demo: should be <5 minutes)
- Prepare talking points for each feature
- Test projector/screen mirroring
- Export demo specimens as backup images

**Presentation Safety Nets:**
1. **Pre-loaded specimens** (don't rely on live capture during demo)
2. **Offline mode enabled** (in case WiFi fails)
3. **Screen recording backup** (if live demo fails, show video)
4. **Screenshots of key features** (fallback slides)

---

### Critical Path Testing (Day Before Demo)

**Must Work Perfectly:**
1. Open app → Camera loads → Annotate → Screenshot → Save to library
2. Open library → View saved specimen with annotations
3. App looks good on projector/large screen

**Can Tolerate:**
- Minor UI glitches
- Video recording issues (screenshot is more important)
- Sync delays (demo can be offline)

**Red Flags (Fix Immediately):**
- Camera doesn't load
- Annotations don't save
- App crashes on mobile
- Library shows empty when specimens exist

---

## Tech Stack Summary

### Frontend
- **Framework**: React 18 + Vite + TypeScript
- **Styling**: TailwindCSS + shadcn/ui (pre-built components)
- **Canvas**: Fabric.js (annotations, drawing, serialization)
- **State**: React Context + TanStack Query
- **Camera**: Browser MediaDevices API
- **Recording**: MediaRecorder API

### Backend
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage (images/videos)
- **Auth**: Supabase Auth (optional login)
- **Local Cache**: localStorage

### Hosting
- **Platform**: Vercel (free tier)
- **Deployment**: Auto-deploy from Git (main branch)
- **Domain**: Vercel subdomain (free) or custom domain

### Development Tools
- **Package Manager**: npm or pnpm
- **Version Control**: Git
- **Code Editor**: VS Code (recommended)
- **Browser DevTools**: Chrome DevTools

---

## 3-Week Development Timeline

### Week 1: Foundation & Camera
- Project setup (Vite + React + TypeScript + TailwindCSS)
- Supabase project setup
- Camera feed component
- Basic UI layout (Header, Navigation)
- shadcn/ui integration

### Week 2: Core Features
- Annotation canvas (Fabric.js integration)
- Drawing tools (pen, text, undo/redo)
- Screenshot capture
- Specimen library (CRUD operations)
- localStorage integration

### Week 3: Polish & Demo Prep
- Video recording
- Sync logic (localStorage ↔ Supabase)
- Error handling
- Cross-browser testing
- Demo specimens preparation
- Performance optimization
- Dress rehearsal

---

## Future Improvements (Post-Demo)

1. **Advanced Annotations**: Measurements, rulers, shape tools, color coding
2. **Real-time Annotated Video**: Record annotations in video (Option C)
3. **Collaboration**: Share specimens with classmates, comments
4. **AI Features**: Auto-identify specimens, suggest labels
5. **Export Suite**: ZIP download, PDF reports, presentation mode
6. **ESP-32Cam Integration**: Replace webcam with dedicated microscope camera
7. **Mobile App**: Native iOS/Android apps
8. **Analytics**: Track student usage, popular specimens

---

## Success Criteria for Demo Day

### Must Demonstrate:
1. ✅ Live camera feed (phone or webcam)
2. ✅ Drawing annotations on live/captured specimen
3. ✅ Screenshot with annotations saved to library
4. ✅ Browse specimen library with thumbnails
5. ✅ Works on mobile browser (bonus: show on phone during demo)

### Nice to Show:
- Video recording
- Offline mode
- Cloud sync
- Cross-device access

### Impress the Panel:
- Smooth, polished UI (shadcn/ui quality)
- Responsive design (desktop + mobile)
- Fast performance (no lag during drawing)
- Professional presentation (pre-loaded impressive specimens)

---

**Design Approved:** February 14, 2026
**Next Step:** Create implementation plan using writing-plans skill
