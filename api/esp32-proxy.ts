import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless proxy for ESP32-CAM.
 *
 * Why this exists:
 *   1. ngrok free-tier returns an HTML interstitial page on the first
 *      browser request — the `ngrok-skip-browser-warning` header bypasses
 *      it, but that's a custom header which triggers a CORS preflight
 *      OPTIONS request that the ESP32's simple HTTP server can't handle.
 *   2. Mixed-content: Vercel serves the app over HTTPS but the ESP32 is
 *      HTTP — even with ngrok wrapping it, the interstitial breaks things.
 *
 * By proxying through this serverless function the request is made
 * server-side where there are no CORS or mixed-content restrictions,
 * and we can safely include the ngrok header.
 *
 * Usage:  GET /api/esp32-proxy?url=https://xyz.ngrok-free.dev/capture
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing "url" query parameter' });
    }

    // Basic validation – only allow http(s) URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    try {
        const upstream = await fetch(url, {
            headers: {
                // Bypasses ngrok free-tier interstitial (safe server-side, no preflight)
                'ngrok-skip-browser-warning': '1',
                Accept: 'image/jpeg',
            },
            signal: AbortSignal.timeout(10_000),
        });

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const buffer = Buffer.from(await upstream.arrayBuffer());

        // Forward CORS header so the browser can read the response
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-store');

        return res.send(buffer);
    } catch (err: any) {
        const message = err?.name === 'TimeoutError'
            ? 'Upstream timed out (ESP32 not reachable via this URL)'
            : `Proxy error: ${err?.message ?? 'unknown'}`;

        return res.status(502).json({ error: message });
    }
}
