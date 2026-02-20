# Deployment Guide

## Deploying to Vercel

### Prerequisites
- GitHub account
- Vercel account (free tier works)
- Supabase project with:
  - `specimens` table created
  - `specimen-images` storage bucket
  - `specimen-videos` storage bucket
  - Public access enabled on buckets (for demo)

### Step 1: Push to GitHub
```bash
# Make sure all changes are committed
git push origin feature/mvp-implementation

# Merge to main branch (or create PR)
git checkout main
git merge feature/mvp-implementation
git push origin main
```

### Step 2: Import to Vercel
1. Go to [https://vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Framework preset should auto-detect as "Vite"

### Step 3: Configure Environment Variables
Add these environment variables in Vercel project settings:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

You can find these in:
Supabase Dashboard → Settings → API

### Step 4: Deploy
Click "Deploy" - Vercel will:
1. Install dependencies
2. Run TypeScript compiler
3. Build with Vite
4. Deploy to CDN

### Step 5: Verify
After deployment:
- Test camera access (requires HTTPS)
- Test image capture and annotation
- Test specimen library
- Test cloud sync with Supabase
- Test video recording (if browser supports)

## Environment Variables

### Development (.env.local)
```env
VITE_SUPABASE_URL=your_dev_supabase_url
VITE_SUPABASE_ANON_KEY=your_dev_supabase_key
```

### Production (Vercel Dashboard)
Set the same variables in Vercel project settings under "Environment Variables"

## Build Locally
```bash
npm run build
npm run preview
```

## Troubleshooting

### Camera not working
- Ensure site is served over HTTPS (Vercel provides this)
- Check browser permissions

### Sync not working
- Verify Supabase environment variables
- Check Supabase storage buckets are public
- Check RLS policies allow public insert (for demo)

### Build fails
- Check TypeScript errors: `npm run lint`
- Verify all dependencies installed: `npm install`
- Check Node version: `node -v` (should be 18+)

## Post-Deployment

### Update DNS (Optional)
In Vercel:
- Settings → Domains
- Add custom domain
- Follow DNS configuration steps

### Monitor
- Check Vercel Analytics
- Monitor Supabase usage
- Check browser console for errors

## Rollback
If deployment has issues:
1. Go to Vercel project
2. Click "Deployments"
3. Find previous working deployment
4. Click "..." → "Promote to Production"
