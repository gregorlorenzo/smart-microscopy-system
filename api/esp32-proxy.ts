import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless proxy for ESP32-CAM.
 *
 * Fetches from the ESP32 (via ngrok) server-side to bypass:
 *   1. Browser CORS restrictions
 *   2. Mixed-content (HTTPS → HTTP) blocks
 *   3. ngrok free-tier browser interstitial
 *
 * Usage:  GET /api/esp32-proxy?url=https://xyz.ngrok-free.dev/capture
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing "url" query parameter' });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    try {
        const upstream = await fetch(url, {
            headers: {
                // ngrok bypass: custom User-Agent (non-browser) + skip-warning header
                'User-Agent': 'ESP32-Proxy/1.0',
                'ngrok-skip-browser-warning': 'true',
                Accept: 'image/jpeg, application/octet-stream',
            },
            signal: AbortSignal.timeout(10_000),
        });

        const contentType = upstream.headers.get('content-type') || '';
        const buffer = Buffer.from(await upstream.arrayBuffer());

        // If ngrok returned HTML instead of an image, report the body for debugging
        if (contentType.includes('text/html')) {
            const bodyText = buffer.toString('utf-8').slice(0, 200);
            return res.status(502).json({
                error: 'ESP32 returned HTML instead of an image (likely ngrok interstitial)',
                hint: 'Make sure ngrok is running and the ESP32 is reachable',
                upstream_status: upstream.status,
                body_preview: bodyText,
            });
        }

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
