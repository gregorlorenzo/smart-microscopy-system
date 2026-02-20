# Smart Microscopy System MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based smart microscopy system for biology students to view specimens via camera, annotate images, and maintain a specimen library.

**Architecture:** React SPA with offline-first localStorage + Supabase cloud sync. Camera access via MediaDevices API, annotations via Fabric.js, mobile-responsive hybrid web app.

**Tech Stack:** React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, Fabric.js, Supabase, Vercel

**Timeline:** 3 weeks (Week 1: Foundation, Week 2: Core Features, Week 3: Polish & Demo)

---

## Week 1: Foundation & Setup

### Task 1: Project Initialization

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`

**Step 1: Initialize Vite project with React + TypeScript**

Run: `npm create vite@latest . -- --template react-ts`
Expected: Project scaffolding created

**Step 2: Install core dependencies**

```bash
npm install
npm install -D tailwindcss postcss autoprefixer
npm install @supabase/supabase-js
npm install fabric
npm install @tanstack/react-query
npm install react-router-dom
npm install date-fns uuid
npm install -D @types/uuid
```

Expected: All packages installed successfully

**Step 3: Initialize TailwindCSS**

Run: `npx tailwindcss init -p`

Create: `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 4: Setup TailwindCSS in main CSS**

Create: `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 5: Update main.tsx**

Modify: `src/main.tsx`
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**Step 6: Commit initial setup**

```bash
git add .
git commit -m "chore: initialize Vite + React + TypeScript project with Tailwind"
```

---

### Task 2: Setup shadcn/ui

**Files:**
- Create: `components.json`, `src/lib/utils.ts`
- Create: `src/components/ui/` (will be populated by shadcn CLI)

**Step 1: Install shadcn/ui dependencies**

```bash
npm install class-variance-authority clsx tailwind-merge lucide-react
```

**Step 2: Initialize shadcn/ui**

Run: `npx shadcn-ui@latest init`

Select:
- TypeScript: Yes
- Style: Default
- Base color: Slate
- CSS variables: Yes

Expected: `components.json` created

**Step 3: Add essential components**

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add badge
```

Expected: Components added to `src/components/ui/`

**Step 4: Commit shadcn/ui setup**

```bash
git add .
git commit -m "feat: add shadcn/ui component library"
```

---

### Task 3: TypeScript Types & Interfaces

**Files:**
- Create: `src/types/specimen.ts`

**Step 1: Create specimen types**

Create: `src/types/specimen.ts`
```typescript
export interface Specimen {
  id: string;
  name: string;
  description?: string;
  capturedAt: Date;
  imageUrl: string;
  videoUrl?: string;
  annotations: Annotation[];
  tags?: string[];
  syncedToCloud: boolean;
  userId?: string;
}

export interface Annotation {
  id: string;
  type: 'freehand' | 'text' | 'shape';
  data: any; // Fabric.js serialized object
  color: string;
  createdAt: Date;
}

export interface SyncStatus {
  lastSyncedAt?: Date;
  pendingUploads: string[];
  isOnline: boolean;
}

export interface UserSettings {
  cameraDeviceId?: string;
  enableCloudSync: boolean;
  enableNotifications: boolean;
}

export interface StorageData {
  specimens: Specimen[];
  syncStatus: SyncStatus;
  settings: UserSettings;
}
```

**Step 2: Commit types**

```bash
git add src/types/
git commit -m "feat: add TypeScript interfaces for Specimen and Storage"
```

---

### Task 4: localStorage Utility

**Files:**
- Create: `src/lib/storage.ts`

**Step 1: Create storage utility**

Create: `src/lib/storage.ts`
```typescript
import { Specimen, StorageData, SyncStatus, UserSettings } from '@/types/specimen';

const STORAGE_KEY = 'sms_specimens';

const DEFAULT_DATA: StorageData = {
  specimens: [],
  syncStatus: {
    pendingUploads: [],
    isOnline: navigator.onLine,
  },
  settings: {
    enableCloudSync: false,
    enableNotifications: true,
  },
};

export const storage = {
  getData(): StorageData {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return DEFAULT_DATA;

      const parsed = JSON.parse(data);
      // Convert date strings back to Date objects
      parsed.specimens = parsed.specimens.map((s: any) => ({
        ...s,
        capturedAt: new Date(s.capturedAt),
        annotations: s.annotations.map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
        })),
      }));

      return parsed;
    } catch (error) {
      console.error('Error reading localStorage:', error);
      return DEFAULT_DATA;
    }
  },

  saveData(data: StorageData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      throw new Error('Storage quota exceeded');
    }
  },

  addSpecimen(specimen: Specimen): void {
    const data = this.getData();
    data.specimens.unshift(specimen);
    this.saveData(data);
  },

  updateSpecimen(id: string, updates: Partial<Specimen>): void {
    const data = this.getData();
    const index = data.specimens.findIndex(s => s.id === id);
    if (index !== -1) {
      data.specimens[index] = { ...data.specimens[index], ...updates };
      this.saveData(data);
    }
  },

  deleteSpecimen(id: string): void {
    const data = this.getData();
    data.specimens = data.specimens.filter(s => s.id !== id);
    this.saveData(data);
  },

  getSpecimen(id: string): Specimen | undefined {
    const data = this.getData();
    return data.specimens.find(s => s.id === id);
  },

  updateSettings(settings: Partial<UserSettings>): void {
    const data = this.getData();
    data.settings = { ...data.settings, ...settings };
    this.saveData(data);
  },

  async checkStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        usage,
        quota,
        percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
      };
    }
    return { usage: 0, quota: 0, percentUsed: 0 };
  },
};
```

**Step 2: Commit storage utility**

```bash
git add src/lib/storage.ts
git commit -m "feat: add localStorage utility for offline-first storage"
```

---

### Task 5: Supabase Setup

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `.env.local`

**Step 1: Create Supabase project**

1. Go to https://supabase.com
2. Create new project: "smart-microscopy"
3. Copy Project URL and anon key

**Step 2: Create environment variables**

Create: `.env.local`
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Create: `.env.example`
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Step 3: Create Supabase client**

Create: `src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Cloud sync will be disabled.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// Test connection
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('specimens').select('count');
    return !error;
  } catch {
    return false;
  }
}
```

**Step 4: Update .gitignore**

Modify: `.gitignore`
```
# Env files
.env.local
.env.*.local
```

**Step 5: Commit Supabase setup**

```bash
git add src/lib/supabase.ts .env.example .gitignore
git commit -m "feat: add Supabase client configuration"
```

---

### Task 6: Database Schema (Supabase SQL Editor)

**Step 1: Create specimens table**

Open Supabase SQL Editor, run:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create specimens table
CREATE TABLE specimens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  image_url TEXT,
  video_url TEXT,
  annotations JSONB,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE specimens ENABLE ROW LEVEL SECURITY;

-- Allow public read (for demo - can restrict later)
CREATE POLICY "Allow public read access" ON specimens
  FOR SELECT USING (true);

-- Allow authenticated users to insert their own specimens
CREATE POLICY "Allow authenticated insert" ON specimens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own specimens
CREATE POLICY "Allow users to update own specimens" ON specimens
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own specimens
CREATE POLICY "Allow users to delete own specimens" ON specimens
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX specimens_user_id_idx ON specimens(user_id);
CREATE INDEX specimens_captured_at_idx ON specimens(captured_at DESC);
```

**Step 2: Create storage buckets**

In Supabase Storage, create two public buckets:
- `specimen-images`
- `specimen-videos`

Set both to public access for demo.

**Step 3: Document in plan**

Add note: "✅ Supabase schema created - see SQL above"

---

### Task 7: App Router Setup

**Files:**
- Create: `src/pages/MicroscopeView.tsx`, `src/pages/LibraryView.tsx`, `src/pages/NotFound.tsx`
- Modify: `src/App.tsx`

**Step 1: Create page components (placeholders)**

Create: `src/pages/MicroscopeView.tsx`
```tsx
export default function MicroscopeView() {
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Microscope View</h1>
    </div>
  );
}
```

Create: `src/pages/LibraryView.tsx`
```tsx
export default function LibraryView() {
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Specimen Library</h1>
    </div>
  );
}
```

Create: `src/pages/NotFound.tsx`
```tsx
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="mb-4">Page not found</p>
      <Link to="/" className="text-blue-500 hover:underline">
        Go to Microscope
      </Link>
    </div>
  );
}
```

**Step 2: Setup routing in App**

Modify: `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MicroscopeView from './pages/MicroscopeView';
import LibraryView from './pages/LibraryView';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MicroscopeView />} />
        <Route path="/library" element={<LibraryView />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Step 3: Test routing**

Run: `npm run dev`
Expected: App loads at http://localhost:5173, can navigate between pages

**Step 4: Commit routing**

```bash
git add src/pages/ src/App.tsx
git commit -m "feat: add React Router with Microscope and Library pages"
```

---

### Task 8: Layout Component

**Files:**
- Create: `src/components/layout/Layout.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Navigation.tsx`

**Step 1: Create Header component**

Create: `src/components/layout/Header.tsx`
```tsx
import { Microscope, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Microscope className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Smart Microscopy</h1>
        </div>

        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-600" />
          ) : (
            <div className="flex items-center gap-1 text-orange-600">
              <WifiOff className="w-5 h-5" />
              <span className="text-sm">Offline</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Create Navigation component**

Create: `src/components/layout/Navigation.tsx`
```tsx
import { Link, useLocation } from 'react-router-dom';
import { Camera, Library } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Microscope', icon: Camera },
    { path: '/library', label: 'Library', icon: Library },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="flex max-w-7xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 3: Create Layout wrapper**

Create: `src/components/layout/Layout.tsx`
```tsx
import { ReactNode } from 'react';
import Header from './Header';
import Navigation from './Navigation';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Navigation />
      <main className="max-w-7xl mx-auto p-4">
        {children}
      </main>
    </div>
  );
}
```

**Step 4: Update App to use Layout**

Modify: `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import MicroscopeView from './pages/MicroscopeView';
import LibraryView from './pages/LibraryView';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MicroscopeView />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
```

**Step 5: Commit layout**

```bash
git add src/components/layout/ src/App.tsx
git commit -m "feat: add Layout with Header and Navigation components"
```

---

## Week 2: Core Features

### Task 9: Camera Hook

**Files:**
- Create: `src/hooks/useCamera.ts`

**Step 1: Create camera hook**

Create: `src/hooks/useCamera.ts`
```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Enumerate camera devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
        }));

      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
    }
  }, [selectedDeviceId]);

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      setError(null);
      setPermissionDenied(false);

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }

      // Enumerate devices after getting permission
      await enumerateDevices();
    } catch (err: any) {
      console.error('Camera error:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera or use file upload.');
      } else {
        setError('Failed to access camera. Please try again.');
      }
      setIsStreaming(false);
    }
  }, [enumerateDevices]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Switch camera device
  const switchCamera = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isStreaming) {
      stopCamera();
      startCamera(deviceId);
    }
  }, [isStreaming, stopCamera, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    devices,
    selectedDeviceId,
    isStreaming,
    error,
    permissionDenied,
    startCamera,
    stopCamera,
    switchCamera,
  };
}
```

**Step 2: Commit camera hook**

```bash
git add src/hooks/useCamera.ts
git commit -m "feat: add useCamera hook for MediaDevices API integration"
```

---

### Task 10: Camera Feed Component

**Files:**
- Create: `src/components/camera/CameraFeed.tsx`, `src/components/camera/CameraControls.tsx`

**Step 1: Create CameraControls**

Create: `src/components/camera/CameraControls.tsx`
```tsx
import { Button } from '@/components/ui/button';
import { Camera, VideoOff, SwitchCamera } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CameraDevice } from '@/hooks/useCamera';

interface CameraControlsProps {
  isStreaming: boolean;
  devices: CameraDevice[];
  selectedDeviceId: string;
  onStart: () => void;
  onStop: () => void;
  onSwitch: (deviceId: string) => void;
}

export default function CameraControls({
  isStreaming,
  devices,
  selectedDeviceId,
  onStart,
  onStop,
  onSwitch,
}: CameraControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {!isStreaming ? (
        <Button onClick={onStart} className="gap-2">
          <Camera className="w-4 h-4" />
          Start Camera
        </Button>
      ) : (
        <Button onClick={onStop} variant="destructive" className="gap-2">
          <VideoOff className="w-4 h-4" />
          Stop Camera
        </Button>
      )}

      {devices.length > 1 && isStreaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <SwitchCamera className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {devices.map((device) => (
              <DropdownMenuItem
                key={device.deviceId}
                onClick={() => onSwitch(device.deviceId)}
                className={selectedDeviceId === device.deviceId ? 'bg-gray-100' : ''}
              >
                {device.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
```

**Step 2: Create CameraFeed**

Create: `src/components/camera/CameraFeed.tsx`
```tsx
import { useCamera } from '@/hooks/useCamera';
import CameraControls from './CameraControls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraFeedProps {
  onImageCapture?: (imageData: string) => void;
}

export default function CameraFeed({ onImageCapture }: CameraFeedProps) {
  const {
    videoRef,
    devices,
    selectedDeviceId,
    isStreaming,
    error,
    permissionDenied,
    startCamera,
    stopCamera,
    switchCamera,
  } = useCamera();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageCapture) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        onImageCapture(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Camera Feed</h2>
        <CameraControls
          isStreaming={isStreaming}
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onStart={() => startCamera()}
          onStop={stopCamera}
          onSwitch={switchCamera}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {permissionDenied && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 mb-3">
            Or upload an image from your device:
          </p>
          <label htmlFor="file-upload">
            <Button variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="w-4 h-4" />
                Upload Image
              </span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      )}

      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <p>Click "Start Camera" to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Update MicroscopeView to use CameraFeed**

Modify: `src/pages/MicroscopeView.tsx`
```tsx
import CameraFeed from '@/components/camera/CameraFeed';

export default function MicroscopeView() {
  return (
    <div className="space-y-6">
      <CameraFeed />
    </div>
  );
}
```

**Step 4: Test camera functionality**

Run: `npm run dev`
Expected: Camera feed works, can start/stop, switch devices

**Step 5: Commit camera feed**

```bash
git add src/components/camera/ src/pages/MicroscopeView.tsx
git commit -m "feat: add CameraFeed component with device switching"
```

---

### Task 11: Annotation Canvas Hook

**Files:**
- Create: `src/hooks/useAnnotations.ts`

**Step 1: Create annotations hook**

Create: `src/hooks/useAnnotations.ts`
```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';

export type DrawMode = 'select' | 'pen' | 'text' | 'none';

export function useAnnotations() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(5);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: 'transparent',
    });

    fabricCanvasRef.current = canvas;

    // Enable undo/redo tracking
    canvas.on('object:added', updateUndoRedo);
    canvas.on('object:modified', updateUndoRedo);
    canvas.on('object:removed', updateUndoRedo);

    return () => {
      canvas.dispose();
    };
  }, []);

  const updateUndoRedo = useCallback(() => {
    if (!fabricCanvasRef.current) return;

    // Simple undo/redo state (Fabric.js doesn't have built-in undo/redo)
    // In production, implement proper history stack
    setCanUndo(fabricCanvasRef.current.getObjects().length > 0);
  }, []);

  // Set drawing mode
  const setMode = useCallback((mode: DrawMode) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    if (mode === 'pen') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = brushColor;
      canvas.freeDrawingBrush.width = brushSize;
    } else if (mode === 'text') {
      canvas.isDrawingMode = false;
      // Text mode handled by click event
    } else {
      canvas.isDrawingMode = false;
    }

    setDrawMode(mode);
  }, [brushColor, brushSize]);

  // Add text annotation
  const addText = useCallback((text: string, x: number, y: number) => {
    if (!fabricCanvasRef.current) return;

    const textObj = new fabric.Text(text, {
      left: x,
      top: y,
      fontSize: 20,
      fill: brushColor,
      editable: true,
    });

    fabricCanvasRef.current.add(textObj);
    fabricCanvasRef.current.setActiveObject(textObj);
  }, [brushColor]);

  // Update brush properties
  const updateBrush = useCallback((color?: string, size?: number) => {
    if (color) setBrushColor(color);
    if (size) setBrushSize(size);

    if (fabricCanvasRef.current?.isDrawingMode) {
      if (color) fabricCanvasRef.current.freeDrawingBrush.color = color;
      if (size) fabricCanvasRef.current.freeDrawingBrush.width = size;
    }
  }, []);

  // Clear all annotations
  const clearAll = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.clear();
    fabricCanvasRef.current.backgroundColor = 'transparent';
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  // Undo (simple implementation)
  const undo = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    const objects = fabricCanvasRef.current.getObjects();
    if (objects.length > 0) {
      fabricCanvasRef.current.remove(objects[objects.length - 1]);
    }
  }, []);

  // Export canvas as JSON
  const exportJSON = useCallback(() => {
    if (!fabricCanvasRef.current) return null;
    return fabricCanvasRef.current.toJSON();
  }, []);

  // Load canvas from JSON
  const loadJSON = useCallback((json: any) => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.loadFromJSON(json, () => {
      fabricCanvasRef.current?.renderAll();
    });
  }, []);

  // Resize canvas
  const resizeCanvas = useCallback((width: number, height: number) => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.setDimensions({ width, height });
  }, []);

  return {
    canvasRef,
    fabricCanvas: fabricCanvasRef.current,
    drawMode,
    brushColor,
    brushSize,
    canUndo,
    canRedo,
    setMode,
    addText,
    updateBrush,
    clearAll,
    undo,
    exportJSON,
    loadJSON,
    resizeCanvas,
  };
}
```

**Step 2: Commit annotations hook**

```bash
git add src/hooks/useAnnotations.ts
git commit -m "feat: add useAnnotations hook with Fabric.js integration"
```

---

### Task 12: Annotation Canvas Component

**Files:**
- Create: `src/components/annotations/AnnotationCanvas.tsx`, `src/components/annotations/DrawingToolbar.tsx`

**Step 1: Create DrawingToolbar**

Create: `src/components/annotations/DrawingToolbar.tsx`
```tsx
import { Button } from '@/components/ui/button';
import { Pencil, Type, MousePointer, Undo, Trash2 } from 'lucide-react';
import { DrawMode } from '@/hooks/useAnnotations';

interface DrawingToolbarProps {
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

const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#000000'];
const SIZES = [3, 5, 10, 15];

export default function DrawingToolbar({
  drawMode,
  brushColor,
  brushSize,
  canUndo,
  onModeChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onClear,
}: DrawingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white border rounded-lg">
      <div className="flex gap-1">
        <Button
          variant={drawMode === 'select' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onModeChange('select')}
          title="Select"
        >
          <MousePointer className="w-4 h-4" />
        </Button>
        <Button
          variant={drawMode === 'pen' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onModeChange('pen')}
          title="Draw"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant={drawMode === 'text' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onModeChange('text')}
          title="Add Text"
        >
          <Type className="w-4 h-4" />
        </Button>
      </div>

      <div className="h-8 w-px bg-gray-300" />

      <div className="flex gap-1">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={`w-8 h-8 rounded border-2 ${
              brushColor === color ? 'border-blue-500' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <div className="h-8 w-px bg-gray-300" />

      <div className="flex gap-1">
        {SIZES.map((size) => (
          <Button
            key={size}
            variant={brushSize === size ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSizeChange(size)}
          >
            {size}px
          </Button>
        ))}
      </div>

      <div className="h-8 w-px bg-gray-300" />

      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onClear}
          title="Clear All"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Create AnnotationCanvas**

Create: `src/components/annotations/AnnotationCanvas.tsx`
```tsx
import { useAnnotations } from '@/hooks/useAnnotations';
import DrawingToolbar from './DrawingToolbar';
import { useEffect } from 'react';

interface AnnotationCanvasProps {
  width?: number;
  height?: number;
  onAnnotationsChange?: (json: any) => void;
}

export default function AnnotationCanvas({
  width = 800,
  height = 600,
  onAnnotationsChange,
}: AnnotationCanvasProps) {
  const {
    canvasRef,
    drawMode,
    brushColor,
    brushSize,
    canUndo,
    setMode,
    updateBrush,
    undo,
    clearAll,
    resizeCanvas,
    exportJSON,
  } = useAnnotations();

  useEffect(() => {
    resizeCanvas(width, height);
  }, [width, height, resizeCanvas]);

  const handleExport = () => {
    if (onAnnotationsChange) {
      const json = exportJSON();
      onAnnotationsChange(json);
    }
  };

  return (
    <div className="space-y-4">
      <DrawingToolbar
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

      <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
```

**Step 3: Update MicroscopeView**

Modify: `src/pages/MicroscopeView.tsx`
```tsx
import CameraFeed from '@/components/camera/CameraFeed';
import AnnotationCanvas from '@/components/annotations/AnnotationCanvas';

export default function MicroscopeView() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CameraFeed />
      <AnnotationCanvas />
    </div>
  );
}
```

**Step 4: Test annotations**

Run: `npm run dev`
Expected: Can draw, add text, change colors/sizes, undo, clear

**Step 5: Commit annotation canvas**

```bash
git add src/components/annotations/ src/pages/MicroscopeView.tsx
git commit -m "feat: add AnnotationCanvas with drawing tools"
```

---

### Task 13: Screenshot Capture

**Files:**
- Create: `src/lib/capture.ts`
- Create: `src/components/capture/CaptureControls.tsx`

**Step 1: Create capture utility**

Create: `src/lib/capture.ts`
```typescript
export async function captureVideoFrame(
  videoElement: HTMLVideoElement
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(videoElement, 0, 0);

  return canvas.toDataURL('image/png');
}

export async function mergeCanvasWithImage(
  imageData: string,
  fabricCanvas: fabric.Canvas
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw base image
      ctx.drawImage(img, 0, 0);

      // Draw annotations on top
      const annotationsData = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
      });

      const annotationsImg = new Image();
      annotationsImg.onload = () => {
        ctx.drawImage(annotationsImg, 0, 0, img.width, img.height);
        resolve(canvas.toDataURL('image/png'));
      };
      annotationsImg.onerror = reject;
      annotationsImg.src = annotationsData;
    };
    img.onerror = reject;
    img.src = imageData;
  });
}

export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function generateThumbnail(dataUrl: string, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
```

**Step 2: Create CaptureControls component**

Create: `src/components/capture/CaptureControls.tsx`
```tsx
import { Button } from '@/components/ui/button';
import { Camera, Save, Download } from 'lucide-react';
import { useState } from 'react';

interface CaptureControlsProps {
  onCapture: () => Promise<void>;
  onSave: () => Promise<void>;
  onDownload: () => void;
  canCapture: boolean;
  canSave: boolean;
}

export default function CaptureControls({
  onCapture,
  onSave,
  onDownload,
  canCapture,
  canSave,
}: CaptureControlsProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      await onCapture();
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleCapture}
        disabled={!canCapture || isCapturing}
        className="gap-2"
      >
        <Camera className="w-4 h-4" />
        {isCapturing ? 'Capturing...' : 'Capture Screenshot'}
      </Button>

      <Button
        onClick={handleSave}
        disabled={!canSave || isSaving}
        variant="secondary"
        className="gap-2"
      >
        <Save className="w-4 h-4" />
        {isSaving ? 'Saving...' : 'Save to Library'}
      </Button>

      <Button
        onClick={onDownload}
        disabled={!canSave}
        variant="outline"
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        Download
      </Button>
    </div>
  );
}
```

**Step 3: Commit capture utilities**

```bash
git add src/lib/capture.ts src/components/capture/
git commit -m "feat: add screenshot capture and image utilities"
```

---

### Task 14: Integrate Screenshot Capture in Microscope View

**Files:**
- Modify: `src/pages/MicroscopeView.tsx`

**Step 1: Add capture logic to MicroscopeView**

Modify: `src/pages/MicroscopeView.tsx`
```tsx
import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import CameraFeed from '@/components/camera/CameraFeed';
import AnnotationCanvas from '@/components/annotations/AnnotationCanvas';
import CaptureControls from '@/components/capture/CaptureControls';
import { captureVideoFrame, mergeCanvasWithImage, downloadImage, generateThumbnail } from '@/lib/capture';
import { storage } from '@/lib/storage';
import { Specimen } from '@/types/specimen';
import { useToast } from '@/hooks/use-toast';

export default function MicroscopeView() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const { toast } = useToast();

  const handleCapture = async () => {
    if (!videoRef.current) {
      toast({
        title: 'Error',
        description: 'No camera feed available',
        variant: 'destructive',
      });
      return;
    }

    try {
      const imageData = await captureVideoFrame(videoRef.current);
      setCapturedImage(imageData);

      toast({
        title: 'Success',
        description: 'Screenshot captured',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to capture screenshot',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!capturedImage) return;

    try {
      let finalImage = capturedImage;

      // Merge with annotations if any exist
      if (fabricCanvasRef.current && annotations) {
        finalImage = await mergeCanvasWithImage(capturedImage, fabricCanvasRef.current);
      }

      const thumbnail = await generateThumbnail(finalImage);

      const specimen: Specimen = {
        id: uuidv4(),
        name: `Specimen ${new Date().toLocaleString()}`,
        capturedAt: new Date(),
        imageUrl: finalImage,
        annotations: annotations ? [annotations] : [],
        syncedToCloud: false,
      };

      storage.addSpecimen(specimen);

      toast({
        title: 'Success',
        description: 'Specimen saved to library',
      });

      // Reset for next capture
      setCapturedImage(null);
      setAnnotations(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save specimen',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    if (capturedImage) {
      downloadImage(capturedImage, `specimen-${Date.now()}.png`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CameraFeed onImageCapture={setCapturedImage} />

        {capturedImage && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Captured Image</h3>
            <img src={capturedImage} alt="Captured" className="w-full rounded-lg" />
          </div>
        )}
      </div>

      {capturedImage && (
        <>
          <AnnotationCanvas onAnnotationsChange={setAnnotations} />

          <CaptureControls
            onCapture={handleCapture}
            onSave={handleSave}
            onDownload={handleDownload}
            canCapture={true}
            canSave={!!capturedImage}
          />
        </>
      )}
    </div>
  );
}
```

**Step 2: Add Toaster component**

Run: `npx shadcn-ui@latest add toast`

Modify: `src/App.tsx` to include Toaster:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import MicroscopeView from './pages/MicroscopeView';
import LibraryView from './pages/LibraryView';
import NotFound from './pages/NotFound';
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MicroscopeView />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Layout>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
```

**Step 3: Test capture flow**

Run: `npm run dev`
Expected: Can capture screenshot, annotate, save to library

**Step 4: Commit capture integration**

```bash
git add src/pages/MicroscopeView.tsx src/App.tsx
git commit -m "feat: integrate screenshot capture with annotations in MicroscopeView"
```

---

### Task 15: Specimen Library Hook

**Files:**
- Create: `src/hooks/useSpecimens.ts`

**Step 1: Create specimens hook**

Create: `src/hooks/useSpecimens.ts`
```typescript
import { useState, useEffect, useCallback } from 'react';
import { Specimen } from '@/types/specimen';
import { storage } from '@/lib/storage';

export function useSpecimens() {
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load specimens from storage
  const loadSpecimens = useCallback(() => {
    setIsLoading(true);
    try {
      const data = storage.getData();
      setSpecimens(data.specimens);
    } catch (error) {
      console.error('Error loading specimens:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSpecimens();
  }, [loadSpecimens]);

  // Filter specimens by search query
  const filteredSpecimens = specimens.filter(specimen =>
    specimen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    specimen.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    specimen.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Delete specimen
  const deleteSpecimen = useCallback((id: string) => {
    storage.deleteSpecimen(id);
    loadSpecimens();
  }, [loadSpecimens]);

  // Update specimen
  const updateSpecimen = useCallback((id: string, updates: Partial<Specimen>) => {
    storage.updateSpecimen(id, updates);
    loadSpecimens();
  }, [loadSpecimens]);

  return {
    specimens: filteredSpecimens,
    allSpecimens: specimens,
    isLoading,
    searchQuery,
    setSearchQuery,
    deleteSpecimen,
    updateSpecimen,
    reload: loadSpecimens,
  };
}
```

**Step 2: Commit specimens hook**

```bash
git add src/hooks/useSpecimens.ts
git commit -m "feat: add useSpecimens hook for library management"
```

---

### Task 16: Specimen Library Components

**Files:**
- Create: `src/components/library/SpecimenCard.tsx`, `src/components/library/SpecimenGrid.tsx`, `src/components/library/SearchBar.tsx`

**Step 1: Create SearchBar**

Create: `src/components/library/SearchBar.tsx`
```tsx
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      <Input
        type="text"
        placeholder="Search specimens..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}
```

**Step 2: Create SpecimenCard**

Create: `src/components/library/SpecimenCard.tsx`
```tsx
import { Specimen } from '@/types/specimen';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { downloadImage } from '@/lib/capture';

interface SpecimenCardProps {
  specimen: Specimen;
  onDelete: (id: string) => void;
  onClick: (specimen: Specimen) => void;
}

export default function SpecimenCard({ specimen, onDelete, onClick }: SpecimenCardProps) {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadImage(specimen.imageUrl, `${specimen.name}.png`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${specimen.name}"?`)) {
      onDelete(specimen.id);
    }
  };

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onClick(specimen)}>
      <CardHeader className="p-0">
        <img
          src={specimen.imageUrl}
          alt={specimen.name}
          className="w-full h-48 object-cover rounded-t-lg"
        />
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg truncate">{specimen.name}</CardTitle>
        {specimen.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{specimen.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary">{format(specimen.capturedAt, 'MMM d, yyyy')}</Badge>
          {specimen.syncedToCloud && <Badge variant="outline">Synced</Badge>}
        </div>
        {specimen.tags && specimen.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {specimen.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button size="sm" variant="outline" onClick={handleDownload} className="flex-1">
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
        <Button size="sm" variant="destructive" onClick={handleDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**Step 3: Create SpecimenGrid**

Create: `src/components/library/SpecimenGrid.tsx`
```tsx
import { Specimen } from '@/types/specimen';
import SpecimenCard from './SpecimenCard';

interface SpecimenGridProps {
  specimens: Specimen[];
  onDelete: (id: string) => void;
  onSelect: (specimen: Specimen) => void;
}

export default function SpecimenGrid({ specimens, onDelete, onSelect }: SpecimenGridProps) {
  if (specimens.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No specimens found</p>
        <p className="text-sm text-gray-400 mt-2">Capture your first specimen in the Microscope view</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {specimens.map(specimen => (
        <SpecimenCard
          key={specimen.id}
          specimen={specimen}
          onDelete={onDelete}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}
```

**Step 4: Commit library components**

```bash
git add src/components/library/
git commit -m "feat: add specimen library components (Card, Grid, SearchBar)"
```

---

### Task 17: Implement Library View

**Files:**
- Modify: `src/pages/LibraryView.tsx`
- Create: `src/components/library/SpecimenDetailDialog.tsx`

**Step 1: Create SpecimenDetailDialog**

Create: `src/components/library/SpecimenDetailDialog.tsx`
```tsx
import { Specimen } from '@/types/specimen';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { downloadImage } from '@/lib/capture';
import { useState } from 'react';

interface SpecimenDetailDialogProps {
  specimen: Specimen | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Specimen>) => void;
}

export default function SpecimenDetailDialog({
  specimen,
  open,
  onClose,
  onUpdate,
}: SpecimenDetailDialogProps) {
  const [name, setName] = useState(specimen?.name || '');
  const [description, setDescription] = useState(specimen?.description || '');

  const handleSave = () => {
    if (specimen) {
      onUpdate(specimen.id, { name, description });
      onClose();
    }
  };

  if (!specimen) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Specimen Details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <img
              src={specimen.imageUrl}
              alt={specimen.name}
              className="w-full rounded-lg border"
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description..."
              />
            </div>

            <div>
              <Label>Captured</Label>
              <p className="text-sm text-gray-600">
                {format(specimen.capturedAt, 'MMMM d, yyyy h:mm a')}
              </p>
            </div>

            <div>
              <Label>Annotations</Label>
              <p className="text-sm text-gray-600">
                {specimen.annotations.length} annotation(s)
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadImage(specimen.imageUrl, `${specimen.name}.png`)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Implement LibraryView**

Modify: `src/pages/LibraryView.tsx`
```tsx
import { useState } from 'react';
import { useSpecimens } from '@/hooks/useSpecimens';
import SearchBar from '@/components/library/SearchBar';
import SpecimenGrid from '@/components/library/SpecimenGrid';
import SpecimenDetailDialog from '@/components/library/SpecimenDetailDialog';
import { Specimen } from '@/types/specimen';

export default function LibraryView() {
  const {
    specimens,
    searchQuery,
    setSearchQuery,
    deleteSpecimen,
    updateSpecimen,
    reload,
  } = useSpecimens();

  const [selectedSpecimen, setSelectedSpecimen] = useState<Specimen | null>(null);

  const handleSelect = (specimen: Specimen) => {
    setSelectedSpecimen(specimen);
  };

  const handleClose = () => {
    setSelectedSpecimen(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Specimen Library</h1>
        <p className="text-gray-600">{specimens.length} specimen(s)</p>
      </div>

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <SpecimenGrid
        specimens={specimens}
        onDelete={deleteSpecimen}
        onSelect={handleSelect}
      />

      <SpecimenDetailDialog
        specimen={selectedSpecimen}
        open={!!selectedSpecimen}
        onClose={handleClose}
        onUpdate={updateSpecimen}
      />
    </div>
  );
}
```

**Step 3: Add label component**

Run: `npx shadcn-ui@latest add label`

**Step 4: Test library view**

Run: `npm run dev`
Expected: Can view, search, delete specimens, edit details

**Step 5: Commit library view**

```bash
git add src/pages/LibraryView.tsx src/components/library/SpecimenDetailDialog.tsx
git commit -m "feat: implement specimen library with search and detail view"
```

---

## Week 3: Polish & Demo Prep

### Task 18: Video Recording (Basic)

**Files:**
- Create: `src/hooks/useVideoRecorder.ts`
- Create: `src/components/capture/VideoRecordButton.tsx`

**Step 1: Create video recorder hook**

Create: `src/hooks/useVideoRecorder.ts`
```typescript
import { useRef, useState, useCallback } from 'react';

const MAX_DURATION = 60000; // 60 seconds

export function useVideoRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<number | null>(null);

  const startRecording = useCallback(async (stream: MediaStream) => {
    try {
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        setRecordingTime(Math.floor(elapsed / 1000));

        // Auto-stop at max duration
        if (elapsed >= MAX_DURATION) {
          stopRecording();
        }
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(new Blob());
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  }, [isRecording]);

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
  };
}
```

**Step 2: Commit video recorder**

```bash
git add src/hooks/useVideoRecorder.ts
git commit -m "feat: add basic video recording with 60s limit"
```

---

### Task 19: Supabase Sync Logic

**Files:**
- Create: `src/lib/sync.ts`

**Step 1: Create sync utility**

Create: `src/lib/sync.ts`
```typescript
import { supabase } from './supabase';
import { storage } from './storage';
import { Specimen } from '@/types/specimen';

export async function uploadImage(file: Blob, filename: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('specimen-images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from('specimen-images')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

export async function syncSpecimen(specimen: Specimen): Promise<boolean> {
  try {
    // Upload image if it's base64
    let imageUrl = specimen.imageUrl;
    if (imageUrl.startsWith('data:')) {
      const blob = await fetch(imageUrl).then(r => r.blob());
      const filename = `${specimen.id}.png`;
      const uploadedUrl = await uploadImage(blob, filename);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      }
    }

    // Insert into database
    const { error } = await supabase
      .from('specimens')
      .insert({
        id: specimen.id,
        name: specimen.name,
        description: specimen.description,
        captured_at: specimen.capturedAt.toISOString(),
        image_url: imageUrl,
        video_url: specimen.videoUrl,
        annotations: specimen.annotations,
        tags: specimen.tags,
      });

    if (error) throw error;

    // Mark as synced in localStorage
    storage.updateSpecimen(specimen.id, { syncedToCloud: true });

    return true;
  } catch (error) {
    console.error('Error syncing specimen:', error);
    return false;
  }
}

export async function syncAllPending(): Promise<number> {
  const data = storage.getData();
  const pending = data.specimens.filter(s => !s.syncedToCloud);

  let synced = 0;
  for (const specimen of pending) {
    const success = await syncSpecimen(specimen);
    if (success) synced++;
  }

  return synced;
}
```

**Step 2: Commit sync logic**

```bash
git add src/lib/sync.ts
git commit -m "feat: add Supabase sync for specimens and images"
```

---

### Task 20: Error Boundaries

**Files:**
- Create: `src/components/ErrorBoundary.tsx`

**Step 1: Create error boundary**

Create: `src/components/ErrorBoundary.tsx`
```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">{this.state.error?.message}</p>
              <Button onClick={this.handleReset}>Go to Home</Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Step 2: Wrap App with ErrorBoundary**

Modify: `src/main.tsx`
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
```

**Step 3: Commit error boundary**

```bash
git add src/components/ErrorBoundary.tsx src/main.tsx
git commit -m "feat: add error boundary for graceful error handling"
```

---

### Task 21: Deployment Setup (Vercel)

**Files:**
- Create: `vercel.json`, `.env.production`

**Step 1: Create Vercel config**

Create: `vercel.json`
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

**Step 2: Update package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  }
}
```

**Step 3: Create production env template**

Create: `.env.production`
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Step 4: Deploy to Vercel**

1. Push code to GitHub
2. Go to https://vercel.com
3. Import GitHub repository
4. Add environment variables from Supabase
5. Deploy

**Step 5: Commit deployment config**

```bash
git add vercel.json .env.production package.json
git commit -m "chore: add Vercel deployment configuration"
```

---

### Task 22: Demo Preparation

**Files:**
- Create: `docs/DEMO.md`

**Step 1: Create demo documentation**

Create: `docs/DEMO.md`
```markdown
# Demo Day Preparation

## Pre-Demo Checklist (Day Before)

### Technical Setup
- [ ] Clear localStorage to start fresh
- [ ] Pre-load 3-5 impressive specimen samples
- [ ] Test camera on presentation device
- [ ] Test mobile browser (phone)
- [ ] Verify Supabase sync works
- [ ] Test offline mode (airplane mode)

### Device Testing
- [ ] Desktop Chrome (primary)
- [ ] Mobile Safari (iPhone)
- [ ] Projector/screen mirroring works
- [ ] All features work on both devices

### Backup Plans
- [ ] Screen recording of full demo (5 minutes)
- [ ] Screenshots of key features
- [ ] Offline mode enabled
- [ ] Sample specimens saved locally

## Demo Script (5 Minutes)

### 1. Introduction (30 seconds)
"This is the Smart Microscopy System - a web-based tool that lets students view specimens through any camera, annotate images, and maintain a digital specimen library."

### 2. Camera Feed (1 minute)
- Open app on desktop
- Click "Start Camera"
- Show camera switching (if multiple cameras)
- Show it works on mobile (open on phone)

### 3. Capture & Annotate (2 minutes)
- Capture screenshot of specimen
- Use drawing tools (pen, colors, sizes)
- Add text labels
- Undo/redo demonstration
- Save to library

### 4. Specimen Library (1 minute)
- Navigate to Library
- Show grid of specimens
- Search functionality
- Click specimen to view details
- Edit name/description
- Download specimen

### 5. Offline & Sync (30 seconds)
- Show offline indicator
- Explain offline-first approach
- Show sync status

### 6. Closing (30 seconds)
- Recap features
- Future improvements (ESP-32Cam, AI identification)
- Questions

## Talking Points

### Why This Matters
- Students need affordable microscopy tools
- Works on any device with a camera
- No expensive hardware required for basic work
- Builds foundational digital lab skills

### Technical Highlights
- Offline-first architecture
- Mobile-responsive design
- Modern web technologies
- Free and open-source

### Future Vision
- ESP-32Cam integration for dedicated microscope
- AI-powered specimen identification
- Classroom collaboration features
- Export to PDF reports

## Troubleshooting During Demo

### If camera doesn't load:
- Use pre-loaded specimens instead
- Show file upload feature
- Fall back to mobile device

### If annotations lag:
- Use pre-annotated specimens
- Show simpler drawings

### If WiFi fails:
- Great opportunity to demo offline mode!
- Everything works without internet

### If nothing works:
- Play screen recording backup
- Walk through screenshots
```

**Step 2: Commit demo doc**

```bash
git add docs/DEMO.md
git commit -m "docs: add demo day preparation guide"
```

---

### Task 23: Final Testing & Bug Fixes

**Step 1: Run full test checklist**

Test on:
- Desktop Chrome
- Mobile Chrome (DevTools device mode)
- Mobile Safari (real device if available)

Test scenarios:
1. Camera → Capture → Annotate → Save → View in Library
2. Upload file → Annotate → Save
3. Search library
4. Edit specimen details
5. Delete specimen
6. Offline mode (disable network in DevTools)
7. Storage quota check

**Step 2: Fix any blocking bugs**

Priority fixes only:
- Camera not loading → Add retry button
- Annotations not saving → Debug localStorage
- Library empty → Check data format
- Mobile layout broken → Fix responsive CSS

**Step 3: Performance optimization**

- Lazy load images in library
- Debounce search input
- Optimize image compression

**Step 4: Commit bug fixes**

```bash
git add .
git commit -m "fix: resolve blocking bugs and optimize performance for demo"
```

---

### Task 24: Create Sample Specimens

**Step 1: Prepare impressive specimens**

Create 5 sample specimens with:
1. Onion cells (clear cell walls)
2. Leaf cross-section (chloroplasts visible)
3. Pond water (microorganisms)
4. Human cheek cells
5. Prepared slide (commercial)

**Step 2: Annotate samples**

For each:
- Add colored annotations highlighting key structures
- Add text labels (e.g., "Cell wall", "Nucleus")
- Use multiple colors for different structures
- Save to library

**Step 3: Export samples**

Download each as backup PNG files

**Step 4: Document sample creation**

Add to `docs/DEMO.md`:
```markdown
## Sample Specimens

1. **Onion Cells** - Red/blue annotations showing cell walls and nuclei
2. **Leaf Section** - Green annotations highlighting chloroplasts
3. **Pond Water** - Various colors for different microorganisms
4. **Cheek Cells** - Yellow annotations showing cell membranes
5. **Prepared Slide** - Professional specimen with detailed labels
```

---

### Task 25: Final Commit & Tag

**Step 1: Update README**

Create: `README.md`
```markdown
# Smart Microscopy System

A web-based smart microscopy system for biology students to view specimens, annotate images, and maintain a digital specimen library.

## Features

- 📷 Camera feed from webcam or mobile device
- ✏️ Drawing annotations (pen, text, colors)
- 📚 Specimen library with search
- 📸 Screenshot capture with annotations
- 🎥 Basic video recording (60s max)
- 💾 Offline-first with cloud sync
- 📱 Mobile responsive

## Tech Stack

- React 18 + Vite + TypeScript
- TailwindCSS + shadcn/ui
- Fabric.js (annotations)
- Supabase (backend)
- Vercel (hosting)

## Getting Started

1. Clone repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and add Supabase credentials
4. Run development server: `npm run dev`
5. Open http://localhost:5173

## Demo Day

See `docs/DEMO.md` for presentation guide.

## License

MIT
```

**Step 2: Final commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README"
```

**Step 3: Tag release**

```bash
git tag -a v1.0.0-demo -m "Demo Day Release - MVP Features Complete"
git push origin main --tags
```

---

## Plan Complete! 🎉

**Summary:**
- ✅ Week 1: Foundation (Vite, React, Supabase, Layout)
- ✅ Week 2: Core Features (Camera, Annotations, Library, Screenshots)
- ✅ Week 3: Polish (Video, Sync, Error Handling, Demo Prep)

**Total Tasks:** 25
**Estimated Time:** 3 weeks (solo development)

**Next Step:** Execute this plan task-by-task using the executing-plans skill.
