import { Button } from '@/components/ui/button';
import { Pencil, Type, MousePointer, Undo, Trash2 } from 'lucide-react';
import { DrawMode } from '@/hooks/useAnnotations';

interface DrawingToolbarProps {
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

const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#000000'];
const SIZES = [3, 5, 10, 15];

export default function DrawingToolbar({
  drawMode,
  brushColor,
  brushSize,
  canUndo,
  onModeChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onClear,
}: DrawingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white border rounded-lg">
      <div className="flex gap-1">
        <Button
          variant={drawMode === 'select' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onModeChange('select')}
          title="Select"
        >
          <MousePointer className="w-4 h-4" />
        </Button>
        <Button
          variant={drawMode === 'pen' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onModeChange('pen')}
          title="Draw"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant={drawMode === 'text' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onModeChange('text')}
          title="Add Text"
        >
          <Type className="w-4 h-4" />
        </Button>
      </div>

      <div className="h-8 w-px bg-gray-300" />

      <div className="flex gap-1">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={`w-8 h-8 rounded border-2 ${
              brushColor === color ? 'border-blue-500' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <div className="h-8 w-px bg-gray-300" />

      <div className="flex gap-1">
        {SIZES.map((size) => (
          <Button
            key={size}
            variant={brushSize === size ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSizeChange(size)}
          >
            {size}px
          </Button>
        ))}
      </div>

      <div className="h-8 w-px bg-gray-300" />

      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onClear}
          title="Clear All"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
