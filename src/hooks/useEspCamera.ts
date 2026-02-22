import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 3000;

interface UseEspCameraOptions {
  /** IP address entered by the presenter, e.g. "192.168.1.105" */
  ip: string;
  /** Set to true when "ESP32-CAM" is selected as camera source */
  enabled: boolean;
}

export interface UseEspCameraResult {
  /** Blob URL of the latest captured frame, or null before first frame */
  currentFrame: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  /** Human-readable error message, or null when healthy */
  error: string | null;
  /** Test reachability + CORS for a given IP. Sets isConnected on success. */
  testConnection: (ip: string) => Promise<boolean>;
}

export function useEspCamera({ ip, enabled }: UseEspCameraOptions): UseEspCameraResult {
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep previous Blob URL alive for 1 s so any in-flight canvas drawImage finishes
  const prevUrlRef = useRef<string | null>(null);
  // Ref mirror of isConnected so poll() can check it without being in effect deps
  const isConnectedRef = useRef(false);

  // ── Connection test (called by the "Test" button) ──────────────────────────
  const testConnection = useCallback(async (testIp: string): Promise<boolean> => {
    setIsConnecting(true);
    setError(null);
    try {
      const res = await fetch(`http://${testIp}/capture`, {
        mode: 'cors',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('image')) throw new Error('Not an image response');
      setIsConnected(true);
      setIsConnecting(false);
      return true;
    } catch (err: any) {
      const isCors =
        err?.message === 'Failed to fetch' || err?.name === 'TypeError';
      setError(
        isCors
          ? 'CORS blocked. Add to capture_handler in app_httpd.cpp:\n' +
            'httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");'
          : 'Cannot reach ESP32. Check IP and confirm same WiFi.'
      );
      setIsConnected(false);
      setIsConnecting(false);
      return false;
    }
  }, []);

  // ── Frame polling ──────────────────────────────────────────────────────────
  // Keep ref in sync so poll() sees the latest value without re-running the effect
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  useEffect(() => {
    if (!enabled || !ip || !isConnected) return;

    const poll = async () => {
      // Skip tick if a mid-interval disconnect has already occurred
      if (!isConnectedRef.current) return;
      try {
        const res = await fetch(`http://${ip}/capture`, {
          mode: 'cors',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
          setIsConnected(false);
          setError('ESP32 stream interrupted. Reconnect or re-test.');
          return;
        }
        const blob = await res.blob();
        const newUrl = URL.createObjectURL(blob);

        // Schedule revocation of previous URL after 1 s
        const old = prevUrlRef.current;
        if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);

        prevUrlRef.current = newUrl;
        setCurrentFrame(newUrl);
      } catch {
        setIsConnected(false);
        setError('ESP32 stream interrupted. Reconnect or re-test.');
      }
    };

    poll(); // immediate first frame
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Revoke last URL on cleanup — capture value before nulling the ref
      const lastUrl = prevUrlRef.current;
      prevUrlRef.current = null;
      if (lastUrl) setTimeout(() => URL.revokeObjectURL(lastUrl), 1000);
      // Do NOT null currentFrame — keep last frame visible until next connection
    };
  }, [enabled, ip, isConnected]);

  // Reset connected state when IP changes
  useEffect(() => {
    setIsConnected(false);
    setError(null);
  }, [ip]);

  return { currentFrame, isConnected, isConnecting, error, testConnection };
}
