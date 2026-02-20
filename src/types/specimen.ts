export interface Specimen {
  id: string;
  name: string;
  description?: string;
  capturedAt: Date;
  imageUrl: string;
  videoUrl?: string;
  annotations: Annotation[];
  tags?: string[];
  syncedToCloud: boolean;
  userId?: string;
}

export interface Annotation {
  id: string;
  type: 'freehand' | 'text' | 'shape';
  data: any;
  color: string;
  createdAt: Date;
}

export interface SyncStatus {
  lastSyncedAt?: Date;
  pendingUploads: string[];
  isOnline: boolean;
}

export interface UserSettings {
  cameraDeviceId?: string;
  enableCloudSync: boolean;
  enableNotifications: boolean;
  deviceId?: string;
}
