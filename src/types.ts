export type DeviceStatus = 'online' | 'offline' | 'blocked' | 'downtime';

export interface ChildDevice {
  id: string;
  name: string;
  avatar: string;
  deviceModel: string;
  batteryLevel: number;
  isCharging: boolean;
  networkType: 'Wifi' | '4G' | 'Dừng kết nối';
  status: DeviceStatus;
  screenTimeUsed: number; // in minutes
  screenTimeLimit: number; // in minutes (0 means unlimited)
  downtimeStart: string; // "HH:MM"
  downtimeEnd: string; // "HH:MM"
  isDowntimeEnabled: boolean;
  latitude: number;
  longitude: number;
  locationName: string;
  lastUpdated: string;
}

export interface AppItem {
  id: string;
  name: string;
  packageName: string;
  icon: string; // Lucide icon name or emoji
  category: 'social' | 'game' | 'education' | 'utility' | 'video';
  isBlocked: boolean;
  timeLimitMinutes?: number; // optional limit
  timeUsedMinutes: number;
  isInstalled: boolean;
}

export interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  type: 'safe' | 'restricted';
}

export interface SystemNotification {
  id: string;
  deviceId: string;
  deviceName: string;
  type: 'security' | 'location' | 'screentime' | 'sos' | 'app_request' | 'general';
  message: string;
  timestamp: Date;
  isRead: boolean;
}

export interface AppSuggestion {
  id: string;
  name: string;
  packageName: string;
  icon: string;
  category: 'education' | 'utility' | 'game' | 'video' | 'social';
  description: string;
}
