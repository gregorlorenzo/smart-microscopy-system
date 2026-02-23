import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import CameraFeed, { CameraFeedHandle } from '@/components/camera/CameraFeed';
import AnnotationCanvas, { AnnotationCanvasHandle } from '@/components/annotations/AnnotationCanvas';
import CaptureControls from '@/components/capture/CaptureControls';
import SaveSpecimenDialog from '@/components/capture/SaveSpecimenDialog';
import { VideoRecordButton } from '@/components/capture/VideoRecordButton';
import { captureVideoFrame, downloadImage, downloadVideo, blobToDataURL } from '@/lib/capture';
import { storage } from '@/lib/storage';
import { Specimen } from '@/types/specimen';
import { useToast } from '@/hooks/use-toast';
import { useVideoRecorder } from '@/hooks/useVideoRecorder';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function MicroscopeView() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<any>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showVideoWarning, setShowVideoWarning] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const cameraRef = useRef<CameraFeedHandle>(null);
  const annotationCanvasRef = useRef<AnnotationCanvasHandle>(null);
  const { toast } = useToast();
  const { isRecording, recordingTime, startRecording, stopRecording } = useVideoRecorder();

  const handleCapture = async () => {
    const videoElement = cameraRef.current?.getVideoElement();
    if (!videoElement || !cameraRef.current?.isStreaming) {
      toast({
        title: 'Error',
        description: 'Camera is not active. Please start the camera first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const imageData = await captureVideoFrame(videoElement);
      setCapturedImage(imageData);

      toast({
        title: 'Success',
        description: 'Screenshot captured!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to capture screenshot',
        variant: 'destructive',
      });
    }
  };

  const handleOpenSaveDialog = async () => {
    if (!capturedImage) return;

    // If there's a video, warn user about storage limitations
    if (recordedVideo) {
      setShowVideoWarning(true);
    } else {
      setShowSaveDialog(true);
    }
  };

  const handleSaveWithoutVideo = () => {
    setShowVideoWarning(false);
    // Clear video and proceed with image only
    setRecordedVideo(null);
    setShowSaveDialog(true);
  };

  const handleSaveWithVideo = () => {
    setShowVideoWarning(false);
    setShowSaveDialog(true);
  };

  const handleSave = async (data: { name: string; description: string; tags: string[] }) => {
    if (!capturedImage) return;

    try {
      // Export the canvas (background image + annotations already merged)
      const finalImage = annotationCanvasRef.current?.exportImage();

      if (!finalImage) {
        throw new Error('Failed to export annotated image');
      }

      // Convert video blob to data URL if we have a recorded video
      let videoDataUrl: string | undefined;
      if (recordedVideo) {
        try {
          videoDataUrl = await blobToDataURL(recordedVideo);
        } catch (error) {
          console.warn('Failed to convert video to data URL:', error);
          toast({
            title: 'Warning',
            description: 'Video could not be saved (file too large). Only the image will be saved.',
            variant: 'default',
          });
        }
      }

      const specimen: Specimen = {
        id: uuidv4(),
        name: data.name,
        description: data.description,
        tags: data.tags,
        capturedAt: new Date(),
        imageUrl: finalImage, // Canvas already has background + annotations
        videoUrl: videoDataUrl,
        annotations: annotations ? [annotations] : [],
        syncedToCloud: false,
      };

      await storage.addSpecimen(specimen);

      toast({
        title: 'Success',
        description: recordedVideo
          ? 'Specimen with video saved to library'
          : 'Specimen saved to library',
      });

      // Reset for next capture
      setCapturedImage(null);
      setAnnotations(null);
      setRecordedVideo(null);
      annotationCanvasRef.current?.clearAll();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save specimen',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async () => {
    if (!capturedImage) return;

    try {
      // Export the canvas (already has background + annotations merged)
      const finalImage = annotationCanvasRef.current?.exportImage();
      if (finalImage) {
        downloadImage(finalImage, `specimen-${Date.now()}.jpg`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download image',
        variant: 'destructive',
      });
    }
  };

  const handleStartRecording = async () => {
    const stream = cameraRef.current?.getStream();
    if (!stream || !cameraRef.current?.isStreaming) {
      toast({
        title: 'Error',
        description: 'Camera is not active. Please start the camera first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await startRecording(stream);
      toast({
        title: 'Recording Started',
        description: 'Recording will automatically stop after 60 seconds',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start recording',
        variant: 'destructive',
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      const videoBlob = await stopRecording();
      setRecordedVideo(videoBlob);
      toast({
        title: 'Recording Stopped',
        description: 'Video recorded successfully. You can now download or save it with a specimen.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to stop recording',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadVideo = () => {
    if (!recordedVideo) return;

    try {
      downloadVideo(recordedVideo, `recording-${Date.now()}.webm`);
      toast({
        title: 'Success',
        description: 'Video downloaded',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download video',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Main workspace grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Left: Camera Feed with controls */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Live Camera Feed</h2>
            </div>
            <CameraFeed ref={cameraRef} onImageCapture={setCapturedImage} />

            {/* Capture and recording controls below camera */}
            <div className="flex flex-col gap-3 items-center mt-6 pt-6 border-t border-gray-200">
              <CaptureControls
                onCapture={handleCapture}
                onSave={handleOpenSaveDialog}
                onDownload={handleDownload}
                canCapture={true}
                canSave={!!capturedImage}
              />
              <VideoRecordButton
                isRecording={isRecording}
                recordingTime={recordingTime}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                disabled={!cameraRef.current?.isStreaming}
              />
              {recordedVideo && !isRecording && (
                <Button
                  onClick={handleDownloadVideo}
                  variant="outline"
                  size="default"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Video
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Annotation Canvas (only shows after capture) */}
        {capturedImage ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Annotate Specimen</h2>
              <p className="text-sm text-gray-500">Draw directly on the image</p>
            </div>
            <AnnotationCanvas
              ref={annotationCanvasRef}
              backgroundImage={capturedImage}
              onAnnotationsChange={setAnnotations}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-6 aspect-[4/3]">
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-700">No Screenshot Captured</p>
                <p className="text-sm text-gray-500">Click "Capture Screenshot" to start annotating</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Storage Warning Dialog */}
      <Dialog open={showVideoWarning} onOpenChange={setShowVideoWarning}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <DialogTitle className="text-xl">Video Storage Warning</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="space-y-3 text-base">
            <p>You have a recorded video. How would you like to save this specimen?</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 space-y-1">
              <p><strong>Image + Video</strong> — saves both to the library (~{Math.round((recordedVideo?.size || 0) / 1024 / 1024 * 10) / 10} MB video)</p>
              <p><strong>Download Video</strong> — saves video to your computer, then choose what to store in library</p>
              <p><strong>Image Only</strong> — discards the video, saves just the annotated image</p>
            </div>
          </DialogDescription>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full"
              onClick={handleSaveWithVideo}
            >
              Save Image + Video
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleDownloadVideo}
            >
              <Download className="w-4 h-4" />
              Download Video to Computer
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSaveWithoutVideo}
            >
              Save Image Only
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowVideoWarning(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SaveSpecimenDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
      />
    </div>
  );
}
