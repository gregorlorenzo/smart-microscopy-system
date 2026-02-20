import { Video, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoRecordButtonProps {
  isRecording: boolean;
  recordingTime: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoRecordButton({
  isRecording,
  recordingTime,
  onStartRecording,
  onStopRecording,
  disabled,
}: VideoRecordButtonProps) {
  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <>
          <Button
            onClick={onStopRecording}
            variant="destructive"
            size="lg"
            className="gap-2"
          >
            <Square className="h-4 w-4 fill-current" />
            Stop Recording
          </Button>
          <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-md border border-destructive/20">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-mono font-medium text-destructive">
              {formatTime(recordingTime)}
            </span>
          </div>
        </>
      ) : (
        <Button
          onClick={onStartRecording}
          variant="default"
          size="lg"
          disabled={disabled}
          className="gap-2"
        >
          <Video className="h-4 w-4" />
          Start Recording
        </Button>
      )}
    </div>
  );
}
