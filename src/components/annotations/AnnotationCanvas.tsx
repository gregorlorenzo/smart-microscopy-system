import { useAnnotations } from '@/hooks/useAnnotations';
import DrawingToolbar from './DrawingToolbar';
import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';

interface AnnotationCanvasProps {
  backgroundImage?: string;
  onAnnotationsChange?: (json: any) => void;
}

export interface AnnotationCanvasHandle {
  exportImage: () => string | null;
  clearAll: () => void;
}

const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, AnnotationCanvasProps>(({
  backgroundImage,
  onAnnotationsChange,
}, ref) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Use fixed size to avoid ResizeObserver feedback loop
  const canvasSize = { width: 800, height: 600 };

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const update = () => {
      setScale(Math.min(1, el.clientWidth / canvasSize.width));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasSize.width]);

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
    exportImage,
    setBackgroundImage,
    fabricCanvas,
  } = useAnnotations(canvasSize.width, canvasSize.height);

  // Set background image when it changes
  useEffect(() => {
    if (backgroundImage && setBackgroundImage) {
      setBackgroundImage(backgroundImage);
    }
  }, [backgroundImage, setBackgroundImage]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    exportImage,
    clearAll,
  }), [exportImage, clearAll]);

  // Export annotations when canvas changes
  useEffect(() => {
    if (!fabricCanvas || !onAnnotationsChange) return;

    const handleCanvasChange = () => {
      const json = exportJSON();
      onAnnotationsChange(json);
    };

    fabricCanvas.on('object:added', handleCanvasChange);
    fabricCanvas.on('object:modified', handleCanvasChange);
    fabricCanvas.on('object:removed', handleCanvasChange);

    return () => {
      fabricCanvas.off('object:added', handleCanvasChange);
      fabricCanvas.off('object:modified', handleCanvasChange);
      fabricCanvas.off('object:removed', handleCanvasChange);
    };
  }, [fabricCanvas, exportJSON, onAnnotationsChange]);

  return (
    <div className="space-y-4">
      {/* Drawing Toolbar */}
      <DrawingToolbar
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

      {/* Canvas Container */}
      <div
        ref={wrapperRef}
        className="w-full overflow-hidden"
        style={{ aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}
      >
        <div
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <div
            className="relative border-2 border-gray-300 rounded-lg bg-gray-100 overflow-hidden shadow-md"
            style={{ width: canvasSize.width, height: canvasSize.height }}
          >
            <div ref={containerRef} />
          </div>
        </div>
      </div>
    </div>
  );
});

AnnotationCanvas.displayName = 'AnnotationCanvas';

export default AnnotationCanvas;
