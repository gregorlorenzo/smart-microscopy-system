import { supabase } from './supabase';
import { storage } from './storage';
import { Specimen } from '@/types/specimen';

/**
 * Upload an image blob to Supabase Storage
 */
export async function uploadImage(file: Blob, filename: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('specimen-images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: true,
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

/**
 * Upload a video blob to Supabase Storage
 */
export async function uploadVideo(file: Blob, filename: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('specimen-videos')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from('specimen-videos')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (error) {
    console.error('Error uploading video:', error);
    return null;
  }
}

/**
 * Sync a single specimen to Supabase
 */
export async function syncSpecimen(specimen: Specimen): Promise<boolean> {
  try {
    // Upload image if it's base64 (data URL)
    let imageUrl = specimen.imageUrl;
    if (imageUrl.startsWith('data:')) {
      const blob = await fetch(imageUrl).then(r => r.blob());
      const filename = `${specimen.id}.jpg`;
      const uploadedUrl = await uploadImage(blob, filename);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        throw new Error('Failed to upload image');
      }
    }

    // Upload video if it exists and is base64
    let videoUrl = specimen.videoUrl;
    if (videoUrl && videoUrl.startsWith('data:')) {
      const blob = await fetch(videoUrl).then(r => r.blob());
      const filename = `${specimen.id}.webm`;
      const uploadedUrl = await uploadVideo(blob, filename);
      if (uploadedUrl) {
        videoUrl = uploadedUrl;
      } else {
        console.warn('Failed to upload video, continuing without it');
        videoUrl = undefined;
      }
    }

    // Insert or update in database
    const deviceId = await storage.getDeviceId();
    const { error } = await supabase
      .from('specimens')
      .upsert({
        id: specimen.id,
        user_id: deviceId,
        name: specimen.name,
        description: specimen.description,
        captured_at: specimen.capturedAt.toISOString(),
        image_url: imageUrl,
        video_url: videoUrl || null,
        annotations: specimen.annotations,
        tags: specimen.tags || [],
      });

    if (error) throw error;

    // Mark as synced in IndexedDB
    await storage.updateSpecimen(specimen.id, { syncedToCloud: true });

    return true;
  } catch (error) {
    console.error('Error syncing specimen:', error);
    return false;
  }
}

/**
 * Sync all pending specimens to Supabase
 */
export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  const specimens = await storage.getSpecimens();
  const pending = specimens.filter(s => !s.syncedToCloud);

  let synced = 0;
  let failed = 0;

  for (const specimen of pending) {
    const success = await syncSpecimen(specimen);
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Conflict resolution strategy: "last write wins" based on updated_at timestamp
 */
function resolveConflict(local: Specimen, cloud: any): Specimen {
  // If cloud has updated_at timestamp and it's newer, use cloud version
  const cloudUpdated = cloud.updated_at ? new Date(cloud.updated_at) : new Date(cloud.captured_at);
  const localUpdated = local.capturedAt; // Using captured_at as proxy for updated

  if (cloudUpdated > localUpdated) {
    // Cloud metadata wins, but keep local binary data if already downloaded
    return {
      id: cloud.id,
      name: cloud.name,
      description: cloud.description,
      capturedAt: new Date(cloud.captured_at),
      // Prefer local data URL over remote storage URL — avoids replacing
      // working local image data with a remote reference to the same file
      imageUrl: local.imageUrl.startsWith('data:') ? local.imageUrl : cloud.image_url,
      videoUrl: local.videoUrl ?? cloud.video_url,
      annotations: cloud.annotations || [],
      tags: cloud.tags || [],
      syncedToCloud: true,
    };
  }

  // Local is newer or same, keep local version
  return local;
}

/**
 * Pull specimens from Supabase to IndexedDB with conflict resolution
 */
export async function pullFromCloud(): Promise<{ imported: number; updated: number }> {
  try {
    const deviceId = await storage.getDeviceId();
    const { data: cloudSpecimens, error } = await supabase
      .from('specimens')
      .select('*')
      .eq('user_id', deviceId)
      .order('captured_at', { ascending: false });

    if (error) throw error;

    if (!cloudSpecimens) return { imported: 0, updated: 0 };

    const localSpecimens = await storage.getSpecimens();
    let imported = 0;
    let updated = 0;

    for (const cloudSpec of cloudSpecimens) {
      // Check if specimen already exists locally
      const existing = localSpecimens.find(s => s.id === cloudSpec.id);

      if (!existing) {
        // New specimen - import it
        const specimen: Specimen = {
          id: cloudSpec.id,
          name: cloudSpec.name,
          description: cloudSpec.description,
          capturedAt: new Date(cloudSpec.captured_at),
          imageUrl: cloudSpec.image_url,
          videoUrl: cloudSpec.video_url,
          annotations: cloudSpec.annotations || [],
          tags: cloudSpec.tags || [],
          syncedToCloud: true,
        };

        await storage.addSpecimen(specimen);
        imported++;
      } else {
        // Conflict - resolve using "last write wins"
        const resolved = resolveConflict(existing, cloudSpec);

        // Only update if resolved version is different from local
        if (resolved !== existing) {
          await storage.updateSpecimen(cloudSpec.id, resolved);
          updated++;
        }
      }
    }

    return { imported, updated };
  } catch (error) {
    console.error('Error pulling from cloud:', error);
    return { imported: 0, updated: 0 };
  }
}

/**
 * Check if user is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}
