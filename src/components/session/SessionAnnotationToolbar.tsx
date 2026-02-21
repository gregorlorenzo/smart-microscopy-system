import { MousePointer, Pen, Type, Undo2, Trash2 } from 'lucide-react';
import { DrawMode } from '@/hooks/useAnnotations';

interface SessionAnnotationToolbarProps {
  drawMode: DrawMode;
  brushColor: string;
  brushSize: number;
  canUndo: boolean;
  onModeChange: (mode: DrawMode) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
}

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ffffff', // white
  '#000000', // black
];

const SIZES = [3, 6, 12];

export default function SessionAnnotationToolbar({
  drawMode,
  brushColor,
  brushSize,
  canUndo,
  onModeChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onClear,
}: SessionAnnotationToolbarProps) {
  const btn = (active: boolean, disabled = false) =>
    `w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
      disabled
        ? 'text-gray-600 cursor-not-allowed'
        : active
        ? 'bg-white text-gray-900'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 bg-gray-900/95 backdrop-blur border-t border-gray-800 flex-wrap">
      {/* Mode buttons */}
      <button
        className={btn(drawMode === 'select')}
        onClick={() => onModeChange('select')}
        title="Select / Move"
      >
        <MousePointer className="w-4 h-4" />
      </button>
      <button
        className={btn(drawMode === 'pen')}
        onClick={() => onModeChange('pen')}
        title="Draw"
      >
        <Pen className="w-4 h-4" />
      </button>
      <button
        className={btn(drawMode === 'text')}
        onClick={() => onModeChange('text')}
        title="Add Text"
      >
        <Type className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Brush sizes */}
      {SIZES.map((s) => (
        <button
          key={s}
          className={btn(brushSize === s)}
          onClick={() => onSizeChange(s)}
          title={`${s}px brush`}
        >
          <div
            className={`rounded-full ${brushSize === s ? 'bg-gray-900' : 'bg-current'}`}
            style={{ width: s + 4, height: s + 4 }}
          />
        </button>
      ))}

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Color swatches */}
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
            brushColor === color ? 'border-white scale-110' : 'border-gray-600'
          }`}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Undo / Clear */}
      <button
        className={btn(false, !canUndo)}
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo last annotation"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        className={btn(false)}
        onClick={onClear}
        title="Clear all annotations"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
