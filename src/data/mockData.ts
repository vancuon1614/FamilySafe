import { ChildDevice, AppItem, Geofence, SystemNotification, AppSuggestion } from '../types';

export const INITIAL_DEVICES: ChildDevice[] = [
  {
    id: 'device-1',
    name: 'Gia Minh',
    avatar: '👦',
    deviceModel: 'iPhone 14 Pro',
    batteryLevel: 82,
    isCharging: false,
    networkType: 'Wifi',
    status: 'online',
    screenTimeUsed: 75,
    screenTimeLimit: 120, // 2 hours
    downtimeStart: '22:00',
    downtimeEnd: '06:00',
    isDowntimeEnabled: true,
    latitude: 10.7769, // Near Notre-Dame Cathedral Saigon
    longitude: 106.7009,
    locationName: 'Trường Trung học Cơ sở Nguyễn Du',
    lastUpdated: 'Vừa xong',
  },
  {
    id: 'device-2',
    name: 'Bảo An',
    avatar: '👧',
    deviceModel: 'Samsung Galaxy A54',
    batteryLevel: 45,
    isCharging: true,
    networkType: '4G',
    status: 'online',
    screenTimeUsed: 110,
    screenTimeLimit: 180, // 3 hours
    downtimeStart: '21:30',
    downtimeEnd: '06:30',
    isDowntimeEnabled: false,
    latitude: 10.76262, // Near Ben Thanh Market
    longitude: 106.68122,
    locationName: 'Lớp Học Thêm Tiếng Anh',
    lastUpdated: '2 phút trước',
  }
];

export const INITIAL_APPS: Record<string, AppItem[]> = {
  'device-1': [
    { id: 'app-tiktok', name: 'TikTok', packageName: 'com.zhiliaoapp.musically', icon: '📱', category: 'social', isBlocked: true, timeUsedMinutes: 45, isInstalled: true, timeLimitMinutes: 30 },
    { id: 'app-roblox', name: 'Roblox', packageName: 'com.roblox.client', icon: '🎮', category: 'game', isBlocked: false, timeUsedMinutes: 15, isInstalled: true, timeLimitMinutes: 45 },
    { id: 'app-duolingo', name: 'Duolingo', packageName: 'com.duolingo', icon: '🦉', category: 'education', isBlocked: false, timeUsedMinutes: 10, isInstalled: true },
    { id: 'app-youtube-kids', name: 'YouTube Kids', packageName: 'com.google.android.apps.youtube.kids', icon: '📺', category: 'video', isBlocked: false, timeUsedMinutes: 5, isInstalled: true },
    { id: 'app-facebook', name: 'Facebook', packageName: 'com.facebook.katana', icon: '👥', category: 'social', isBlocked: false, timeUsedMinutes: 0, isInstalled: true, timeLimitMinutes: 15 },
    { id: 'app-photos', name: 'Thư viện Ảnh', packageName: 'com.apple.mobileslideshow', icon: '🖼️', category: 'utility', isBlocked: false, timeUsedMinutes: 0, isInstalled: true },
  ],
  'device-2': [
    { id: 'app-tiktok', name: 'TikTok', packageName: 'com.zhiliaoapp.musically', icon: '📱', category: 'social', isBlocked: false, timeUsedMinutes: 60, isInstalled: true },
    { id: 'app-roblox', name: 'Roblox', packageName: 'com.roblox.client', icon: '🎮', category: 'game', isBlocked: true, timeUsedMinutes: 40, isInstalled: true },
    { id: 'app-duolingo', name: 'Duolingo', packageName: 'com.duolingo', icon: '🦉', category: 'education', isBlocked: false, timeUsedMinutes: 5, isInstalled: true },
    { id: 'app-youtube-kids', name: 'YouTube Kids', packageName: 'com.google.android.apps.youtube.kids', icon: '📺', category: 'video', isBlocked: false, timeUsedMinutes: 5, isInstalled: true },
  ]
};

export const GEOFENCES: Geofence[] = [
  { id: 'geo-home', name: 'Nhà riêng (Home)', latitude: 10.7725, longitude: 106.6980, radius: 150, type: 'safe' },
  { id: 'geo-school', name: 'Trường học Nguyễn Du', latitude: 10.7769, longitude: 106.7009, radius: 200, type: 'safe' },
  { id: 'geo-park', name: 'Công viên Tao Đàn', latitude: 10.7743, longitude: 106.6913, radius: 250, type: 'safe' },
  { id: 'geo-game', name: 'Quán Net Cyber (Cấm)', latitude: 10.7680, longitude: 106.6940, radius: 100, type: 'restricted' },
];

export const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'notif-1',
    deviceId: 'device-1',
    deviceName: 'Gia Minh',
    type: 'location',
    message: 'Gia Minh đã đến Trường Trung học Cơ sở Nguyễn Du.',
    timestamp: new Date(Date.now() - 25 * 60 * 1000), // 25m ago
    isRead: false,
  },
  {
    id: 'notif-2',
    deviceId: 'device-1',
    deviceName: 'Gia Minh',
    type: 'screentime',
    message: 'Đã hết giới hạn 30 phút sử dụng ứng dụng TikTok hôm nay.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45m ago
    isRead: false,
  },
  {
    id: 'notif-3',
    deviceId: 'device-2',
    deviceName: 'Bảo An',
    type: 'general',
    message: 'Bảo An đã cắm sạc thiết bị Samsung Galaxy A54.',
    timestamp: new Date(Date.now() - 12 * 60 * 1000), // 12m ago
    isRead: true,
  }
];

export const APP_STORE_SUGGESTIONS: AppSuggestion[] = [
  { id: 'store-minecraft', name: 'Minecraft', packageName: 'com.mojang.minecraftpe', icon: '🧱', category: 'game', description: 'Trò chơi thế giới mở rèn luyện tư duy không gian và sáng tạo.' },
  { id: 'store-khan', name: 'Khan Academy Kids', packageName: 'org.khankids.android', icon: '🎒', category: 'education', description: 'Chương trình học tập vui nhộn, miễn phí cho trẻ em.' },
  { id: 'store-instagram', name: 'Instagram', packageName: 'com.instagram.android', icon: '📸', category: 'social', description: 'Mạng xã hội chia sẻ ảnh và video ngắn.' },
  { id: 'store-chess', name: 'Chess for Kids', packageName: 'com.chess.kids', icon: '👑', category: 'game', description: 'Học và chơi cờ vua trực tuyến phù hợp cho trẻ.' },
  { id: 'store-calculator', name: 'Calculator Pro', packageName: 'com.math.calculator', icon: '🧮', category: 'utility', description: 'Ứng dụng giải toán và máy tính hỗ trợ học tập.' },
  { id: 'store-youtube', name: 'YouTube', packageName: 'com.google.android.youtube', icon: '❤️', category: 'video', description: 'Kênh chia sẻ video phổ biến nhất thế giới.' }
];
