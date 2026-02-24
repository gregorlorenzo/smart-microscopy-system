import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Library, Camera, Save, Wifi, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { loadSessionInfo } from '@/lib/sessionUtils';
import { useSessionPresence } from '@/hooks/useSessionPresence';
import { useSessionStream } from '@/hooks/useSessionStream';
import { useCamera } from '@/hooks/useCamera';
import { useEspCamera } from '@/hooks/useEspCamera';
import { useAnnotations } from '@/hooks/useAnnotations';
import { useVideoRecorder } from '@/hooks/useVideoRecorder';
import SessionAnnotationToolbar from '@/components/session/SessionAnnotationToolbar';
import SaveSpecimenDialog from '@/components/capture/SaveSpecimenDialog';
import { captureVideoFrame, mergeImages, blobToDataURL } from '@/lib/capture';
import { storage } from '@/lib/storage';
import { SessionInfo } from '@/types/session';
import { Specimen } from '@/types/specimen';
import ScaledCanvasWrapper from '@/components/ui/scaled-canvas-wrapper';

// Canvas size for the annotation overlay
const CANVAS_W = 800;
const CANVAS_H = 600;

export default function SessionStreamPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  // ── Load session info from sessionStorage ──────────────────────────────────────────────
  useEffect(() => {
    const info = loadSessionInfo();
    if (!info || info.code !== code?.toUpperCase()) {
      navigate('/');
      return;
    }
    setSessionInfo(info);
  }, [code, navigate]);

  const isPresenter = sessionInfo?.role === 'presenter';

  // ── Camera source setup ────────────────────────────────────────────────────
  const [isLive, setIsLive] = useState(false);
  const [cameraSource, setCameraSource] = useState<'webcam' | 'esp32'>('webcam');
  const [espIp, setEspIp] = useState('');

  // ── Real-time hooks ────────────────────────────────────────────────────────────────────────────────────
  const { participants } = useSessionPresence({
    sessionCode: sessionInfo ? (code || '') : '',
    participantName: sessionInfo?.participantName || '',
    role: sessionInfo?.role || 'viewer',
    sessionName: isPresenter ? sessionInfo?.name : undefined,
  });

  const {
    currentFrame,
    incomingAnnotations,
    isPresenterStreaming,
    startBroadcasting,
    stopBroadcasting,
    broadcastAnnotations,
    broadcastImage,
  } = useSessionStream({
    sessionCode: sessionInfo ? (code || '') : '',
    role: sessionInfo?.role || 'viewer',
  });

  // ── Camera (presenter only) ─────────────────────────────────────────────────────────────
  const { videoRef, videoElRef, startCamera, stopCamera, isStreaming } = useCamera();

  const {
    streamUrl: espStreamUrl,
    captureStill: captureEspStill,
    isConnected: espConnected,
    isConnecting: espConnecting,
    error: espError,
    testConnection: testEspConnection,
  } = useEspCamera({ ip: espIp });

  // Ref to the live MJPEG <img> — used to draw frames to canvas without an
  // extra /capture request (eliminates camera resource contention on the ESP32)
  const espImgRef = useRef<HTMLImageElement>(null);

  // Incremented to force React to remount the <img> and reconnect the stream
  const [espStreamRetryKey, setEspStreamRetryKey] = useState(0);

  // Draw the current MJPEG frame to a canvas and return a JPEG data URL.
  // Returns null if the image isn't ready or canvas is tainted (CORS).
  const captureFromMjpeg = useCallback((): string | null => {
    const img = espImgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    try {
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
      return null; // SecurityError if ESP32 stream lacks CORS headers
    }
  }, []);

  // Auto-reconnect when the MJPEG stream drops — remount the <img> after 2 s
  // instead of permanently killing the stream.
  const handleEspStreamError = useCallback(() => {
    setTimeout(() => setEspStreamRetryKey((k) => k + 1), 2000);
  }, []);

  // Mirror isLive into a ref so cleanup callbacks can read the current value
  // without being listed in effect dependency arrays.
  const isLiveRef = useRef(false);
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);

  // Webcam: start camera for preview on setup screen (and keep alive when live)
  useEffect(() => {
    if (!isPresenter || !sessionInfo || cameraSource !== 'webcam') return;
    startCamera();
    return () => {
      if (isLiveRef.current) stopBroadcasting();
      stopCamera();
    };
  }, [isPresenter, sessionInfo, cameraSource, startCamera, stopBroadcasting, stopCamera]);

  // Webcam: start broadcasting once live and camera stream is ready
  useEffect(() => {
    if (!isPresenter || !isLive || cameraSource !== 'webcam') return;
    if (isStreaming && videoElRef.current) {
      startBroadcasting(videoElRef.current);
    }
  }, [isPresenter, isLive, cameraSource, isStreaming, startBroadcasting]);

  // ESP32: broadcast a frame to viewers every second while live.
  // Draws from the MJPEG <img> directly — no extra /capture request,
  // so the ESP32 sensor is never hit by two simultaneous grabs.
  useEffect(() => {
    if (!isPresenter || !isLive || cameraSource !== 'esp32') return;
    const id = setInterval(() => {
      const frame = captureFromMjpeg();
      if (frame) broadcastImage(frame);
    }, 1000);
    return () => clearInterval(id);
  }, [isPresenter, isLive, cameraSource, captureFromMjpeg, broadcastImage]);

  // ── Annotation canvas ────────────────────────────────────────────────────────────────────────────────────────────
  const {
    containerRef,
    drawMode,
    brushColor,
    brushSize,
    canUndo,
    setMode,
    updateBrush,
    undo,
    clearAll,
    exportJSON,
    loadJSON,
    exportImage,
    fabricCanvas,
  } = useAnnotations(CANVAS_W, CANVAS_H);

  // Disable viewer interaction once canvas is initialised
  useEffect(() => {
    if (!fabricCanvas || isPresenter) return;
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.selection = false;
    fabricCanvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });
  }, [fabricCanvas, isPresenter]);

  // Presenter: broadcast annotations after each completed stroke / object change
  useEffect(() => {
    if (!fabricCanvas || !isPresenter) return;

    const handleChange = () => broadcastAnnotations(exportJSON());

    fabricCanvas.on('path:created', handleChange);
    fabricCanvas.on('object:modified', handleChange);
    fabricCanvas.on('object:removed', handleChange);

    return () => {
      fabricCanvas.off('path:created', handleChange);
      fabricCanvas.off('object:modified', handleChange);
      fabricCanvas.off('object:removed', handleChange);
    };
  }, [fabricCanvas, isPresenter, exportJSON, broadcastAnnotations]);

  // Viewer: receive and render incoming annotation JSON
  useEffect(() => {
    if (!incomingAnnotations || isPresenter || !fabricCanvas) return;
    loadJSON(incomingAnnotations);
  }, [incomingAnnotations, isPresenter, fabricCanvas, loadJSON]);

  // Presenter: re-broadcast current annotations whenever a new participant joins.
  // Supabase broadcast is ephemeral — viewers who navigate away and return see no
  // history, so the presenter must replay the current state on join.
  const prevParticipantCountRef = useRef(0);
  useEffect(() => {
    if (!isPresenter || !fabricCanvas) return;
    if (participants.length > prevParticipantCountRef.current) {
      broadcastAnnotations(exportJSON());
    }
    prevParticipantCountRef.current = participants.length;
  }, [participants, isPresenter, fabricCanvas, broadcastAnnotations, exportJSON]);

  // ── Capture state ───────────────────────────────────────────────────────────────────────
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // ── Video recorder ──────────────────────────────────────────────────────────────────────
  const { isRecording, recordingTime, startRecording, stopRecording } = useVideoRecorder();

  // ── Navigation handlers ────────────────────────────────────────────────────────────────────────────────────
  const handleBack = () => {
    stopBroadcasting();
    navigate(`/session/${code}`);
  };

  const handleOpenLibrary = () => navigate(`/session/${code}/library`);

  // ── Capture / save handlers ─────────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    try {
      let baseFrame: string;
      if (isPresenter) {
        if (cameraSource === 'esp32') {
          // Draw from the live MJPEG frame — no extra request to the ESP32.
          // Fall back to /capture only if the canvas draw fails (e.g. CORS).
          baseFrame = captureFromMjpeg() ?? (await captureEspStill()) ?? '';
          if (!baseFrame) return;
        } else {
          if (!videoElRef.current) return;
          baseFrame = await captureVideoFrame(videoElRef.current);
        }
      } else {
        if (!currentFrame) return;
        baseFrame = currentFrame;
      }
      const annotationImage = exportImage();
      const merged = await mergeImages(baseFrame, annotationImage);
      setCapturedImage(merged);
    } catch (err) {
      console.error('[Capture] Failed:', err);
    }
  }, [isPresenter, cameraSource, captureFromMjpeg, captureEspStill, currentFrame, exportImage]);

  const handleSave = useCallback(async (data: { name: string; description: string; tags: string[] }) => {
    if (!capturedImage) return;

    let videoDataUrl: string | undefined;
    if (recordedVideo) {
      try {
        videoDataUrl = await blobToDataURL(recordedVideo);
      } catch {
        // Continue without video if conversion fails
      }
    }

    const specimen: Specimen = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      tags: data.tags,
      capturedAt: new Date(),
      imageUrl: capturedImage,
      videoUrl: videoDataUrl,
      annotations: [],
      syncedToCloud: false,
    };

    await storage.addSpecimen(specimen);
    setCapturedImage(null);
    setRecordedVideo(null);
    setShowSaveDialog(false);
  }, [capturedImage, recordedVideo]);

  const handleStartRecording = useCallback(async () => {
    const stream = videoElRef.current?.srcObject as MediaStream | null;
    if (!stream) return;
    await startRecording(stream);
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    if (blob.size > 0) {
      setRecordedVideo(blob);
    } else {
      console.warn('[Capture] Recording stopped with no data');
    }
  }, [stopRecording]);

  if (!sessionInfo) return null;

  // ── Setup screen (presenter only, before going live) ──────────────────────
  if (isPresenter && !isLive) {
    const canGoLive =
      cameraSource === 'webcam' ? isStreaming :
        cameraSource === 'esp32' ? espConnected : false;

    return (
      <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300 hover:text-white hover:bg-gray-800 gap-1.5"
              onClick={() => navigate(`/session/${code}`)}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <span className="text-sm font-medium text-gray-200 hidden sm:block">
              {sessionInfo.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 text-sm">
            <Users className="w-4 h-4" />
            <span>Participants ({participants.length})</span>
          </div>
        </div>

        {/* Setup content */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-6">
            <h2 className="text-xl font-semibold text-center">Camera Setup</h2>

            {/* Source selector */}
            <div className="bg-gray-900 rounded-xl p-4 space-y-3 border border-gray-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="camera-source"
                  checked={cameraSource === 'webcam'}
                  onChange={() => setCameraSource('webcam')}
                  className="accent-blue-500"
                />
                <span className="text-sm font-medium">Webcam / phone camera</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="camera-source"
                  checked={cameraSource === 'esp32'}
                  onChange={() => setCameraSource('esp32')}
                  className="accent-blue-500"
                />
                <span className="text-sm font-medium">ESP32-CAM</span>
              </label>

              {/* ESP32 IP input */}
              {cameraSource === 'esp32' && (
                <div className="ml-6 space-y-2 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="192.168.1.105"
                      value={espIp}
                      onChange={(e) => setEspIp(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testEspConnection(espIp)}
                      disabled={!espIp.trim() || espConnecting}
                      className="shrink-0 border-gray-700 text-gray-300 hover:text-white"
                    >
                      {espConnecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Test'
                      )}
                    </Button>
                  </div>

                  {/* Connection status */}
                  {espConnected && (
                    <p className="flex items-center gap-1.5 text-xs text-green-400">
                      <Wifi className="w-3.5 h-3.5" />
                      Connected
                    </p>
                  )}
                  {espError && (
                    <p className="text-xs text-red-400 whitespace-pre-wrap">{espError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Preview */}
            <div
              className="relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center"
              style={{ width: '100%', aspectRatio: '4/3' }}
            >
              {cameraSource === 'webcam' && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ display: isStreaming ? 'block' : 'none' }}
                  />
                  {!isStreaming && (
                    <p className="text-sm text-gray-500">Starting webcam…</p>
                  )}
                </>
              )}
              {cameraSource === 'esp32' && (
                espStreamUrl ? (
                  <img
                    key={espStreamRetryKey}
                    src={espStreamUrl}
                    alt="ESP32-CAM preview"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                    onError={handleEspStreamError}
                  />
                ) : (
                  <p className="text-sm text-gray-500">
                    {espConnecting ? 'Testing connection…' : 'Enter IP and click Test'}
                  </p>
                )
              )}
            </div>

            {/* Go Live button */}
            <Button
              className="w-full"
              size="lg"
              onClick={() => setIsLive(true)}
              disabled={!canGoLive}
            >
              Go Live
            </Button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden select-none">

      {/* ── Top bar ──────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800 gap-1.5"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <span className="text-sm font-medium text-gray-200 hidden sm:block">
            {sessionInfo.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-gray-400 text-sm">
            <Users className="w-4 h-4" />
            <span>Participants ({participants.length})</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800"
            onClick={handleOpenLibrary}
            title="Specimen Library"
          >
            <Library className="w-4 h-4" />
          </Button>
          {(isPresenter ? isLive : isPresenterStreaming) && (
            <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Live
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-2 sm:p-0">
        <div className="w-full" style={{ maxWidth: CANVAS_W }}>
          <ScaledCanvasWrapper>
            <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H, background: '#111827' }}>

              {/* Presenter: webcam feed */}
              {isPresenter && cameraSource !== 'esp32' && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: CANVAS_W, height: CANVAS_H, objectFit: 'cover', display: 'block' }}
                />
              )}

              {/* Presenter: ESP32-CAM MJPEG feed */}
              {isPresenter && cameraSource === 'esp32' && espStreamUrl && (
                <img
                  key={espStreamRetryKey}
                  ref={espImgRef}
                  src={espStreamUrl}
                  alt="ESP32-CAM feed"
                  crossOrigin="anonymous"
                  onError={handleEspStreamError}
                  style={{ width: CANVAS_W, height: CANVAS_H, objectFit: 'cover' }}
                />
              )}

              {/* Viewer: received frame */}
              {!isPresenter && isPresenterStreaming && currentFrame && (
                <img
                  src={currentFrame}
                  alt="Live microscope feed"
                  style={{ width: CANVAS_W, height: CANVAS_H }}
                />
              )}

              {/* Viewer: waiting placeholder */}
              {!isPresenter && (!isPresenterStreaming || !currentFrame) && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-center text-gray-600"
                >
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm">Waiting for presenter to start the stream…</p>
                  </div>
                </div>
              )}

              {/* Annotation canvas overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: isPresenter ? 'auto' : 'none',
                }}
              >
                <div ref={containerRef} />
              </div>

            </div>
          </ScaledCanvasWrapper>
        </div>
      </div>

      {/* Viewer capture bar */}
      {!isPresenter && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900/95 backdrop-blur border-t border-gray-800">
          <button
            className={`w-9 h-9 rounded-lg flex items-center justify-center relative transition-colors ${isPresenterStreaming
              ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
              : 'text-gray-600 cursor-not-allowed'
              }`}
            onClick={handleCapture}
            disabled={!isPresenterStreaming}
            title="Capture current frame"
          >
            <Camera className="w-4 h-4" />
            {capturedImage && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-gray-900" />
            )}
          </button>
          <button
            className={`h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${capturedImage
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'text-gray-600 cursor-not-allowed'
              }`}
            onClick={() => setShowSaveDialog(true)}
            disabled={!capturedImage}
            title="Save to Library"
          >
            <Save className="w-3.5 h-3.5" />
            Save to Library
          </button>
        </div>
      )}

      {/* Save specimen dialog — shared by both roles */}
      <SaveSpecimenDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
      />

      {/* ── Bottom toolbar — presenter only ──────────────────────────────────────────── */}
      {isPresenter && (
        <SessionAnnotationToolbar
          drawMode={drawMode}
          brushColor={brushColor}
          brushSize={brushSize}
          canUndo={canUndo}
          onModeChange={setMode}
          onColorChange={(color) => updateBrush(color, undefined)}
          onSizeChange={(size) => updateBrush(undefined, size)}
          onUndo={undo}
          onClear={clearAll}
          captureReady={!!capturedImage}
          onCapture={handleCapture}
          onSave={() => setShowSaveDialog(true)}
          isRecording={isRecording}
          recordingTime={recordingTime}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          recordingEnabled={cameraSource !== 'esp32'}
        />
      )}
    </div>
  );
}
