# Demo Day Preparation

## Pre-Demo Checklist (Day Before)

### Technical Setup
- [ ] Clear localStorage to start fresh
- [ ] Pre-load 3-5 impressive specimen samples with:
  - Clear, high-quality images
  - Descriptive names and annotations
  - Relevant tags
  - At least one with video recording
- [ ] Test camera on presentation device
- [ ] Test mobile browser (phone)
- [ ] Verify Supabase sync works
- [ ] Test offline mode (airplane mode → works, then online → sync)
- [ ] Check all routes: `/`, `/library`
- [ ] Test error boundary (force an error to show recovery UI)

### Device Testing
- [ ] Desktop Chrome (primary demo device)
- [ ] Mobile Safari (iPhone) - show responsive design
- [ ] Test with external USB microscope camera (if available)

### Data Preparation
- [ ] Create 5 demo specimens with varied content:
  1. Simple cell structure (basic annotation)
  2. Complex organism (detailed text labels)
  3. Comparison sample (before/after)
  4. Video recording example
  5. Multi-tagged research sample
- [ ] Sync all to cloud
- [ ] Take screenshots for backup slides

## Demo Script (5 minutes)

### Introduction (30 seconds)
"Smart Microscopy System is a web-based tool for capturing, annotating, and cataloging microscope specimens. Built for researchers who need to document findings quickly, even offline."

### Feature Demo (3 minutes)

#### 1. Live Capture (45 seconds)
- Navigate to home page
- Start camera
- Point at specimen
- Capture screenshot
- **Key point:** Works offline, instant capture

#### 2. WYSIWYG Annotation (60 seconds)
- Switch to pen tool, choose color
- Draw annotation directly on visible specimen
- Add text label
- Demonstrate undo
- **Key point:** Real-time visual feedback, no surprises

#### 3. Save Specimen (30 seconds)
- Click "Save to Library"
- Fill in name, description, tags
- Show auto-compression notification
- Navigate to library
- **Key point:** Organized, searchable catalog

#### 4. Library Features (30 seconds)
- Show grid of specimens
- Use search (filter by tags)
- Click specimen to view details
- Show image/video tabs
- Download specimen
- **Key point:** Full specimen management

#### 5. Cloud Sync (30 seconds)
- Show sync button
- Demonstrate "Sync Both Ways"
- Show success toast with statistics
- Mention offline-first design
- **Key point:** Works offline, syncs when ready

### Closing (30 seconds)
"Built in 3 weeks using React, TypeScript, Fabric.js for annotations, and Supabase for cloud storage. Key features: offline-first, real-time annotation preview, automatic image compression, and conflict-free sync."

### Technical Highlights (if asked)
- **Stack:** React + TypeScript + Vite
- **Annotation:** Fabric.js v7 with custom canvas integration
- **Storage:** localStorage (offline) + Supabase (cloud)
- **Deployment:** Vercel with automatic HTTPS
- **Key Challenge:** WYSIWYG annotation canvas - solved by using captured image as canvas background
- **Optimization:** JPEG compression reduced storage by 70%

## Backup Plans

### If camera fails:
- Use file upload feature
- Have pre-captured images ready

### If internet fails:
- Demo offline mode (actually a feature!)
- Show localStorage working
- Explain sync happens when online

### If demo device fails:
- Have mobile phone as backup
- Works on any modern browser

## Questions to Prepare For

### Technical
**Q: Why web instead of native app?**
A: Cross-platform, no installation, works on any device with a camera and browser. Perfect for lab settings with varied equipment.

**Q: How does offline sync work?**
A: localStorage for local storage, Supabase for cloud. "Last write wins" conflict resolution based on timestamps.

**Q: What about large video files?**
A: 60-second limit on videos, localStorage quota warnings, automatic JPEG compression for images.

### Product
**Q: Who is this for?**
A: Biology students, lab researchers, educators - anyone doing microscopy who needs quick documentation.

**Q: What's next?**
A: Export to PDF, collaborative annotations, AI-powered specimen identification, batch processing.

**Q: How do you compete with ImageJ/Fiji?**
A: We don't - different use case. They're for image analysis, we're for quick field documentation and cataloging.

## Demo Environment Setup

### Option 1: Live Deployment (Recommended)
```bash
# Use Vercel production URL
https://your-app.vercel.app
```

### Option 2: Local Server
```bash
cd .worktrees/feature/mvp-implementation
npm run dev
# Access at http://localhost:5173
```

### Option 3: Preview Build
```bash
cd .worktrees/feature/mvp-implementation
npm run build
npm run preview
# Access at http://localhost:4173
```

## Day-Of Checklist

### 30 Minutes Before
- [ ] Open demo URL
- [ ] Clear localStorage (fresh start)
- [ ] Load 3 demo specimens
- [ ] Test camera
- [ ] Close unnecessary tabs/apps
- [ ] Turn off notifications
- [ ] Check internet connection
- [ ] Have backup device ready

### 5 Minutes Before
- [ ] Open demo URL in browser
- [ ] Test one quick capture
- [ ] Fullscreen browser (F11)
- [ ] Close console/dev tools
- [ ] Check audio/mic muted

### During Demo
- Speak clearly and slowly
- Don't rush - let features breathe
- Point out UI feedback (toasts, loading states)
- Smile and make eye contact
- Have fun! You built something cool!

## Post-Demo

### Share
- [ ] Share Vercel URL with audience
- [ ] Share GitHub repo (if public)
- [ ] Provide contact info for feedback

### Collect
- [ ] Gather feedback
- [ ] Note questions you couldn't answer
- [ ] Record suggested features
- [ ] Ask for test users

## Emergency Contacts
- Vercel status: https://vercel.com/status
- Supabase status: https://status.supabase.com
- Browser compatibility: https://caniuse.com

---

**Remember:** You built this in 3 weeks. Be proud. Even if something breaks, the process and learning are what matter. Good luck! 🎉
