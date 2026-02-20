import { Button } from '@/components/ui/button';
import { Camera, VideoOff, SwitchCamera } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CameraDevice } from '@/hooks/useCamera';

interface CameraControlsProps {
  isStreaming: boolean;
  devices: CameraDevice[];
  selectedDeviceId: string;
  onStart: () => void;
  onStop: () => void;
  onSwitch: (deviceId: string) => void;
}

export default function CameraControls({
  isStreaming,
  devices,
  selectedDeviceId,
  onStart,
  onStop,
  onSwitch,
}: CameraControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {!isStreaming ? (
        <Button onClick={onStart} className="gap-2">
          <Camera className="w-4 h-4" />
          Start Camera
        </Button>
      ) : (
        <Button onClick={onStop} variant="destructive" className="gap-2">
          <VideoOff className="w-4 h-4" />
          Stop Camera
        </Button>
      )}

      {devices.length > 1 && isStreaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <SwitchCamera className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {devices.map((device) => (
              <DropdownMenuItem
                key={device.deviceId}
                onClick={() => onSwitch(device.deviceId)}
                className={selectedDeviceId === device.deviceId ? 'bg-gray-100' : ''}
              >
                {device.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
