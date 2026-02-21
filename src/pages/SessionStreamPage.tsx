import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadSessionInfo } from '@/lib/sessionUtils';
import { useSessionPresence } from '@/hooks/useSessionPresence';
import { useSessionStream } from '@/hooks/useSessionStream';
import { useCamera } from '@/hooks/useCamera';
import { useAnnotations } from '@/hooks/useAnnotations';
import SessionAnnotationToolbar from '@/components/session/SessionAnnotationToolbar';
import { SessionInfo } from '@/types/session';

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

  // ── Real-time hooks ────────────────────────────────────────────────────────────────────────────────────

  // Participant count for top bar
  const { participants } = useSessionPresence({
    sessionCode: code || '',
    participantName: sessionInfo?.participantName || '',
    role: sessionInfo?.role || 'viewer',
    sessionName: isPresenter ? sessionInfo?.name : undefined,
  });

  // Frame + annotation broadcast/receive
  const {
    currentFrame,
    incomingAnnotations,
    isPresenterStreaming,
    startBroadcasting,
    stopBroadcasting,
    broadcastAnnotations,
  } = useSessionStream({
    sessionCode: code || '',
    role: sessionInfo?.role || 'viewer',
  });

  // ── Camera (presenter only) ─────────────────────────────────────────────────────────────
  const { videoRef, startCamera, stopCamera, isStreaming } = useCamera();

  useEffect(() => {
    if (!isPresenter || !sessionInfo) return;
    startCamera();
    return () => {
      stopBroadcasting();
      stopCamera();
    };
  }, [isPresenter, sessionInfo]);

  // Start broadcasting once the camera stream is live
  useEffect(() => {
    if (isPresenter && isStreaming && videoRef.current) {
      startBroadcasting(videoRef.current);
    }
  }, [isPresenter, isStreaming]);

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
    fabricCanvas.on('object:added', handleChange);
    fabricCanvas.on('object:modified', handleChange);
    fabricCanvas.on('object:removed', handleChange);

    return () => {
      fabricCanvas.off('path:created', handleChange);
      fabricCanvas.off('object:added', handleChange);
      fabricCanvas.off('object:modified', handleChange);
      fabricCanvas.off('object:removed', handleChange);
    };
  }, [fabricCanvas, isPresenter, exportJSON, broadcastAnnotations]);

  // Viewer: receive and render incoming annotation JSON
  useEffect(() => {
    if (!incomingAnnotations || isPresenter || !fabricCanvas) return;
    loadJSON(incomingAnnotations);
  }, [incomingAnnotations, isPresenter, fabricCanvas, loadJSON]);

  // ── Navigation handlers ────────────────────────────────────────────────────────────────────────────────────
  const handleBack = () => {
    stopBroadcasting();
    navigate(`/session/${code}`);
  };

  const handleOpenLibrary = () => navigate(`/session/${code}/library`);

  if (!sessionInfo) return null;

  const isLive = isPresenter ? isStreaming : isPresenterStreaming;

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
          {isLive && (
            <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/40 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Live
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">

        {/* Presenter: live camera feed */}
        {isPresenter && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-full max-w-full object-contain"
            style={{ maxHeight: `calc(100vh - 120px)` }}
          />
        )}

        {/* Viewer: received JPEG frame */}
        {!isPresenter && (
          isPresenterStreaming && currentFrame ? (
            <img
              src={currentFrame}
              alt="Live microscope feed"
              className="max-h-full max-w-full object-contain"
              style={{ maxHeight: `calc(100vh - 120px)` }}
            />
          ) : (
            <div className="text-center space-y-3 text-gray-600">
              <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm">Waiting for presenter to start the stream…</p>
            </div>
          )
        )}

        {/* Annotation canvas overlay — fixed 800×600, centered, transparent */}
        {/* Presenter: interactive. Viewer: pointer-events disabled. */}
        <div
          className="absolute overflow-hidden"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: isPresenter ? 'auto' : 'none',
          }}
        >
          <div ref={containerRef} />
        </div>
      </div>

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
        />
      )}
    </div>
  );
}
