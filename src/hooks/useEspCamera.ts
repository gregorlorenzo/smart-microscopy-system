import { useCallback, useEffect, useRef, useState } from 'react';

const TEST_TIMEOUT_MS = 15000;   // first capture after boot can be slow
const CAPTURE_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 1000;   // live preview refresh rate

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

/** Fetch one JPEG from the ESP32 and return it as a data URL, or null on any failure. */
async function fetchFrame(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
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
   * Latest preview frame as a data URL, updated every ~1 s after testConnection.
   * Use as <img src={previewFrame} /> for the live preview and viewer broadcast.
   * Null until testConnection succeeds.
   */
  previewFrame: string | null;
  /**
   * Fetch a fresh JPEG still from /capture.
   * Returns a data URL, or null on failure.
   * Use for saving specimens when you need a guaranteed-fresh frame.
   */
  captureStill: () => Promise<string | null>;
  isConnected: boolean;
  isConnecting: boolean;
  /** Human-readable error message, or null when healthy */
  error: string | null;
  /** Test reachability for a given IP. Starts the polling loop on success. */
  testConnection: (ip: string) => Promise<boolean>;
}

export function useEspCamera({ ip }: UseEspCameraOptions): UseEspCameraResult {
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref to the current base URL so callbacks don't need ip in their deps
  const baseUrlRef = useRef<string>('');
  // Set to false to stop the polling loop on cleanup / IP change / disconnect
  const activeRef = useRef<boolean>(false);

  // ── Polling loop ──────────────────────────────────────────────────────────
  // Sequential setTimeout so requests never pile up. Each poll only schedules
  // the next one after the current fetch fully resolves (success or failure).
  const startPolling = useCallback(() => {
    activeRef.current = true;

    const poll = async () => {
      if (!activeRef.current || !baseUrlRef.current) return;
      const frame = await fetchFrame(captureUrl(baseUrlRef.current), CAPTURE_TIMEOUT_MS);
      if (!activeRef.current) return; // stopped while we were fetching
      if (frame) setPreviewFrame(frame);
      // Always schedule the next poll; momentary ESP32 busy states are normal
      if (activeRef.current) setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  }, []);

  const stopPolling = useCallback(() => {
    activeRef.current = false;
  }, []);

  // ── Connection test (called by the "Test" button) ──────────────────────────
  const testConnection = useCallback(async (testIp: string): Promise<boolean> => {
    stopPolling();
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

      // Show the test frame immediately so the preview isn't blank for 1 s
      const firstFrame = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (firstFrame) setPreviewFrame(firstFrame);

      baseUrlRef.current = base;
      setIsConnected(true);
      setIsConnecting(false);
      startPolling();
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
  }, [startPolling, stopPolling]);

  // ── Still capture (for saving specimens) ──────────────────────────────────
  // Fetches a guaranteed-fresh frame. For quick grabs use previewFrame directly.
  const captureStill = useCallback(async (): Promise<string | null> => {
    if (!baseUrlRef.current) return null;
    return fetchFrame(captureUrl(baseUrlRef.current), CAPTURE_TIMEOUT_MS);
  }, []);

  // ── Stop polling on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Reset everything when the IP field changes ─────────────────────────────
  useEffect(() => {
    stopPolling();
    setIsConnected(false);
    setPreviewFrame(null);
    setError(null);
    baseUrlRef.current = '';
  }, [ip, stopPolling]);

  return { previewFrame, captureStill, isConnected, isConnecting, error, testConnection };
}
