import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 500;
/**
 * Raised from 3 s → 8 s so high-resolution JPEG captures
 * (OV3660 QXGA etc.) don't time-out before the ESP32 responds.
 */
const TIMEOUT_MS = 8000;

/**
 * Normalise whatever the user typed into a scheme-less base URL:
 *   "192.168.1.28"            → "http://192.168.1.28"
 *   "192.168.1.28:80"         → "http://192.168.1.28:80"
 *   "https://abc.ngrok-free.app" → "https://abc.ngrok-free.app"
 *
 * This lets presenters paste an ngrok HTTPS tunnel URL to bypass the
 * browser mixed-content block when the app is served from Vercel (HTTPS).
 */
function buildBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Mirror the host page's protocol so bare hostnames work without typing a scheme:
  //   On Vercel (https:)  → "bilious-…ngrok-free.app" becomes "https://bilious-…"
  //   On localhost (http:) → "192.168.1.28" stays   "http://192.168.1.28"
  const defaultScheme =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'https'
      : 'http';
  return `${defaultScheme}://${trimmed}`;
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
      const res = await fetch(`${base}/capture`, {
        mode: 'cors',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Bypasses ngrok free-tier browser interstitial page
        headers: { 'ngrok-skip-browser-warning': '1' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('image')) throw new Error('Not an image response');
      setIsConnected(true);
      setIsConnecting(false);
      return true;
    } catch (err: any) {
      const isNetworkBlock =
        err?.message === 'Failed to fetch' || err?.name === 'TypeError';
      setError(
        isNetworkBlock
          ? 'Mixed-content blocked (app is HTTPS, ESP32 is HTTP). ' +
          'Run: ngrok http 192.168.1.28:80  then paste the https:// URL here.'
          : 'Cannot reach ESP32. Check IP/URL and confirm same WiFi, or use an ngrok tunnel.'
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
        const res = await fetch(`${buildBaseUrl(ip)}/capture`, {
          mode: 'cors',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          // Bypasses ngrok free-tier browser interstitial page
          headers: { 'ngrok-skip-browser-warning': '1' },
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
