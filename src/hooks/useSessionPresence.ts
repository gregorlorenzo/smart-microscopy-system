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
