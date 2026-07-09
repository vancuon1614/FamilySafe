import express from "express";
import { kv } from "@vercel/kv";
import { ChildDevice, AppItem, SystemNotification, AppSuggestion } from "../src/types.js";

// Setup types for KV JSON database
interface DbSchema {
  devices: ChildDevice[];
  apps: Record<string, AppItem[]>;
  notifications: SystemNotification[];
  pairingSessions: Record<string, {
    code: string;
    name: string;
    avatar: string;
    os: 'iOS' | 'Android';
    status: 'pending' | 'paired';
    deviceId?: string;
  }>;
  pendingMessages: Record<string, string[]>;
}

const DB_KEY = "familysafe_db";

// Default initial mock data
const INITIAL_DEVICES: ChildDevice[] = [
  {
    id: "device-1",
    name: "Gia Minh",
    avatar: "👦",
    deviceModel: "iPhone 14 Pro",
    batteryLevel: 82,
    isCharging: false,
    networkType: "Wifi",
    status: "online",
    screenTimeUsed: 75,
    screenTimeLimit: 120,
    downtimeStart: "22:00",
    downtimeEnd: "06:00",
    isDowntimeEnabled: true,
    latitude: 10.7769,
    longitude: 106.7009,
    locationName: "Trường Trung học Cơ sở Nguyễn Du",
    lastUpdated: "Vừa xong",
  },
  {
    id: "device-2",
    name: "Bảo An",
    avatar: "👧",
    deviceModel: "Samsung Galaxy A54",
    batteryLevel: 45,
    isCharging: true,
    networkType: "4G",
    status: "online",
    screenTimeUsed: 110,
    screenTimeLimit: 180,
    downtimeStart: "21:30",
    downtimeEnd: "06:30",
    isDowntimeEnabled: false,
    latitude: 10.76262,
    longitude: 106.68122,
    locationName: "Lớp Học Thêm Tiếng Anh",
    lastUpdated: "2 phút trước",
  }
];

const INITIAL_APPS: Record<string, AppItem[]> = {
  "device-1": [
    { id: "app-tiktok", name: "TikTok", packageName: "com.zhiliaoapp.musically", icon: "📱", category: "social", isBlocked: true, timeUsedMinutes: 45, isInstalled: true, timeLimitMinutes: 30 },
    { id: "app-roblox", name: "Roblox", packageName: "com.roblox.client", icon: "🎮", category: "game", isBlocked: false, timeUsedMinutes: 15, isInstalled: true, timeLimitMinutes: 45 },
    { id: "app-duolingo", name: "Duolingo", packageName: "com.duolingo", icon: "🦉", category: "education", isBlocked: false, timeUsedMinutes: 10, isInstalled: true },
    { id: "app-youtube-kids", name: "YouTube Kids", packageName: "com.google.android.apps.youtube.kids", icon: "📺", category: "video", isBlocked: false, timeUsedMinutes: 5, isInstalled: true },
    { id: "app-facebook", name: "Facebook", packageName: "com.facebook.katana", icon: "👥", category: "social", isBlocked: false, timeUsedMinutes: 0, isInstalled: true, timeLimitMinutes: 15 },
    { id: "app-photos", name: "Thư viện Ảnh", packageName: "com.apple.mobileslideshow", icon: "🖼️", category: "utility", isBlocked: false, timeUsedMinutes: 0, isInstalled: true },
  ],
  "device-2": [
    { id: "app-tiktok", name: "TikTok", packageName: "com.zhiliaoapp.musically", icon: "📱", category: "social", isBlocked: false, timeUsedMinutes: 60, isInstalled: true },
    { id: "app-roblox", name: "Roblox", packageName: "com.roblox.client", icon: "🎮", category: "game", isBlocked: true, timeUsedMinutes: 40, isInstalled: true },
    { id: "app-duolingo", name: "Duolingo", packageName: "com.duolingo", icon: "🦉", category: "education", isBlocked: false, timeUsedMinutes: 5, isInstalled: true },
    { id: "app-youtube-kids", name: "YouTube Kids", packageName: "com.google.android.apps.youtube.kids", icon: "📺", category: "video", isBlocked: false, timeUsedMinutes: 5, isInstalled: true },
  ]
};

const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: "notif-1",
    deviceId: "device-1",
    deviceName: "Gia Minh",
    type: "location",
    message: "Gia Minh đã đến Trường Trung học Cơ sở Nguyễn Du.",
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    isRead: false,
  },
  {
    id: "notif-2",
    deviceId: "device-1",
    deviceName: "Gia Minh",
    type: "screentime",
    message: "Đã hết giới hạn 30 phút sử dụng ứng dụng TikTok hôm nay.",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    isRead: false,
  }
];

const DEFAULT_DB: DbSchema = {
  devices: INITIAL_DEVICES,
  apps: INITIAL_APPS,
  notifications: INITIAL_NOTIFICATIONS,
  pairingSessions: {},
  pendingMessages: {},
};

// Helper: Read DB from Vercel KV
async function readDb(): Promise<DbSchema> {
  try {
    const data = await kv.get<DbSchema>(DB_KEY);
    if (data) {
      // Ensure timestamps are date objects
      if (data.notifications) {
        data.notifications = data.notifications.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
      }
      // Guarantee properties exist
      if (!data.pendingMessages) data.pendingMessages = {};
      if (!data.pairingSessions) data.pairingSessions = {};
      return data;
    }
  } catch (error) {
    console.error("Error reading database from Vercel KV:", error);
  }

  // Fallback / Initial setup
  await writeDb(DEFAULT_DB);
  return DEFAULT_DB;
}

// Helper: Write DB to Vercel KV
async function writeDb(data: DbSchema): Promise<void> {
  try {
    await kv.set(DB_KEY, data);
  } catch (err) {
    console.error("Error writing database to Vercel KV:", err);
  }
}

const app = express();
app.use(express.json());

// API 1: Get full db state
app.get("/api/db", async (req, res) => {
  const db = await readDb();
  res.json(db);
});

// API 2: Reset database
app.post("/api/db/reset", async (req, res) => {
  await writeDb(DEFAULT_DB);
  res.json({ success: true, db: DEFAULT_DB });
});

// API 3: List all devices
app.get("/api/devices", async (req, res) => {
  const db = await readDb();
  res.json(db.devices);
});

// API 4: Update device configuration
app.post("/api/devices/:id/update", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const db = await readDb();
  
  let updated = false;
  db.devices = db.devices.map(d => {
    if (d.id === id) {
      updated = true;
      return {
        ...d,
        ...updates,
        lastUpdated: "Vừa xong"
      };
    }
    return d;
  });

  if (updated) {
    await writeDb(db);
    res.json({ success: true, device: db.devices.find(d => d.id === id) });
  } else {
    res.status(404).json({ error: "Device not found" });
  }
});

// API 5: Get device apps
app.get("/api/devices/:id/apps", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  res.json(db.apps[id] || []);
});

// API 6: Toggle or update app properties (Block/Limits)
app.post("/api/devices/:id/apps/toggle", async (req, res) => {
  const { id } = req.params;
  const { appId, isBlocked, timeLimitMinutes } = req.body;
  const db = await readDb();

  if (!db.apps[id]) {
    db.apps[id] = [];
  }

  db.apps[id] = db.apps[id].map(app => {
    if (app.id === appId) {
      const updatedApp = { ...app };
      if (isBlocked !== undefined) updatedApp.isBlocked = isBlocked;
      if (timeLimitMinutes !== undefined) {
        updatedApp.timeLimitMinutes = timeLimitMinutes === 0 ? undefined : timeLimitMinutes;
      }
      return updatedApp;
    }
    return app;
  });

  await writeDb(db);
  res.json({ success: true, apps: db.apps[id] });
});

// API 7: Remote App Install simulation/order
app.post("/api/devices/:id/apps/install", async (req, res) => {
  const { id } = req.params;
  const storeApp = req.body as AppSuggestion;
  const db = await readDb();

  if (!db.apps[id]) db.apps[id] = [];

  const existingIndex = db.apps[id].findIndex(a => a.packageName === storeApp.packageName);
  if (existingIndex !== -1) {
    db.apps[id][existingIndex].isInstalled = true;
    db.apps[id][existingIndex].isBlocked = false;
  } else {
    db.apps[id].push({
      id: `app-${storeApp.id}`,
      name: storeApp.name,
      packageName: storeApp.packageName,
      icon: storeApp.icon,
      category: storeApp.category,
      isBlocked: false,
      timeUsedMinutes: 0,
      isInstalled: true
    });
  }

  await writeDb(db);
  res.json({ success: true, apps: db.apps[id] });
});

// API 8: Remote App Uninstall
app.post("/api/devices/:id/apps/uninstall", async (req, res) => {
  const { id } = req.params;
  const { appId } = req.body;
  const db = await readDb();

  if (db.apps[id]) {
    db.apps[id] = db.apps[id].map(app => {
      if (app.id === appId) {
        return { ...app, isInstalled: false, isBlocked: false };
      }
      return app;
    });
    await writeDb(db);
  }
  res.json({ success: true, apps: db.apps[id] || [] });
});

// API 9: Send text / Push notification from parent to child
app.post("/api/devices/:id/send-message", async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const db = await readDb();

  if (!db.pendingMessages[id]) {
    db.pendingMessages[id] = [];
  }
  db.pendingMessages[id].push(text);
  await writeDb(db);
  res.json({ success: true });
});

// API 10: Trigger SOS panic alarm
app.post("/api/devices/:id/sos", async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const device = db.devices.find(d => d.id === id);

  if (device) {
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId: id,
      deviceName: device.name,
      type: "sos",
      message: `🆘 BÁO ĐỘNG SOS KHẨN CẤP: ${device.name} vừa bấm nút trợ giúp khẩn cấp! Vị trí ước tính tại ${device.locationName}.`,
      timestamp: new Date(),
      isRead: false
    };
    db.notifications.unshift(newNotif);
    await writeDb(db);
    res.json({ success: true, notification: newNotif });
  } else {
    res.status(404).json({ error: "Device not found" });
  }
});

// API 11: Get all system notifications
app.get("/api/notifications", async (req, res) => {
  const db = await readDb();
  res.json(db.notifications);
});

// API 12: Clear system notifications
app.post("/api/notifications/clear", async (req, res) => {
  const db = await readDb();
  db.notifications = [];
  await writeDb(db);
  res.json({ success: true });
});

// API 13: Push a custom notification
app.post("/api/notifications/add", async (req, res) => {
  const { deviceId, deviceName, type, message } = req.body;
  const db = await readDb();
  const newNotif: SystemNotification = {
    id: `notif-${Date.now()}`,
    deviceId,
    deviceName,
    type,
    message,
    timestamp: new Date(),
    isRead: false
  };
  db.notifications.unshift(newNotif);
  await writeDb(db);
  res.json({ success: true, notification: newNotif });
});

// ==========================================
// REAL DEVICE SYNC & PAIRING ENDPOINTS (FOR FLUTTER/IOS/ANDROID)
// ==========================================

// Generate pairing code
app.post("/api/pairing/create", async (req, res) => {
  const { name, childName, avatar, os } = req.body;
  const db = await readDb();

  // Create a 6 digit code
  const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
  const formattedCode = `${rawCode.slice(0, 3)}-${rawCode.slice(3)}`;

  db.pairingSessions[formattedCode] = {
    code: formattedCode,
    name: name || childName || "Trẻ Em",
    avatar: avatar || "🦁",
    os: os || "Android",
    status: "pending"
  };

  await writeDb(db);
  res.json({ code: formattedCode });
});

// Get status of pairing code
app.get("/api/pairing/status/:code", async (req, res) => {
  const { code } = req.params;
  const db = await readDb();
  const session = db.pairingSessions[code];

  if (!session) {
    return res.status(404).json({ error: "Pairing code not found" });
  }
  res.json({ status: session.status, deviceId: session.deviceId });
});

// JOIN Pairing (Called by real Flutter client)
app.post("/api/pairing/join", async (req, res) => {
  let { code, deviceModel, batteryLevel, apps, latitude, longitude } = req.body;
  
  // Tự động chuẩn hóa mã: ví dụ "505641" -> "505-641"
  if (code && typeof code === 'string') {
    const cleanCode = code.replace(/[\s-]/g, '');
    if (cleanCode.length === 6) {
      code = `${cleanCode.slice(0, 3)}-${cleanCode.slice(3)}`;
    }
  }

  const db = await readDb();
  const session = db.pairingSessions[code];

  if (!session) {
    return res.status(404).json({ error: "Mã liên kết không tồn tại hoặc đã hết hạn." });
  }

  if (session.status === "paired") {
    return res.status(400).json({ error: "Mã liên kết này đã được sử dụng." });
  }

  const deviceId = `device-${Date.now()}`;
  const newDevice: ChildDevice = {
    id: deviceId,
    name: session.name,
    avatar: session.avatar,
    deviceModel: deviceModel || (session.os === "iOS" ? "iPhone" : "Android Phone"),
    batteryLevel: batteryLevel !== undefined ? batteryLevel : 85,
    isCharging: false,
    networkType: "Wifi",
    status: "online",
    screenTimeUsed: 0,
    screenTimeLimit: 120, // 2 hours limit default
    downtimeStart: "22:00",
    downtimeEnd: "06:00",
    isDowntimeEnabled: true,
    latitude: latitude !== undefined ? latitude : 10.7725,
    longitude: longitude !== undefined ? longitude : 106.6980,
    locationName: "Vừa liên kết (Điện thoại thật)",
    lastUpdated: "Vừa xong"
  };

  // Add device to db
  db.devices.push(newDevice);

  // Initial apps reported by child
  const processedApps: AppItem[] = [];
  if (apps && Array.isArray(apps)) {
    apps.forEach((app: any, idx: number) => {
      processedApps.push({
        id: `app-real-${idx}`,
        name: app.name || "Ứng dụng",
        packageName: app.packageName || `com.app.${idx}`,
        icon: app.icon || "📱",
        category: app.category || "utility",
        isBlocked: false,
        timeUsedMinutes: app.timeUsedMinutes || 0,
        isInstalled: true,
        timeLimitMinutes: undefined
      });
    });
  } else {
    // Default initial bundle if client doesn't upload
    processedApps.push(
      { id: "app-tiktok", name: "TikTok", packageName: "com.zhiliaoapp.musically", icon: "📱", category: "social", isBlocked: false, timeUsedMinutes: 0, isInstalled: true },
      { id: "app-roblox", name: "Roblox", packageName: "com.roblox.client", icon: "🎮", category: "game", isBlocked: false, timeUsedMinutes: 0, isInstalled: true },
      { id: "app-duolingo", name: "Duolingo", packageName: "com.duolingo", icon: "🦉", category: "education", isBlocked: false, timeUsedMinutes: 0, isInstalled: true }
    );
  }

  db.apps[deviceId] = processedApps;

  // Trigger pairing success
  session.status = "paired";
  session.deviceId = deviceId;

  // Post notification
  const newNotif: SystemNotification = {
    id: `notif-${Date.now()}`,
    deviceId: deviceId,
    deviceName: newDevice.name,
    type: "general",
    message: `📱 LIÊN KẾT ĐIỆN THOẠI THẬT THÀNH CÔNG: Thiết bị ${newDevice.deviceModel} của ${newDevice.name} đã kết nối!`,
    timestamp: new Date(),
    isRead: false
  };
  db.notifications.unshift(newNotif);

  await writeDb(db);
  res.json({
    success: true,
    deviceId,
    deviceName: newDevice.name,
    config: {
      screenTimeLimit: newDevice.screenTimeLimit,
      isDowntimeEnabled: newDevice.isDowntimeEnabled,
      downtimeStart: newDevice.downtimeStart,
      downtimeEnd: newDevice.downtimeEnd,
      status: newDevice.status
    }
  });
});

// REAL DEVICE PERIODIC REPORTING & HEARTBEAT (FLUTTER CLIENT POLLS / POSTS TO THIS)
app.post("/api/devices/:id/report", async (req, res) => {
  const { id } = req.params;
  const { batteryLevel, isCharging, networkType, screenTimeUsed, latitude, longitude, locationName, apps } = req.body;
  const db = await readDb();

  let deviceIndex = db.devices.findIndex(d => d.id === id);
  if (deviceIndex === -1) {
    return res.status(404).json({ error: "Device not found" });
  }

  const device = db.devices[deviceIndex];

  // Update real metrics
  if (batteryLevel !== undefined) device.batteryLevel = batteryLevel;
  if (isCharging !== undefined) device.isCharging = isCharging;
  if (networkType !== undefined) device.networkType = networkType;
  if (screenTimeUsed !== undefined) device.screenTimeUsed = screenTimeUsed;
  if (latitude !== undefined) device.latitude = latitude;
  if (longitude !== undefined) device.longitude = longitude;
  if (locationName !== undefined) device.locationName = locationName;
  device.lastUpdated = "Vừa xong";

  // Update apps list if uploaded
  if (apps && Array.isArray(apps)) {
    const existingApps = db.apps[id] || [];
    // We will merge or update the reported app usage minutes
    apps.forEach((reportedApp: any) => {
      const index = existingApps.findIndex(a => a.packageName === reportedApp.packageName);
      if (index !== -1) {
        if (reportedApp.timeUsedMinutes !== undefined) {
          existingApps[index].timeUsedMinutes = reportedApp.timeUsedMinutes;
        }
        if (reportedApp.isInstalled !== undefined) {
          existingApps[index].isInstalled = reportedApp.isInstalled;
        }
      } else {
        // Add new discovered app
        existingApps.push({
          id: `app-real-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: reportedApp.name || "Ứng dụng mới",
          packageName: reportedApp.packageName,
          icon: reportedApp.icon || "📱",
          category: reportedApp.category || "utility",
          isBlocked: false,
          timeUsedMinutes: reportedApp.timeUsedMinutes || 0,
          isInstalled: true
        });
      }
    });
    db.apps[id] = existingApps;
  }

  // Pull any pending push notifications / text messages
  const messages = db.pendingMessages[id] || [];
  db.pendingMessages[id] = []; // Clear queue

  await writeDb(db);

  // Get list of blocked package names and app time limits
  const deviceApps = db.apps[id] || [];
  const blockedApps = deviceApps.filter(a => a.isBlocked && a.isInstalled).map(a => a.packageName);
  const appLimits = deviceApps
    .filter(a => a.timeLimitMinutes !== undefined && a.isInstalled)
    .map(a => ({ packageName: a.packageName, limitMinutes: a.timeLimitMinutes }));

  // Send back configuration to the physical child phone
  res.json({
    status: device.status, // "online" | "blocked" | "downtime"
    screenTimeLimit: device.screenTimeLimit,
    screenTimeUsed: device.screenTimeUsed,
    isDowntimeEnabled: device.isDowntimeEnabled,
    downtimeStart: device.downtimeStart,
    downtimeEnd: device.downtimeEnd,
    blockedApps,
    appLimits,
    incomingMessages: messages
  });
});

export default app;
