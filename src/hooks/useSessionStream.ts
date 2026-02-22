import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Frame settings — must match the annotation canvas dimensions (CANVAS_W/H in SessionStreamPage)
// so that annotation coordinates map 1:1 onto the broadcast frame.
// 800×600 JPEG at 0.5 quality ≈ 50–100 KB, well within Supabase's 2 MB limit.
const FRAME_INTERVAL_MS = 500; // 2fps — sufficient for mostly-static specimens
const BROADCAST_WIDTH = 800;  // matches CANVAS_W
const BROADCAST_HEIGHT = 600; // matches CANVAS_H
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
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!sessionCode) return;

    isSubscribedRef.current = false;

    const channel = supabase.channel(`session-stream:${sessionCode}`, {
      config: { broadcast: { self: false } },
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
        if (role === 'viewer') {
          setIsPresenterStreaming(false);
          setCurrentFrame(null);
        }
      });

    channel.subscribe((status, err) => {
      if (err) {
        console.error('[SessionStream] Channel subscription error:', err);
        return;
      }
      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true;
        console.log('[SessionStream] Channel subscribed via WebSocket');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[SessionStream] Channel failed:', status);
      }
    });

    channelRef.current = channel;

    return () => {
      isSubscribedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [sessionCode, role]);

  // Capture a single frame from the video element and broadcast it.
  // Center-crops to the target aspect ratio before scaling so that annotation
  // coordinates (which live in BROADCAST_WIDTH × BROADCAST_HEIGHT space) align
  // with the same visual content on the viewer side.
  // Note: drawImage reads raw video dimensions, unaffected by CSS object-fit.
  const broadcastFrame = useCallback((videoElement: HTMLVideoElement) => {
    if (!channelRef.current || !videoElement) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = BROADCAST_WIDTH;
    offscreen.height = BROADCAST_HEIGHT;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    const vw = videoElement.videoWidth || BROADCAST_WIDTH;
    const vh = videoElement.videoHeight || BROADCAST_HEIGHT;
    const targetAspect = BROADCAST_WIDTH / BROADCAST_HEIGHT;
    const videoAspect = vw / vh;

    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (videoAspect > targetAspect) {
      // Video wider than target: crop left and right equally
      sw = vh * targetAspect;
      sx = (vw - sw) / 2;
    } else if (videoAspect < targetAspect) {
      // Video taller than target: crop top and bottom equally
      sh = vw / targetAspect;
      sy = (vh - sh) / 2;
    }

    ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, BROADCAST_WIDTH, BROADCAST_HEIGHT);
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
