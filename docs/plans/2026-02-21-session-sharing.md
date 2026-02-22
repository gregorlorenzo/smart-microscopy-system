# MicroScope Share — Live Session Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Zoom-style live session sharing so a presenter can broadcast their microscope camera feed and draw-only annotations in real-time to remote viewers who join via a 6-character session code.

**Architecture:** Supabase Realtime handles all real-time communication on a single channel per session. Presence API tracks the participant list (presenter embeds session name in their presence payload so viewers learn it without a database). Broadcast API streams JPEG frames at ~2fps (640×480, JPEG quality 0.5, ~30–60 KB/frame) and Fabric.js annotation JSON after each completed stroke. No new Supabase database table required — Realtime channels are ephemeral. Session metadata (name, code, role, participant name) persists across page navigation using browser `sessionStorage`. Presenter-only drawing: viewer canvas loads JSON but has all interaction disabled.

**Routes added:**
- `/` → new SessionLandingPage (replaces current home)
- `/session/:code` → SessionLobbyPage (waiting room + participant list)
- `/session/:code/stream` → SessionStreamPage (dark full-screen workspace)
- `/session/:code/library` → SessionLibraryPage (in-session specimen library)
- `/standalone` → existing MicroscopeView (moved here, Layout wrapper kept)
- `/standalone/library` → existing LibraryView (moved here)

**Tech Stack:** React 18 + TypeScript, Supabase Realtime (Broadcast + Presence), Fabric.js v7, Tailwind CSS, shadcn/ui, react-router-dom

**What is reused without changes:**
- `src/hooks/useCamera.ts` — camera hook (videoRef + startCamera/stopCamera)
- `src/hooks/useAnnotations.ts` — Fabric.js canvas hook (containerRef, drawMode, loadJSON, fabricCanvas, etc.)
- `src/components/library/` — all library components (SpecimenGrid, SpecimenCard, SpecimenDetailDialog, SearchBar)
- `src/hooks/useSpecimens.ts` — specimen data hook
- `src/lib/supabase.ts` — Supabase client (already configured)
- All shadcn/ui components

---

## Task 1: Session TypeScript Types

**Files:**
- Create: `src/types/session.ts`

**Step 1: Create the types file**

Create `src/types/session.ts`:
```typescript
export interface SessionParticipant {
  name: string;
  role: 'presenter' | 'viewer';
  sessionName?: string; // Only set by presenter in presence track payload
}

export interface SessionInfo {
  code: string;
  name: string;
  participantName: string;
  role: 'presenter' | 'viewer';
}

// Keys used in sessionStorage to persist session info across page navigation
export const SESSION_STORAGE_KEYS = {
  CODE: 'sms_session_code',
  NAME: 'sms_session_name',
  PARTICIPANT_NAME: 'sms_participant_name',
  ROLE: 'sms_session_role',
} as const;
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -20`
Expected: No errors related to the new file

**Step 3: Commit**

```bash
git add src/types/session.ts
git commit -m "feat: add TypeScript types for session sharing"
```

---

## Task 2: Session Utilities

**Files:**
- Create: `src/lib/sessionUtils.ts`

**Step 1: Create the utilities file**

Create `src/lib/sessionUtils.ts`:
```typescript
import { SessionInfo, SESSION_STORAGE_KEYS } from '@/types/session';

// Generate a 6-character uppercase alphanumeric code (e.g. "VAD0WT")
export function generateSessionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// Persist session info to sessionStorage (survives page navigation within same tab)
export function saveSessionInfo(info: SessionInfo): void {
  sessionStorage.setItem(SESSION_STORAGE_KEYS.CODE, info.code);
  sessionStorage.setItem(SESSION_STORAGE_KEYS.NAME, info.name);
  sessionStorage.setItem(SESSION_STORAGE_KEYS.PARTICIPANT_NAME, info.participantName);
  sessionStorage.setItem(SESSION_STORAGE_KEYS.ROLE, info.role);
}

// Read session info from sessionStorage
export function loadSessionInfo(): SessionInfo | null {
  const code = sessionStorage.getItem(SESSION_STORAGE_KEYS.CODE);
  const name = sessionStorage.getItem(SESSION_STORAGE_KEYS.NAME);
  const participantName = sessionStorage.getItem(SESSION_STORAGE_KEYS.PARTICIPANT_NAME);
  const role = sessionStorage.getItem(SESSION_STORAGE_KEYS.ROLE) as 'presenter' | 'viewer' | null;

  if (!code || !participantName || !role) return null;

  return {
    code,
    name: name || code, // Fall back to code if name not set yet
    participantName,
    role,
  };
}

export function clearSessionInfo(): void {
  Object.values(SESSION_STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key));
}

// Build the join URL for sharing (e.g. https://example.com/session/VAD0WT)
export function buildJoinUrl(code: string): string {
  return `${window.location.origin}/session/${code}`;
}
```

**Step 2: Commit**

```bash
git add src/lib/sessionUtils.ts
git commit -m "feat: add session code generation and sessionStorage utilities"
```

---

## Task 3: Session Presence Hook

**Files:**
- Create: `src/hooks/useSessionPresence.ts`

This hook subscribes to the Supabase Presence channel for a session. The presenter embeds `sessionName` in their presence payload so viewers can display the session name without a database lookup.

**Step 1: Create the hook**

Create `src/hooks/useSessionPresence.ts`:
```typescript
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SessionParticipant } from '@/types/session';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseSessionPresenceOptions {
  sessionCode: string;
  participantName: string;
  role: 'presenter' | 'viewer';
  sessionName?: string; // Presenter passes this; viewers leave undefined
}

export function useSessionPresence({
  sessionCode,
  participantName,
  role,
  sessionName,
}: UseSessionPresenceOptions) {
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [resolvedSessionName, setResolvedSessionName] = useState<string>(
    sessionName || sessionCode
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionCode || !participantName) return;

    const channel = supabase.channel(`session-presence:${sessionCode}`, {
      config: { presence: { key: participantName } },
    });

    channel.on(
      'presence',
      { event: 'sync' },
      () => {
        const state = channel.presenceState<{
          name: string;
          role: string;
          sessionName?: string;
        }>();

        const list: SessionParticipant[] = Object.values(state)
          .flat()
          .map((p) => ({
            name: p.name,
            role: p.role as 'presenter' | 'viewer',
            sessionName: p.sessionName,
          }));

        setParticipants(list);

        // Viewers learn the session name from the presenter's presence data
        const presenter = list.find((p) => p.role === 'presenter');
        if (presenter?.sessionName) {
          setResolvedSessionName(presenter.sessionName);
        }
      }
    );

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          name: participantName,
          role,
          sessionName: role === 'presenter' ? sessionName : undefined,
        });
      }
    });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [sessionCode, participantName, role, sessionName]);

  return { participants, resolvedSessionName };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useSessionPresence.ts
git commit -m "feat: add useSessionPresence hook for real-time participant tracking"
```

---

## Task 4: Session Stream Hook

**Files:**
- Create: `src/hooks/useSessionStream.ts`

This hook manages the Supabase Broadcast channel for a session. The presenter uses `startBroadcasting` / `stopBroadcasting` to stream frames and `broadcastAnnotations` to sync annotation state. Viewers receive frames and annotation JSON automatically.

**Step 1: Create the hook**

Create `src/hooks/useSessionStream.ts`:
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Frame settings — 640×480 JPEG at 0.5 quality ≈ 30–60 KB, well within Supabase's 2 MB limit
const FRAME_INTERVAL_MS = 500; // 2fps — sufficient for mostly-static specimens
const BROADCAST_WIDTH = 640;
const BROADCAST_HEIGHT = 480;
const JPEG_QUALITY = 0.5;

interface UseSessionStreamOptions {
  sessionCode: string;
  role: 'presenter' | 'viewer';
}

export function useSessionStream({ sessionCode, role }: UseSessionStreamOptions) {
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [incomingAnnotations, setIncomingAnnotations] = useState<any>(null);
  const [isPresenterStreaming, setIsPresenterStreaming] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionCode) return;

    const channel = supabase.channel(`session-stream:${sessionCode}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    channel
      .on('broadcast', { event: 'frame' }, ({ payload }) => {
        if (role === 'viewer') {
          setCurrentFrame(payload.frame as string);
          setIsPresenterStreaming(true);
        }
      })
      .on('broadcast', { event: 'annotations' }, ({ payload }) => {
        if (role === 'viewer') {
          setIncomingAnnotations(payload.annotations);
        }
      })
      .on('broadcast', { event: 'stream:stop' }, () => {
        setIsPresenterStreaming(false);
        setCurrentFrame(null);
      });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      stopBroadcasting();
      supabase.removeChannel(channel);
    };
  }, [sessionCode, role]);

  // Capture a single frame from the video element and broadcast it
  const broadcastFrame = useCallback((videoElement: HTMLVideoElement) => {
    if (!channelRef.current || !videoElement) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = BROADCAST_WIDTH;
    offscreen.height = BROADCAST_HEIGHT;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoElement, 0, 0, BROADCAST_WIDTH, BROADCAST_HEIGHT);
    const frame = offscreen.toDataURL('image/jpeg', JPEG_QUALITY);

    channelRef.current.send({
      type: 'broadcast',
      event: 'frame',
      payload: { frame },
    });
  }, []);

  // Start interval-based frame broadcasting (presenter only)
  const startBroadcasting = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPresenterStreaming(true);
      intervalRef.current = setInterval(
        () => broadcastFrame(videoElement),
        FRAME_INTERVAL_MS
      );
    },
    [broadcastFrame]
  );

  // Stop frame broadcasting and notify viewers
  const stopBroadcasting = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPresenterStreaming(false);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'stream:stop',
      payload: {},
    });
  }, []);

  // Broadcast annotation JSON to viewers (presenter only, called after each stroke)
  const broadcastAnnotations = useCallback(
    (json: any) => {
      if (!channelRef.current || role !== 'presenter') return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'annotations',
        payload: { annotations: json },
      });
    },
    [role]
  );

  return {
    currentFrame,
    incomingAnnotations,
    isPresenterStreaming,
    startBroadcasting,
    stopBroadcasting,
    broadcastAnnotations,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useSessionStream.ts
git commit -m "feat: add useSessionStream hook for frame broadcast and annotation sync"
```

---

## Task 5: App Router Refactor

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Navigation.tsx`
- Create (placeholders): `src/pages/SessionLandingPage.tsx`, `src/pages/SessionLobbyPage.tsx`, `src/pages/SessionStreamPage.tsx`, `src/pages/SessionLibraryPage.tsx`

The current app wraps ALL routes inside `<Layout>`. Session pages need their own layout (full-screen dark for stream, simple centered card for landing/lobby). We must move `<Layout>` inside the standalone routes only.

**Step 1: Create placeholder page files**

Create `src/pages/SessionLandingPage.tsx`:
```tsx
export default function SessionLandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Session Landing — coming soon</p>
    </div>
  );
}
```

Create `src/pages/SessionLobbyPage.tsx`:
```tsx
export default function SessionLobbyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Session Lobby — coming soon</p>
    </div>
  );
}
```

Create `src/pages/SessionStreamPage.tsx`:
```tsx
export default function SessionStreamPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <p className="text-gray-400">Stream — coming soon</p>
    </div>
  );
}
```

Create `src/pages/SessionLibraryPage.tsx`:
```tsx
export default function SessionLibraryPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Session Library — coming soon</p>
    </div>
  );
}
```

**Step 2: Rewrite App.tsx**

Replace the full content of `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import MicroscopeView from './pages/MicroscopeView';
import LibraryView from './pages/LibraryView';
import NotFound from './pages/NotFound';
import SessionLandingPage from './pages/SessionLandingPage';
import SessionLobbyPage from './pages/SessionLobbyPage';
import SessionStreamPage from './pages/SessionStreamPage';
import SessionLibraryPage from './pages/SessionLibraryPage';
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Session flow — no Layout wrapper (each page manages its own full-screen layout) */}
        <Route path="/" element={<SessionLandingPage />} />
        <Route path="/session/:code" element={<SessionLobbyPage />} />
        <Route path="/session/:code/stream" element={<SessionStreamPage />} />
        <Route path="/session/:code/library" element={<SessionLibraryPage />} />

        {/* Standalone tool — keeps existing Layout with header and navigation */}
        <Route path="/standalone" element={<Layout><MicroscopeView /></Layout>} />
        <Route path="/standalone/library" element={<Layout><LibraryView /></Layout>} />

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
```

**Step 3: Update Navigation.tsx paths**

The existing header nav links to `/` and `/library`. Update them to point to the new standalone routes.

In `src/components/layout/Navigation.tsx`, change the navItems array:
```tsx
const navItems = [
  { path: '/standalone', label: 'Microscope', icon: Camera },
  { path: '/standalone/library', label: 'Library', icon: Library },
];
```

Also update the `isActive` check — `location.pathname === item.path` will still work correctly since the paths changed.

**Step 4: Verify the app runs**

Run: `npm run dev`

Check these URLs manually:
- `http://localhost:5173/` → shows "Session Landing — coming soon"
- `http://localhost:5173/standalone` → shows existing MicroscopeView with header + nav
- `http://localhost:5173/standalone/library` → shows existing LibraryView with header + nav
- `http://localhost:5173/session/ABC123` → shows "Session Lobby — coming soon"
- Header nav "Microscope" and "Library" links still work

Expected: No console errors, all routes resolve correctly

**Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/Navigation.tsx src/pages/SessionLandingPage.tsx src/pages/SessionLobbyPage.tsx src/pages/SessionStreamPage.tsx src/pages/SessionLibraryPage.tsx
git commit -m "feat: add session routes and move standalone tool to /standalone path"
```

---

## Task 6: Session Landing Page

**Files:**
- Modify: `src/pages/SessionLandingPage.tsx`

Implements Figma screens 1 (landing), 2 (Create Session modal), 3 (Join Session modal). All state is local — no network calls. On form submit, saves to `sessionStorage` then navigates.

**Step 1: Replace the placeholder with the full implementation**

Replace the full content of `src/pages/SessionLandingPage.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { generateSessionCode, saveSessionInfo, buildJoinUrl } from '@/lib/sessionUtils';

export default function SessionLandingPage() {
  const navigate = useNavigate();

  // Dialog visibility
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Create session form state
  const [sessionName, setSessionName] = useState('');
  // Generate code once on mount (useState initializer runs once)
  const [generatedCode] = useState(generateSessionCode);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Join session form state
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(buildJoinUrl(generatedCode));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCreateSession = () => {
    if (!sessionName.trim()) return;
    saveSessionInfo({
      code: generatedCode,
      name: sessionName.trim(),
      participantName: 'Presenter',
      role: 'presenter',
    });
    navigate(`/session/${generatedCode}`);
  };

  const handleJoinSession = () => {
    setJoinError('');
    if (!joinName.trim()) {
      setJoinError('Please enter your name');
      return;
    }
    if (joinCode.trim().length !== 6) {
      setJoinError('Session code must be 6 characters');
      return;
    }
    const code = joinCode.trim().toUpperCase();
    saveSessionInfo({
      code,
      name: code, // Will be overwritten once presenter's presence data arrives
      participantName: joinName.trim(),
      role: 'viewer',
    });
    navigate(`/session/${code}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
            <Microscope className="w-7 h-7 text-blue-500" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">MicroScope Share</h1>
          <p className="text-gray-500 text-sm">Share live microscope views with your team</p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button className="w-full gap-2" onClick={() => setShowCreate(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Create Session
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setShowJoin(true)}>
            Join Session
          </Button>
        </div>

        <p className="text-xs text-gray-400">
          Collaborate in real-time with remote observation and annotation tools
        </p>

        <a
          href="/standalone"
          className="block text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
        >
          Use standalone mode →
        </a>
      </div>

      {/* ── Create Session Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Session</DialogTitle>
            <DialogDescription>
              Set up your microscope sharing session and invite participants
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="session-name">Session Name</Label>
              <Input
                id="session-name"
                placeholder="e.g., Biology Lab Session"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Session Code</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedCode}
                  readOnly
                  className="bg-gray-50 font-mono font-bold tracking-widest text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCode}
                  title="Copy code"
                >
                  {codeCopied ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Share Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={buildJoinUrl(generatedCode)}
                  readOnly
                  className="bg-gray-50 text-xs text-gray-500"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  title={linkCopied ? 'Copied!' : 'Copy link'}
                >
                  {linkCopied ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateSession}
                disabled={!sessionName.trim()}
              >
                Create Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Join Session Dialog ── */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join Session</DialogTitle>
            <DialogDescription>
              Enter the session code to join an existing microscope session
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="your-name">Your Name</Label>
              <Input
                id="your-name"
                placeholder="Enter your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="join-code">Session Code</Label>
              <Input
                id="join-code"
                placeholder="e.g., ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest uppercase text-center"
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
              />
              {joinError && <p className="text-sm text-red-500">{joinError}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowJoin(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleJoinSession}>
                Join Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Test manually**

Run: `npm run dev`, open `http://localhost:5173`

Verify:
- Landing card renders with logo, two buttons, tagline, standalone link
- "Create Session" opens dialog with auto-generated 6-char code
- Typing a session name and pressing Enter (or clicking "Create Session") navigates to `/session/[CODE]`
- Copy Code button copies the code to clipboard (check with Ctrl+V in any text field)
- Copy Link button copies `http://localhost:5173/session/[CODE]`
- "Join Session" dialog: leaving name empty and submitting shows error
- Entering name + 6-char code and submitting navigates to `/session/[CODE]`
- "Use standalone mode →" link navigates to `/standalone`

**Step 3: Commit**

```bash
git add src/pages/SessionLandingPage.tsx
git commit -m "feat: implement session landing page with Create and Join Session dialogs"
```

---

## Task 7: Session Lobby Page

**Files:**
- Modify: `src/pages/SessionLobbyPage.tsx`

Implements Figma screen (153515). Shows session name + code, copy/share buttons (presenter only), real-time participant list via Supabase Presence, and action buttons.

**Step 1: Replace the placeholder with the full implementation**

Replace the full content of `src/pages/SessionLobbyPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Link2, Library, Play, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { loadSessionInfo, buildJoinUrl, clearSessionInfo } from '@/lib/sessionUtils';
import { useSessionPresence } from '@/hooks/useSessionPresence';
import { SessionInfo } from '@/types/session';

export default function SessionLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Load session info from sessionStorage on mount.
  // If not found (e.g. someone navigated directly to this URL), redirect to landing.
  useEffect(() => {
    const info = loadSessionInfo();
    if (!info || info.code !== code?.toUpperCase()) {
      navigate('/');
      return;
    }
    setSessionInfo(info);
  }, [code, navigate]);

  const { participants, resolvedSessionName } = useSessionPresence({
    sessionCode: code || '',
    participantName: sessionInfo?.participantName || '',
    role: sessionInfo?.role || 'viewer',
    sessionName: sessionInfo?.role === 'presenter' ? sessionInfo.name : undefined,
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code || '');
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(buildJoinUrl(code || ''));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleStartOrJoinStream = () => navigate(`/session/${code}/stream`);
  const handleOpenLibrary = () => navigate(`/session/${code}/library`);

  const handleLeave = () => {
    clearSessionInfo();
    navigate('/');
  };

  // Don't render until session info is loaded (avoids flash before redirect)
  if (!sessionInfo) return null;

  const isPresenter = sessionInfo.role === 'presenter';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md space-y-6">

        {/* Header: session name + leave button */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{resolvedSessionName}</h1>
              {isPresenter && (
                <Badge className="bg-gray-900 text-white text-xs px-2 py-0.5">Presenter</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Session Code: <span className="font-mono font-semibold">{code}</span></p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600 gap-1.5 -mt-1"
            onClick={handleLeave}
          >
            <ArrowLeft className="w-4 h-4" />
            Leave
          </Button>
        </div>

        {/* Copy / share buttons — presenter only */}
        {isPresenter && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopyCode}
            >
              <Copy className="w-4 h-4" />
              {codeCopied ? 'Copied!' : 'Copy Code'}
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopyLink}
            >
              <Link2 className="w-4 h-4" />
              {linkCopied ? 'Copied!' : 'Share Link'}
            </Button>
          </div>
        )}

        {/* Participant list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Participants ({participants.length})
          </h2>
          <div className="space-y-2">
            {participants.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">
                {isPresenter
                  ? 'Waiting for participants to join...'
                  : 'Connecting to session...'}
              </p>
            ) : (
              participants.map((p, i) => {
                const isYou = p.name === sessionInfo.participantName;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isYou
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {isYou ? `${p.name} (You)` : p.name}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{p.role}</p>
                      </div>
                    </div>
                    {p.role === 'presenter' && (
                      <span className="text-yellow-500 text-lg" title="Presenter">★</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <Button
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={handleStartOrJoinStream}
          >
            <Play className="w-4 h-4" />
            {isPresenter ? 'Start Microscope Stream' : 'Join Stream'}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleOpenLibrary}
          >
            <Library className="w-4 h-4" />
            Specimen Library
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Test with two browser tabs**

Run: `npm run dev`

Tab 1 (presenter):
1. Go to `http://localhost:5173` → Create Session "Biology Lab" → navigate to lobby
2. Verify: session name shows, code shown, copy buttons visible, "You (Presenter)" in list with ★

Tab 2 (viewer):
1. Go to `http://localhost:5173` → Join Session → enter name + the code from tab 1
2. Verify: viewer sees "Biology Lab" as session name (learned from presenter's presence)
3. Tab 1: second participant appears in the list in real-time

Both tabs: click "Specimen Library" → navigates to session library placeholder. Back button returns to landing.

**Step 3: Commit**

```bash
git add src/pages/SessionLobbyPage.tsx
git commit -m "feat: implement session lobby with real-time participant list via Supabase Presence"
```

---

## Task 8: Session Annotation Toolbar (Dark Theme)

**Files:**
- Create: `src/components/session/SessionAnnotationToolbar.tsx`

This is the dark bottom bar seen in Figma screen 153540. Same tools as the existing `DrawingToolbar` but styled for dark full-screen use: dark background, icons only (no text), color swatches included inline.

**Step 1: Create the directory and component**

Create `src/components/session/SessionAnnotationToolbar.tsx`:
```tsx
import { MousePointer, Pen, Type, Undo2, Trash2 } from 'lucide-react';
import { DrawMode } from '@/hooks/useAnnotations';

interface SessionAnnotationToolbarProps {
  drawMode: DrawMode;
  brushColor: string;
  brushSize: number;
  canUndo: boolean;
  onModeChange: (mode: DrawMode) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
}

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ffffff', // white
  '#000000', // black
];

const SIZES = [3, 6, 12];

export default function SessionAnnotationToolbar({
  drawMode,
  brushColor,
  brushSize,
  canUndo,
  onModeChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onClear,
}: SessionAnnotationToolbarProps) {
  const btn = (active: boolean, disabled = false) =>
    `w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
      disabled
        ? 'text-gray-600 cursor-not-allowed'
        : active
        ? 'bg-white text-gray-900'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 bg-gray-900/95 backdrop-blur border-t border-gray-800 flex-wrap">
      {/* Mode buttons */}
      <button
        className={btn(drawMode === 'select')}
        onClick={() => onModeChange('select')}
        title="Select / Move"
      >
        <MousePointer className="w-4 h-4" />
      </button>
      <button
        className={btn(drawMode === 'pen')}
        onClick={() => onModeChange('pen')}
        title="Draw"
      >
        <Pen className="w-4 h-4" />
      </button>
      <button
        className={btn(drawMode === 'text')}
        onClick={() => onModeChange('text')}
        title="Add Text"
      >
        <Type className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Brush sizes */}
      {SIZES.map((s) => (
        <button
          key={s}
          className={btn(brushSize === s)}
          onClick={() => onSizeChange(s)}
          title={`${s}px brush`}
        >
          <div
            className={`rounded-full ${brushSize === s ? 'bg-gray-900' : 'bg-current'}`}
            style={{ width: s + 4, height: s + 4 }}
          />
        </button>
      ))}

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Color swatches */}
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
            brushColor === color ? 'border-white scale-110' : 'border-gray-600'
          }`}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Undo / Clear */}
      <button
        className={btn(false, !canUndo)}
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo last annotation"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        className={btn(false)}
        onClick={onClear}
        title="Clear all annotations"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/session/SessionAnnotationToolbar.tsx
git commit -m "feat: add dark SessionAnnotationToolbar for stream workspace"
```

---

## Task 9: Session Stream Page

**Files:**
- Modify: `src/pages/SessionStreamPage.tsx`

This is the core of the feature. Implements Figma screen 153540.

**Presenter view:** live `<video>` from camera + transparent Fabric.js canvas overlay + dark bottom toolbar + frame broadcasting + annotation sync broadcasting.

**Viewer view:** `<img>` updated with received frames + read-only Fabric.js canvas overlay (JSON loaded from presenter's broadcasts).

The canvas is rendered via `useAnnotations` directly (not through the `AnnotationCanvas` component) so we can position it absolutely as an overlay and use our own dark toolbar.

**Step 1: Replace the placeholder with the full implementation**

Replace the full content of `src/pages/SessionStreamPage.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadSessionInfo } from '@/lib/sessionUtils';
import { useSessionPresence } from '@/hooks/useSessionPresence';
import { useSessionStream } from '@/hooks/useSessionStream';
import { useCamera } from '@/hooks/useCamera';
import { useAnnotations } from '@/hooks/useAnnotations';
import SessionAnnotationToolbar from '@/components/session/SessionAnnotationToolbar';
import { SessionInfo } from '@/types/session';

// Canvas size for the annotation overlay
const CANVAS_W = 800;
const CANVAS_H = 600;

export default function SessionStreamPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  // ── Load session info from sessionStorage ──────────────────────────────────
  useEffect(() => {
    const info = loadSessionInfo();
    if (!info || info.code !== code?.toUpperCase()) {
      navigate('/');
      return;
    }
    setSessionInfo(info);
  }, [code, navigate]);

  const isPresenter = sessionInfo?.role === 'presenter';

  // ── Real-time hooks ────────────────────────────────────────────────────────

  // Participant count for top bar
  const { participants } = useSessionPresence({
    sessionCode: code || '',
    participantName: sessionInfo?.participantName || '',
    role: sessionInfo?.role || 'viewer',
    sessionName: isPresenter ? sessionInfo?.name : undefined,
  });

  // Frame + annotation broadcast/receive
  const {
    currentFrame,
    incomingAnnotations,
    isPresenterStreaming,
    startBroadcasting,
    stopBroadcasting,
    broadcastAnnotations,
  } = useSessionStream({
    sessionCode: code || '',
    role: sessionInfo?.role || 'viewer',
  });

  // ── Camera (presenter only) ────────────────────────────────────────────────
  const { videoRef, startCamera, stopCamera, isStreaming } = useCamera();

  useEffect(() => {
    if (!isPresenter || !sessionInfo) return;
    startCamera();
    return () => {
      stopBroadcasting();
      stopCamera();
    };
  }, [isPresenter, sessionInfo]);

  // Start broadcasting once the camera stream is live
  useEffect(() => {
    if (isPresenter && isStreaming && videoRef.current) {
      startBroadcasting(videoRef.current);
    }
  }, [isPresenter, isStreaming]);

  // ── Annotation canvas ──────────────────────────────────────────────────────
  const {
    containerRef,
    drawMode,
    brushColor,
    brushSize,
    canUndo,
    setMode,
    updateBrush,
    undo,
    clearAll,
    exportJSON,
    loadJSON,
    fabricCanvas,
  } = useAnnotations(CANVAS_W, CANVAS_H);

  // Disable viewer interaction once canvas is initialised
  useEffect(() => {
    if (!fabricCanvas || isPresenter) return;
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.selection = false;
    fabricCanvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });
  }, [fabricCanvas, isPresenter]);

  // Presenter: broadcast annotations after each completed stroke / object change
  useEffect(() => {
    if (!fabricCanvas || !isPresenter) return;

    const handleChange = () => broadcastAnnotations(exportJSON());

    fabricCanvas.on('path:created', handleChange);
    fabricCanvas.on('object:added', handleChange);
    fabricCanvas.on('object:modified', handleChange);
    fabricCanvas.on('object:removed', handleChange);

    return () => {
      fabricCanvas.off('path:created', handleChange);
      fabricCanvas.off('object:added', handleChange);
      fabricCanvas.off('object:modified', handleChange);
      fabricCanvas.off('object:removed', handleChange);
    };
  }, [fabricCanvas, isPresenter, exportJSON, broadcastAnnotations]);

  // Viewer: receive and render incoming annotation JSON
  useEffect(() => {
    if (!incomingAnnotations || isPresenter || !fabricCanvas) return;
    loadJSON(incomingAnnotations);
  }, [incomingAnnotations, isPresenter, fabricCanvas, loadJSON]);

  // ── Navigation handlers ────────────────────────────────────────────────────
  const handleBack = () => {
    stopBroadcasting();
    navigate(`/session/${code}`);
  };

  const handleOpenLibrary = () => navigate(`/session/${code}/library`);

  if (!sessionInfo) return null;

  const isLive = isPresenter ? isStreaming : isPresenterStreaming;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden select-none">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800 gap-1.5"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <span className="text-sm font-medium text-gray-200 hidden sm:block">
            {sessionInfo.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-gray-400 text-sm">
            <Users className="w-4 h-4" />
            <span>Participants ({participants.length})</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={handleOpenLibrary}
            title="Specimen Library"
          >
            <Library className="w-4 h-4" />
          </Button>
          {isLive && (
            <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Live
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">

        {/* Presenter: live camera feed */}
        {isPresenter && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-full max-w-full object-contain"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
          />
        )}

        {/* Viewer: received JPEG frame */}
        {!isPresenter && (
          isPresenterStreaming && currentFrame ? (
            <img
              src={currentFrame}
              alt="Live microscope feed"
              className="max-h-full max-w-full object-contain"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            />
          ) : (
            <div className="text-center space-y-3 text-gray-600">
              <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm">Waiting for presenter to start the stream…</p>
            </div>
          )
        )}

        {/* Annotation canvas overlay — fixed 800×600, centered, transparent */}
        {/* Presenter: interactive. Viewer: pointer-events disabled. */}
        <div
          className="absolute overflow-hidden"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: isPresenter ? 'auto' : 'none',
          }}
        >
          <div ref={containerRef} />
        </div>
      </div>

      {/* ── Bottom toolbar — presenter only ──────────────────────────────── */}
      {isPresenter && (
        <SessionAnnotationToolbar
          drawMode={drawMode}
          brushColor={brushColor}
          brushSize={brushSize}
          canUndo={canUndo}
          onModeChange={setMode}
          onColorChange={(color) => updateBrush(color, undefined)}
          onSizeChange={(size) => updateBrush(undefined, size)}
          onUndo={undo}
          onClear={clearAll}
        />
      )}
    </div>
  );
}
```

**Step 2: Test presenter flow**

Run: `npm run dev`

1. Create session → lobby → "Start Microscope Stream"
2. Expected: full-screen dark view, browser asks for camera permission, camera feed appears
3. "Live" badge appears in top bar
4. Select pen tool → draw on the microscope view → strokes appear on the canvas overlay
5. Change color + brush size → works correctly
6. Undo removes last stroke. Clear removes all.

**Step 3: Test viewer flow**

Open a second browser tab, join the same session code, go to stream:

1. Expected: "Waiting for presenter…" screen initially
2. Once presenter is on stream page: microscope frames appear (updates every ~500ms)
3. Presenter draws a stroke → viewer sees it appear after the next annotation broadcast
4. Viewer cannot draw (mouse does nothing on canvas)
5. "Live" badge appears on viewer when receiving frames

**Step 4: Commit**

```bash
git add src/pages/SessionStreamPage.tsx
git commit -m "feat: implement live session stream page with frame broadcast and annotation overlay"
```

---

## Task 10: In-Session Library Page

**Files:**
- Modify: `src/pages/SessionLibraryPage.tsx`

Reuses all existing library components. Main differences from standalone library: "Back" button returns to session lobby, "Add Specimen" navigates to stream to capture a frame there.

**Step 1: Replace the placeholder with the full implementation**

Replace the full content of `src/pages/SessionLibraryPage.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSpecimens } from '@/hooks/useSpecimens';
import SpecimenGrid from '@/components/library/SpecimenGrid';
import SpecimenDetailDialog from '@/components/library/SpecimenDetailDialog';
import { Specimen } from '@/types/specimen';

export default function SessionLibraryPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const {
    specimens,
    searchQuery,
    setSearchQuery,
    deleteSpecimen,
    updateSpecimen,
    reload,
  } = useSpecimens();

  const [selectedSpecimen, setSelectedSpecimen] = useState<Specimen | null>(null);

  const handleBack = () => navigate(`/session/${code}`);
  // "Add Specimen" sends user to the stream to capture from the live feed
  const handleAddSpecimen = () => navigate(`/session/${code}/stream`);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-gray-600 hover:text-gray-900"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-base font-semibold text-gray-900">Specimen Library</h1>
        <Button size="sm" className="gap-1.5" onClick={handleAddSpecimen}>
          <Plus className="w-4 h-4" />
          Add Specimen
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {/* Search + filter row */}
        <div className="flex gap-3">
          <Input
            placeholder="Search specimens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" className="gap-1.5 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
            All Types
          </Button>
        </div>

        {/* Specimen grid — reuses existing component */}
        <SpecimenGrid
          specimens={specimens}
          onDelete={deleteSpecimen}
          onSelect={setSelectedSpecimen}
        />
      </div>

      {/* Detail dialog — reuses existing component */}
      <SpecimenDetailDialog
        specimen={selectedSpecimen}
        open={!!selectedSpecimen}
        onClose={() => {
          setSelectedSpecimen(null);
          reload();
        }}
        onUpdate={updateSpecimen}
      />
    </div>
  );
}
```

**Step 2: Test the session library**

Run: `npm run dev`

1. Create session → lobby → "Specimen Library"
2. Expected: library page with back button + sticky header, existing localStorage specimens visible
3. Search filters correctly
4. Click a specimen → detail dialog opens, editable
5. "Add Specimen" → navigates to stream page
6. "Back" → returns to session lobby

**Step 3: Commit**

```bash
git add src/pages/SessionLibraryPage.tsx
git commit -m "feat: implement in-session specimen library page"
```

---

## End-to-End Verification

**Test the complete session flow with two browser windows side by side:**

1. Window A: `http://localhost:5173` → Create Session "Biology Lab" → lobby
2. Window B: `http://localhost:5173` → Join Session → enter name + code → lobby
3. Window A: verifies Window B participant appears in real-time list
4. Window A: clicks "Start Microscope Stream" — camera prompt appears, stream page loads
5. Window B: clicks "Join Stream" — stream page loads, "Waiting…" shown briefly then frames appear
6. Window A: selects pen, draws on canvas — Window B sees annotation after each stroke
7. Window A: changes color, draws more — Window B sees correct colors
8. Window A: clicks Library icon — in-session library loads, "Back" returns to stream page
9. Window A: clicks "Back" in top bar — returns to lobby
10. Window A: clicks "Leave" — returns to landing page, sessionStorage cleared

**Verify standalone mode is unaffected:**

1. `http://localhost:5173/standalone` — existing MicroscopeView with header + nav
2. `http://localhost:5173/standalone/library` — existing LibraryView with header + nav
3. All existing features (capture, annotate, save, video recording) still work
