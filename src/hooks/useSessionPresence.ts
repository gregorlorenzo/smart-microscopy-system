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

// Small delay before subscribing to presence.
// When navigating between pages (lobby → stream), the previous page's presence channel
// needs time to fully clean up on the Supabase server.  Without this delay the server
// sees a rapid leave → rejoin on the same channel name and responds with TIMED_OUT.
const SUBSCRIBE_DELAY_MS = 600;

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

    // Delay channel creation so that any previous channel with the same name
    // (e.g. from the lobby page we just navigated away from) has time to be
    // fully removed on the Supabase server.
    const timerId = setTimeout(() => {
      const channel = supabase.channel(`session-presence:${sessionCode}`);
      channelRef.current = channel;

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

      channel.subscribe(async (status, err) => {
        if (err) {
          console.error('[SessionPresence] Subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('[SessionPresence] Channel subscribed');
          await channel.track({
            name: participantName,
            role,
            sessionName: role === 'presenter' ? sessionName : undefined,
          });
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          console.error(`[SessionPresence] Channel ${status}`);
        }
      });
    }, SUBSCRIBE_DELAY_MS);

    return () => {
      clearTimeout(timerId);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionCode, participantName, role, sessionName]);

  return { participants, resolvedSessionName };
}
