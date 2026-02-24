import { useCallback, useEffect, useRef, useState } from 'react';

const TEST_TIMEOUT_MS = 15000;  // first capture after boot can be slow
const CAPTURE_TIMEOUT_MS = 8000;

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
  const defaultScheme =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'https'
      : 'http';
  return `${defaultScheme}://${trimmed}`;
}

/**
 * Build the fetch URL for /capture.
 * On Vercel (HTTPS) we route through `/api/esp32-proxy`.
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

/**
 * Derive the MJPEG stream URL from the base URL.
 * CameraWebServer always streams on port 81 at /stream.
 * We strip any explicit port from the input and append :81/stream.
 */
function buildStreamUrl(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.hostname}:81/stream`;
  } catch {
    return `http://${baseUrl}:81/stream`;
  }
}

interface UseEspCameraOptions {
  /**
   * IP address OR full URL entered by the presenter.
   * Examples:
   *   "192.168.1.28"                  (local network)
   *   "https://abc.ngrok-free.app"    (ngrok tunnel)
   */
  ip: string;
}

export interface UseEspCameraResult {
  /**
   * MJPEG stream URL — set after testConnection succeeds, null before.
   * Use directly as <img src={streamUrl} />.
   */
  streamUrl: string | null;
  /**
   * Fetch a single JPEG still from /capture.
   * Returns a data URL, or null on failure.
   * Use for saving specimens and broadcasting frames to viewers.
   */
  captureStill: () => Promise<string | null>;
  /** Call from <img onError={onStreamError}> so the hook knows when the stream drops. */
  onStreamError: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  /** Human-readable error message, or null when healthy */
  error: string | null;
  /** Test reachability for a given IP. Sets isConnected + streamUrl on success. */
  testConnection: (ip: string) => Promise<boolean>;
}

export function useEspCamera({ ip }: UseEspCameraOptions): UseEspCameraResult {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref to the current base URL so captureStill doesn't need ip in its deps
  const baseUrlRef = useRef<string>('');

  // ── Connection test (called by the "Test" button) ──────────────────────────
  const testConnection = useCallback(async (testIp: string): Promise<boolean> => {
    setIsConnecting(true);
    setError(null);
    try {
      const base = buildBaseUrl(testIp);
      const url = captureUrl(base);
      const res = await fetch(url, { signal: AbortSignal.timeout(TEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('image')) {
        try {
          const errBody = await res.json();
          throw new Error(errBody?.error ?? errBody?.body_preview ?? 'Not an image response');
        } catch (e: any) {
          if (e.message && e.message !== 'Not an image response') throw e;
          throw new Error('Not an image response');
        }
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error('ESP32 returned an empty frame');

      baseUrlRef.current = base;
      setStreamUrl(buildStreamUrl(base));
      setIsConnected(true);
      setIsConnecting(false);
      return true;
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const isNetworkBlock =
        !isTimeout && (err?.message === 'Failed to fetch' || err?.name === 'TypeError');
      setError(
        isTimeout
          ? 'ESP32 timed out. Check the IP is correct (use Serial Monitor after reset), then try again.'
          : isNetworkBlock
          ? 'Cannot reach ESP32. Check IP/URL and confirm same WiFi, or use an ngrok tunnel.'
          : `Cannot reach ESP32: ${err?.message ?? 'Unknown error'}`,
      );
      setIsConnected(false);
      setIsConnecting(false);
      return false;
    }
  }, []);

  // ── Still capture (for saving specimens + broadcasting to viewers) ──────────
  const captureStill = useCallback(async (): Promise<string | null> => {
    if (!baseUrlRef.current) return null;
    try {
      const url = captureUrl(baseUrlRef.current);
      const res = await fetch(url, { signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS) });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size === 0 || !blob.type.includes('image')) return null;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }, []);

  // ── Stream error handler (wired to <img onError>) ───────────────────────────
  const onStreamError = useCallback(() => {
    setIsConnected(false);
    setStreamUrl(null);
    setError('ESP32 stream disconnected. Re-test to reconnect.');
  }, []);

  // ── Reset state when IP changes ─────────────────────────────────────────────
  useEffect(() => {
    setIsConnected(false);
    setStreamUrl(null);
    setError(null);
    baseUrlRef.current = '';
  }, [ip]);

  return { streamUrl, captureStill, onStreamError, isConnected, isConnecting, error, testConnection };
}
