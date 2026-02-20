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
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Use fixed size to avoid ResizeObserver feedback loop
  const canvasSize = { width: 800, height: 600 };

  // Calculate scale factor for responsive display
  useEffect(() => {
    const calculateScale = () => {
      // Get available width (accounting for padding)
      const maxWidth = window.innerWidth - 64; // 64px total padding
      const scaleX = Math.min(1, maxWidth / canvasSize.width);
      setScale(scaleX);
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

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

      {/* Canvas Container - Responsive with scale */}
      <div className="flex justify-center w-full overflow-x-hidden">
        <div
          style={{
            width: `${canvasSize.width * scale}px`,
            height: `${canvasSize.height * scale}px`,
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
            }}
          >
            <div
              ref={outerRef}
              className="relative border-2 border-gray-300 rounded-lg bg-gray-100 overflow-hidden shadow-md"
              style={{
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
              }}
            >
              <div ref={containerRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

AnnotationCanvas.displayName = 'AnnotationCanvas';

export default AnnotationCanvas;
