import { Button } from '@/components/ui/button';
import { Camera, Save, Download } from 'lucide-react';
import { useState } from 'react';

interface CaptureControlsProps {
  onCapture: () => Promise<void>;
  onSave: () => Promise<void>;
  onDownload: () => void;
  canCapture: boolean;
  canSave: boolean;
}

export default function CaptureControls({
  onCapture,
  onSave,
  onDownload,
  canCapture,
  canSave,
}: CaptureControlsProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      await onCapture();
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={handleCapture}
        disabled={!canCapture || isCapturing}
        className="gap-2"
      >
        <Camera className="w-4 h-4" />
        {isCapturing ? 'Capturing...' : 'Capture Screenshot'}
      </Button>

      <Button
        onClick={handleSave}
        disabled={!canSave || isSaving}
        variant="secondary"
        className="gap-2"
      >
        <Save className="w-4 h-4" />
        {isSaving ? 'Saving...' : 'Save to Library'}
      </Button>

      <Button
        onClick={onDownload}
        disabled={!canSave}
        variant="outline"
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        Download
      </Button>
    </div>
  );
}
