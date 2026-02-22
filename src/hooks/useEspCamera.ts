import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 500;
/**
 * Raised from 3 s → 8 s so high-resolution JPEG captures
 * (OV3660 QXGA etc.) don't time-out before the ESP32 responds.
 */
const TIMEOUT_MS = 8000;

/**
 * Normalise whatever the user typed into a full base URL:
 *   "192.168.1.28"                → "http://192.168.1.28"
 *   "192.168.1.28:80"             → "http://192.168.1.28:80"
 *   "https://abc.ngrok-free.app"  → "https://abc.ngrok-free.app"
 */
function buildBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Mirror the host page's protocol so bare hostnames work without typing a scheme
  const defaultScheme =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'https'
      : 'http';
  return `${defaultScheme}://${trimmed}`;
}

/**
 * Build the fetch URL for /capture.
 *
 * On Vercel (HTTPS) we route through `/api/esp32-proxy` which fetches
 * the ESP32 server-side — this bypasses both CORS and ngrok's free-tier
 * HTML interstitial page.
 *
 * On localhost (HTTP) we hit the ESP32 directly.
 */
function captureUrl(baseUrl: string): string {
  const isProduction =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  if (isProduction) {
    return `/api/esp32-proxy?url=${encodeURIComponent(`${baseUrl}/capture`)}`;
  }
  return `${baseUrl}/capture`;
}

interface UseEspCameraOptions {
  /**
   * IP address OR full URL entered by the presenter.
   * Examples:
   *   "192.168.1.28"                  (local network, use from local http:// page)
   *   "https://abc.ngrok-free.app"    (ngrok tunnel, works from Vercel HTTPS)
   */
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
      const base = buildBaseUrl(testIp);
      const url = captureUrl(base);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('image')) {
        // Try to read error details from the proxy response
        try {
          const errBody = await res.json();
          throw new Error(errBody?.error ?? errBody?.body_preview ?? 'Not an image response');
        } catch (e: any) {
          if (e.message && e.message !== 'Not an image response') throw e;
          throw new Error('Not an image response');
        }
      }
      setIsConnected(true);
      setIsConnecting(false);
      return true;
    } catch (err: any) {
      const isNetworkBlock =
        err?.message === 'Failed to fetch' || err?.name === 'TypeError';
      setError(
        isNetworkBlock
          ? 'Cannot reach ESP32. Check IP/URL and confirm same WiFi, or use an ngrok tunnel.'
          : `Cannot reach ESP32: ${err?.message ?? 'Unknown error'}`,
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
        const base = buildBaseUrl(ip);
        const url = captureUrl(base);
        const res = await fetch(url, {
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
