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
        if (role === 'viewer') {
          setIsPresenterStreaming(false);
          setCurrentFrame(null);
        }
      });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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
