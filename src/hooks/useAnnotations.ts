import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, IText, PencilBrush, FabricImage } from 'fabric';

export type DrawMode = 'select' | 'pen' | 'text' | 'none';

export function useAnnotations(initialWidth = 800, initialHeight = 600) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const drawModeRef = useRef<DrawMode>('none');
  const brushColorRef = useRef('#ff0000');
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(5);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Keep refs in sync with state
  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    brushColorRef.current = brushColor;
  }, [brushColor]);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!containerRef.current) return;

    // Create a fresh canvas element each time (avoids React strict mode double-init issues)
    const canvasEl = document.createElement('canvas');
    containerRef.current.appendChild(canvasEl);

    const canvas = new Canvas(canvasEl, {
      width: initialWidth,
      height: initialHeight,
      backgroundColor: 'transparent',
    });

    fabricCanvasRef.current = canvas;

    // Track undo state
    const updateUndoRedo = () => {
      setCanUndo(canvas.getObjects().length > 0);
    };

    canvas.on('object:added', updateUndoRedo);
    canvas.on('object:modified', updateUndoRedo);
    canvas.on('object:removed', updateUndoRedo);

    // Single mouse:down handler that checks current mode via ref (no stale closure)
    canvas.on('mouse:down', (e: any) => {
      if (drawModeRef.current !== 'text') return;

      // Don't add text if clicking on an existing object
      if (e.target) return;

      // In Fabric.js v7, the event object has scenePoint and viewportPoint built-in
      // scenePoint is the coordinate in the canvas scene (what we need for object positioning)
      const pointer = e.scenePoint;

      const textObj = new IText('Type here...', {
        left: pointer.x,
        top: pointer.y,
        fontSize: 20,
        fill: brushColorRef.current,
        editable: true,
      });

      canvas.add(textObj);
      canvas.setActiveObject(textObj);
      textObj.enterEditing();
      textObj.selectAll();
      canvas.renderAll();
    });

    return () => {
      canvas.dispose();
      // Fully clean up - remove all DOM elements Fabric.js created
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [initialWidth, initialHeight]);

  // Set drawing mode
  const setMode = useCallback((mode: DrawMode) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    if (mode === 'pen') {
      canvas.isDrawingMode = true;

      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
      }

      canvas.freeDrawingBrush.color = brushColor;
      canvas.freeDrawingBrush.width = brushSize;
    } else if (mode === 'text') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = true;
    }

    setDrawMode(mode);
  }, [brushColor, brushSize]);

  // Add text annotation
  const addText = useCallback((text: string, x: number, y: number) => {
    if (!fabricCanvasRef.current) return;

    const textObj = new IText(text, {
      left: x,
      top: y,
      fontSize: 20,
      fill: brushColor,
      editable: true,
    });

    fabricCanvasRef.current.add(textObj);
    fabricCanvasRef.current.setActiveObject(textObj);
  }, [brushColor]);

  // Update brush properties
  const updateBrush = useCallback((color?: string, size?: number) => {
    if (color) setBrushColor(color);
    if (size) setBrushSize(size);

    if (fabricCanvasRef.current?.isDrawingMode) {
      if (!fabricCanvasRef.current.freeDrawingBrush) {
        fabricCanvasRef.current.freeDrawingBrush = new PencilBrush(fabricCanvasRef.current);
      }

      if (color) fabricCanvasRef.current.freeDrawingBrush.color = color;
      if (size) fabricCanvasRef.current.freeDrawingBrush.width = size;
    }
  }, []);

  // Clear all annotations (but keep background image)
  const clearAll = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    // Remove all objects (annotations) but keep the background image
    const objects = fabricCanvasRef.current.getObjects();
    objects.forEach((obj) => fabricCanvasRef.current?.remove(obj));
    fabricCanvasRef.current.renderAll();
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  // Undo (simple implementation)
  const undo = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    const objects = fabricCanvasRef.current.getObjects();
    if (objects.length > 0) {
      fabricCanvasRef.current.remove(objects[objects.length - 1]);
    }
  }, []);

  // Export canvas as JSON
  const exportJSON = useCallback(() => {
    if (!fabricCanvasRef.current) return null;
    return fabricCanvasRef.current.toJSON();
  }, []);

  // Export canvas as image (data URL)
  const exportImage = useCallback(() => {
    if (!fabricCanvasRef.current) return null;
    return fabricCanvasRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
  }, []);

  // Load canvas from JSON
  const loadJSON = useCallback((json: any) => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.loadFromJSON(json, () => {
      fabricCanvasRef.current?.renderAll();
    });
  }, []);

  // Resize canvas
  const resizeCanvas = useCallback((width: number, height: number) => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.setDimensions({ width, height });
  }, []);

  // Set background image
  const setBackgroundImage = useCallback((imageUrl: string) => {
    if (!fabricCanvasRef.current) return;

    FabricImage.fromURL(imageUrl).then((img) => {
      if (!fabricCanvasRef.current) return;

      const canvas = fabricCanvasRef.current;

      // Calculate scale to fit ENTIRE image within canvas (contain mode)
      // This ensures no cropping - entire image is visible with potential letterboxing
      const scaleX = canvas.width! / (img.width || 1);
      const scaleY = canvas.height! / (img.height || 1);
      const scale = Math.min(scaleX, scaleY); // Use minimum to ensure full image fits

      // Calculate scaled dimensions
      const scaledWidth = img.width! * scale;
      const scaledHeight = img.height! * scale;

      // Center the image in the canvas
      const left = (canvas.width! - scaledWidth) / 2 + scaledWidth / 2;
      const top = (canvas.height! - scaledHeight) / 2 + scaledHeight / 2;

      img.set({
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        left: left,
        top: top,
        selectable: false, // Prevent moving background
        evented: false, // Prevent background from receiving events
      });

      canvas.backgroundImage = img;
      canvas.renderAll();
    });
  }, []);

  return {
    containerRef,
    fabricCanvas: fabricCanvasRef.current,
    drawMode,
    brushColor,
    brushSize,
    canUndo,
    canRedo,
    setMode,
    addText,
    updateBrush,
    clearAll,
    undo,
    exportJSON,
    exportImage,
    loadJSON,
    resizeCanvas,
    setBackgroundImage,
  };
}
