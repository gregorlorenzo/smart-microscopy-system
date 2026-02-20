import { useCamera } from '@/hooks/useCamera';
import CameraControls from './CameraControls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { forwardRef, useImperativeHandle } from 'react';

interface CameraFeedProps {
  onImageCapture?: (imageData: string) => void;
}

export interface CameraFeedHandle {
  getVideoElement: () => HTMLVideoElement | null;
  getStream: () => MediaStream | null;
  isStreaming: boolean;
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({ onImageCapture }, ref) => {
  const {
    videoRef,
    stream,
    devices,
    selectedDeviceId,
    isStreaming,
    error,
    permissionDenied,
    startCamera,
    stopCamera,
    switchCamera,
  } = useCamera();

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
    getStream: () => stream,
    isStreaming,
  }));

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageCapture) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        onImageCapture(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Camera Feed</h2>
        <CameraControls
          isStreaming={isStreaming}
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onStart={() => startCamera()}
          onStop={stopCamera}
          onSwitch={switchCamera}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(permissionDenied || !isStreaming) && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 mb-3">
            Or upload an image from your device:
          </p>
          <label htmlFor="file-upload">
            <Button variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="w-4 h-4" />
                Upload Image
              </span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      )}

      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <p>Click "Start Camera" to begin</p>
          </div>
        )}
      </div>
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';

export default CameraFeed;
