import React, { useState, useEffect } from 'react';
import { ChildDevice as DeviceType, AppItem, SystemNotification, AppSuggestion } from './types';
import { INITIAL_DEVICES, INITIAL_APPS, INITIAL_NOTIFICATIONS } from './data/mockData';
import ParentDashboard from './components/ParentDashboard';
import ChildDevice from './components/ChildDevice';
import PairingModal from './components/PairingModal';
import { Shield, Sparkles, User, Smartphone, LayoutGrid, RotateCcw } from 'lucide-react';

export default function App() {
  // Mode selection: dual-screen (default), parent dashboard only, or child simulator only
  const [viewMode, setViewMode] = useState<'dual' | 'parent' | 'child'>('dual');
  
  // App States
  const [devices, setDevices] = useState<DeviceType[]>(INITIAL_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('device-1');
  const [appsState, setAppsState] = useState<Record<string, AppItem[]>>(INITIAL_APPS);
  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);
  
  // Modals & triggers
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [pushMessage, setPushMessage] = useState<{ text: string; timestamp: number } | null>(null);

  // Active Device helper
  const activeDevice = devices.find(d => d.id === selectedDeviceId) || devices[0];
  const activeDeviceApps = appsState[activeDevice.id] || [];

  // Fetch full state from backend Express server
  const fetchState = async () => {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const data = await res.json();
        if (data.devices) {
          setDevices(data.devices);
        }
        if (data.apps) {
          setAppsState(data.apps);
        }
        if (data.notifications) {
          const formatted = data.notifications.map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp)
          }));
          setNotifications(formatted);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch state from backend:", e);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3500); // Poll server state every 3.5 seconds
    return () => clearInterval(interval);
  }, []);

  const saveStateToLocalStorage = (updatedDevices: DeviceType[], updatedApps: Record<string, AppItem[]>, updatedNotifs: SystemNotification[]) => {
    // Keep local storage as a quick offline fallback
    localStorage.setItem('familysafe_devices', JSON.stringify(updatedDevices));
    localStorage.setItem('familysafe_apps', JSON.stringify(updatedApps));
    localStorage.setItem('familysafe_notifications', JSON.stringify(updatedNotifs));
  };

  // 1. ADD PAIRING DEVICE
  const handleAddDevice = async (newDevice: DeviceType) => {
    const updatedDevices = [...devices, newDevice];
    
    // Seed standard apps for this new paired device
    const seedAppsForNewDevice: AppItem[] = [
      { id: 'app-tiktok', name: 'TikTok', packageName: 'com.zhiliaoapp.musically', icon: '📱', category: 'social', isBlocked: false, timeUsedMinutes: 0, isInstalled: true },
      { id: 'app-roblox', name: 'Roblox', packageName: 'com.roblox.client', icon: '🎮', category: 'game', isBlocked: false, timeUsedMinutes: 0, isInstalled: true },
      { id: 'app-duolingo', name: 'Duolingo', packageName: 'com.duolingo', icon: '🦉', category: 'education', isBlocked: false, timeUsedMinutes: 0, isInstalled: true },
      { id: 'app-youtube-kids', name: 'YouTube Kids', packageName: 'com.google.android.apps.youtube.kids', icon: '📺', category: 'video', isBlocked: false, timeUsedMinutes: 0, isInstalled: true },
    ];

    const updatedApps = {
      ...appsState,
      [newDevice.id]: seedAppsForNewDevice
    };

    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId: newDevice.id,
      deviceName: newDevice.name,
      type: 'general',
      message: `🎉 Đã liên kết thành công thiết bị trẻ em mới: ${newDevice.name} (${newDevice.deviceModel}).`,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setDevices(updatedDevices);
    setAppsState(updatedApps);
    setNotifications(updatedNotifs);
    setSelectedDeviceId(newDevice.id);

    saveStateToLocalStorage(updatedDevices, updatedApps, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${newDevice.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: newDevice.id,
          deviceName: newDevice.name,
          type: 'general',
          message: newNotif.message
        })
      });
    } catch (e) {
      console.error(e);
    }

    alert(`Đã hoàn tất liên kết thiết bị của ${newDevice.name}!`);
  };

  // 2. REMOTE DEVICE LOCK/UNLOCK TOGLE
  const handleToggleDeviceBlock = async (deviceId: string) => {
    const targetDevice = devices.find(d => d.id === deviceId);
    if (!targetDevice) return;
    const nextStatus = targetDevice.status === 'blocked' ? 'online' : 'blocked';

    const updatedDevices = devices.map(d => {
      if (d.id === deviceId) {
        return { ...d, status: nextStatus };
      }
      return d;
    });

    const isNowBlocked = nextStatus === 'blocked';
    const messageText = isNowBlocked 
      ? `🔒 Bạn đã KHÓA thiết bị của ${targetDevice.name} từ xa.`
      : `🔓 Bạn đã MỞ KHÓA thiết bị của ${targetDevice.name} từ xa.`;
    
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId,
      deviceName: targetDevice.name,
      type: 'security',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setDevices(updatedDevices);
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(updatedDevices, appsState, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${deviceId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: targetDevice.name,
          type: 'security',
          message: messageText
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 3. UPDATE SCREEN TIME LIMITS
  const handleUpdateScreenLimit = async (deviceId: string, limitMinutes: number) => {
    const targetDevice = devices.find(d => d.id === deviceId);
    if (!targetDevice) return;

    const updatedDevices = devices.map(d => {
      if (d.id === deviceId) {
        return { ...d, screenTimeLimit: limitMinutes };
      }
      return d;
    });

    const messageText = limitMinutes === 0
      ? `⏱️ Bạn đã bỏ giới hạn thời gian sử dụng thiết bị hôm nay của ${targetDevice.name}.`
      : `⏱️ Bạn đã thiết lập giới hạn sử dụng máy của ${targetDevice.name} thành ${limitMinutes} phút/ngày.`;

    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId,
      deviceName: targetDevice.name,
      type: 'screentime',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setDevices(updatedDevices);
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(updatedDevices, appsState, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${deviceId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenTimeLimit: limitMinutes })
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: targetDevice.name,
          type: 'screentime',
          message: messageText
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 4. DOWNTIME CONFIGURATIONS
  const handleToggleDowntime = async (deviceId: string, enabled: boolean) => {
    const targetDevice = devices.find(d => d.id === deviceId);
    if (!targetDevice) return;

    const updatedDevices = devices.map(d => {
      if (d.id === deviceId) {
        return { ...d, isDowntimeEnabled: enabled };
      }
      return d;
    });

    const messageText = enabled
      ? `💤 Đã BẬT lịch đi ngủ tự động khóa máy (${targetDevice.downtimeStart} - ${targetDevice.downtimeEnd}) của ${targetDevice.name}.`
      : `💤 Đã TẮT lịch đi ngủ tự động khóa máy của ${targetDevice.name}.`;

    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId,
      deviceName: targetDevice.name,
      type: 'screentime',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setDevices(updatedDevices);
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(updatedDevices, appsState, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${deviceId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDowntimeEnabled: enabled })
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: targetDevice.name,
          type: 'screentime',
          message: messageText
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateDowntimeHours = async (deviceId: string, start: string, end: string) => {
    const targetDevice = devices.find(d => d.id === deviceId);
    if (!targetDevice) return;

    const updatedDevices = devices.map(d => {
      if (d.id === deviceId) {
        return { ...d, downtimeStart: start, downtimeEnd: end };
      }
      return d;
    });

    const messageText = `💤 Đã cập nhật khung giờ đi ngủ của ${targetDevice.name} thành: ${start} đến ${end}.`;
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId,
      deviceName: targetDevice.name,
      type: 'screentime',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setDevices(updatedDevices);
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(updatedDevices, appsState, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${deviceId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downtimeStart: start, downtimeEnd: end })
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: targetDevice.name,
          type: 'screentime',
          message: messageText
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 5. APP LOCKS & LIMITS
  const handleToggleAppBlock = async (deviceId: string, appId: string) => {
    const deviceApps = appsState[deviceId] || [];
    const affectedApp = deviceApps.find(a => a.id === appId);
    if (!affectedApp) return;

    const isNowBlocked = !affectedApp.isBlocked;
    const updatedDeviceApps = deviceApps.map(app => {
      if (app.id === appId) {
        return { ...app, isBlocked: isNowBlocked };
      }
      return app;
    });

    const updatedApps = {
      ...appsState,
      [deviceId]: updatedDeviceApps
    };

    const messageText = isNowBlocked
      ? `🛡️ Bạn đã CHẶN truy cập ứng dụng ${affectedApp.name} của ${activeDevice.name}.`
      : `🔓 Bạn đã CHO PHÉP truy cập ứng dụng ${affectedApp.name} của ${activeDevice.name}.`;

    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId,
      deviceName: activeDevice.name,
      type: 'security',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setAppsState(updatedApps);
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(devices, updatedApps, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${deviceId}/apps/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, isBlocked: isNowBlocked })
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: activeDevice.name,
          type: 'security',
          message: messageText
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateAppLimit = async (deviceId: string, appId: string, limitMinutes: number | undefined) => {
    const deviceApps = appsState[deviceId] || [];
    const affectedApp = deviceApps.find(a => a.id === appId);
    if (!affectedApp) return;

    const updatedDeviceApps = deviceApps.map(app => {
      if (app.id === appId) {
        return { ...app, timeLimitMinutes: limitMinutes };
      }
      return app;
    });

    const updatedApps = {
      ...appsState,
      [deviceId]: updatedDeviceApps
    };

    const messageText = limitMinutes
      ? `⏳ Đã đặt hạn mức ${limitMinutes} phút/ngày cho ứng dụng ${affectedApp.name} của ${activeDevice.name}.`
      : `⏳ Đã bỏ hạn mức thời gian cho ứng dụng ${affectedApp.name} của ${activeDevice.name}.`;

    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId,
      deviceName: activeDevice.name,
      type: 'screentime',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setAppsState(updatedApps);
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(devices, updatedApps, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${deviceId}/apps/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, timeLimitMinutes: limitMinutes === undefined ? 0 : limitMinutes })
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: activeDevice.name,
          type: 'screentime',
          message: messageText
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 6. SOFTWARE UNINSTALLATION FROM CHILD (Xoá phần mềm trên máy child)
  const handleUninstallApp = async (deviceId: string, appId: string) => {
    const deviceApps = appsState[deviceId] || [];
    const affectedApp = deviceApps.find(a => a.id === appId);
    if (!affectedApp) return;

    const updatedDeviceApps = deviceApps.map(app => {
      if (app.id === appId) {
        return { ...app, isInstalled: false, isBlocked: false };
      }
      return app;
    });

    const updatedApps = {
      ...appsState,
      [deviceId]: updatedDeviceApps
    };

    const messageText = `🗑️ Bạn đã GỠ CÀI ĐẶT từ xa phần mềm ${affectedApp.name} khỏi thiết bị của ${activeDevice.name}.`;

    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId,
      deviceName: activeDevice.name,
      type: 'security',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setAppsState(updatedApps);
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(devices, updatedApps, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${deviceId}/apps/uninstall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId })
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: activeDevice.name,
          type: 'security',
          message: messageText
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 7. REMOTE SOFTWARE INSTALLATION (Cài đặt phần mềm lên máy child)
  const handleInstallApp = async (deviceId: string, storeApp: AppSuggestion) => {
    const deviceApps = appsState[deviceId] || [];
    const exists = deviceApps.some(app => app.packageName === storeApp.packageName);
    
    let updatedDeviceApps: AppItem[] = [];
    if (exists) {
      updatedDeviceApps = deviceApps.map(app => {
        if (app.packageName === storeApp.packageName) {
          return { ...app, isInstalled: true, isBlocked: false };
        }
        return app;
      });
    } else {
      const newAppItem: AppItem = {
        id: `app-${storeApp.id}`,
        name: storeApp.name,
        packageName: storeApp.packageName,
        icon: storeApp.icon,
        category: storeApp.category,
        isBlocked: false,
        timeUsedMinutes: 0,
        isInstalled: true
      };
      updatedDeviceApps = [...deviceApps, newAppItem];
    }

    const updatedApps = {
      ...appsState,
      [deviceId]: updatedDeviceApps
    };

    const messageText = `📥 Bạn đã CÀI ĐẶT từ xa phần mềm ${storeApp.name} thành công lên thiết bị của ${activeDevice.name}.`;

    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId,
      deviceName: activeDevice.name,
      type: 'security',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];

    setAppsState(updatedApps);
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(devices, updatedApps, updatedNotifs);

    // REST API call
    try {
      await fetch(`/api/devices/${deviceId}/apps/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeApp)
      });
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceName: activeDevice.name,
          type: 'security',
          message: messageText
        })
      });
    } catch (e) {
      console.error(e);
    }

    alert(`Đã cài đặt từ xa ${storeApp.name} thành công!`);
  };

  // 8. SEND PUSH BANNER (Gửi tin nhắn qua REST API cho điện thoại thật)
  const handleSendMessage = async (text: string) => {
    // 1. Sets simulator's local push message state (for local preview)
    setPushMessage({
      text,
      timestamp: Date.now()
    });

    // 2. Queue the message on the backend server so the real phone retrieves it on its next poll!
    try {
      await fetch(`/api/devices/${activeDevice.id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 9. CHILD ACTIVITIES LOGGING
  const handleChildActivity = async (message: string, type: 'screentime' | 'security') => {
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId: activeDevice.id,
      deviceName: activeDevice.name,
      type,
      message,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(devices, appsState, updatedNotifs);

    try {
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: activeDevice.id,
          deviceName: activeDevice.name,
          type,
          message
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 10. REAL-TIME CHILD SCREEN TIME DEPLETION
  const handleDeductTime = async (minutes: number) => {
    const updatedDevices = devices.map(d => {
      if (d.id === activeDevice.id) {
        return { 
          ...d, 
          screenTimeUsed: d.screenTimeUsed + minutes 
        };
      }
      return d;
    });

    const updatedApps = {
      ...appsState,
      [activeDevice.id]: (appsState[activeDevice.id] || []).map(app => {
        if (app.isInstalled && !app.isBlocked && ['social', 'game', 'video'].includes(app.category)) {
          return { ...app, timeUsedMinutes: app.timeUsedMinutes + minutes };
        }
        return app;
      })
    };

    setDevices(updatedDevices);
    setAppsState(updatedApps);
    saveStateToLocalStorage(updatedDevices, updatedApps, notifications);

    // Update server too
    try {
      const currentDev = updatedDevices.find(d => d.id === activeDevice.id);
      if (currentDev) {
        await fetch(`/api/devices/${activeDevice.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenTimeUsed: currentDev.screenTimeUsed })
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 11. LOCATION SYNC & TRIGGER
  const handleUpdateLocation = async (lat: number, lng: number, locName: string) => {
    const updatedDevices = devices.map(d => {
      if (d.id === activeDevice.id) {
        return {
          ...d,
          latitude: lat,
          longitude: lng,
          locationName: locName,
          lastUpdated: 'Vừa xong'
        };
      }
      return d;
    });
    setDevices(updatedDevices);
    saveStateToLocalStorage(updatedDevices, appsState, notifications);

    try {
      await fetch(`/api/devices/${activeDevice.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng, locationName: locName })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLocationTrigger = async (message: string, type: 'location' | 'security') => {
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId: activeDevice.id,
      deviceName: activeDevice.name,
      type,
      message,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(devices, appsState, updatedNotifs);

    try {
      await fetch(`/api/notifications/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: activeDevice.id,
          deviceName: activeDevice.name,
          type,
          message
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 12. SOS PANIC SYSTEM (Phát cảnh báo lên server để lưu vào database)
  const handleTriggerSOS = async () => {
    const messageText = `🆘 BÁO ĐỘNG SOS KHẨN CẤP: ${activeDevice.name} vừa bấm nút trợ giúp khẩn cấp! Vị trí ước tính tại ${activeDevice.locationName}.`;
    
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      deviceId: activeDevice.id,
      deviceName: activeDevice.name,
      type: 'sos',
      message: messageText,
      timestamp: new Date(),
      isRead: false
    };

    const updatedNotifs = [newNotif, ...notifications];
    setNotifications(updatedNotifs);
    saveStateToLocalStorage(devices, appsState, updatedNotifs);
    
    try {
      await fetch(`/api/devices/${activeDevice.id}/sos`, {
        method: 'POST'
      });
    } catch (e) {
      console.error(e);
    }

    // Play a visual overlay alerts on parent side
    alert(`🚨 SOS CẢNH BÁO KHẨN CẤP TỪ ${activeDevice.name.toUpperCase()}!\nBé vừa nhấn phím kích hoạt SOS khẩn cấp!`);
  };

  // 13. RESET SEED
  const handleResetAppSeed = async () => {
    if (window.confirm("Bạn có muốn đặt lại toàn bộ dữ liệu mẫu ban đầu không?")) {
      localStorage.removeItem('familysafe_devices');
      localStorage.removeItem('familysafe_apps');
      localStorage.removeItem('familysafe_notifications');
      
      try {
        const res = await fetch('/api/db/reset', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.db) {
            setDevices(data.db.devices);
            setAppsState(data.db.apps);
            setNotifications(data.db.notifications.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
            setSelectedDeviceId(data.db.devices[0].id);
          }
        }
      } catch (e) {
        setDevices(INITIAL_DEVICES);
        setAppsState(INITIAL_APPS);
        setNotifications(INITIAL_NOTIFICATIONS);
        setSelectedDeviceId('device-1');
      }
      alert("Đã khôi phục dữ liệu mô phỏng gốc và xóa các thiết bị thật.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between" id="app-root">
      
      {/* GLOBAL BANNER HEADER */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 px-4 md:px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
              FamilySafe Link <span className="bg-indigo-500/15 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/10">v1.2.0</span>
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block">Giải pháp mô phỏng giám sát máy trẻ em toàn diện</p>
          </div>
        </div>

        {/* VIEW MODE SWICHERS (Giúp xem thử được cả Parent và Child) */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 border border-slate-800/80 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setViewMode('dual')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              viewMode === 'dual'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mô phỏng Song Song</span>
            <span className="sm:hidden">Song Song</span>
          </button>
          <button
            onClick={() => setViewMode('parent')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              viewMode === 'parent'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bản Phụ Huynh</span>
            <span className="sm:hidden">Phụ Huynh</span>
          </button>
          <button
            onClick={() => setViewMode('child')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              viewMode === 'child'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Điện thoại Trẻ</span>
            <span className="sm:hidden">Trẻ Em</span>
          </button>
        </div>

        {/* RESET SEED BUTTON */}
        <button
          onClick={handleResetAppSeed}
          className="p-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
          title="Đặt lại dữ liệu mẫu"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* CORE DISPLAY STAGE */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto p-4 md:p-6 flex flex-col justify-center">
        
        {/* VIEW A: DUAL MODE VIEW - SPLIT SCREEN (Highly recommended for previewing changes live) */}
        {viewMode === 'dual' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch" id="view-dual-screen">
            
            {/* Left side: Parent controls (65% width) */}
            <div className="lg:col-span-8 h-full">
              <ParentDashboard
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                apps={activeDeviceApps}
                notifications={notifications}
                onToggleDeviceBlock={handleToggleDeviceBlock}
                onUpdateScreenLimit={handleUpdateScreenLimit}
                onToggleDowntime={handleToggleDowntime}
                onUpdateDowntimeHours={handleUpdateDowntimeHours}
                onToggleAppBlock={handleToggleAppBlock}
                onUpdateAppLimit={handleUpdateAppLimit}
                onUninstallApp={handleUninstallApp}
                onInstallApp={handleInstallApp}
                onSendMessage={handleSendMessage}
                onClearNotifications={() => {
                  setNotifications([]);
                  localStorage.setItem('familysafe_notifications', '[]');
                }}
                onOpenPairingModal={() => setIsPairingOpen(true)}
                onUpdateLocation={handleUpdateLocation}
                onLocationTrigger={handleLocationTrigger}
              />
            </div>

            {/* Right side: Child device simulator (35% width) */}
            <div className="lg:col-span-4 h-full flex items-center justify-center">
              <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-3xl w-full flex justify-center">
                <ChildDevice
                  device={activeDevice}
                  apps={activeDeviceApps}
                  onTriggerSOS={handleTriggerSOS}
                  onChildActivity={handleChildActivity}
                  onDeductTime={handleDeductTime}
                  incomingMessage={pushMessage}
                />
              </div>
            </div>

          </div>
        )}

        {/* VIEW B: PARENT ONLY VIEW (Full screen width) */}
        {viewMode === 'parent' && (
          <div className="w-full max-w-5xl mx-auto" id="view-parent-only">
            <ParentDashboard
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={setSelectedDeviceId}
              apps={activeDeviceApps}
              notifications={notifications}
              onToggleDeviceBlock={handleToggleDeviceBlock}
              onUpdateScreenLimit={handleUpdateScreenLimit}
              onToggleDowntime={handleToggleDowntime}
              onUpdateDowntimeHours={handleUpdateDowntimeHours}
              onToggleAppBlock={handleToggleAppBlock}
              onUpdateAppLimit={handleUpdateAppLimit}
              onUninstallApp={handleUninstallApp}
              onInstallApp={handleInstallApp}
              onSendMessage={handleSendMessage}
              onClearNotifications={() => {
                setNotifications([]);
                localStorage.setItem('familysafe_notifications', '[]');
              }}
              onOpenPairingModal={() => setIsPairingOpen(true)}
              onUpdateLocation={handleUpdateLocation}
              onLocationTrigger={handleLocationTrigger}
            />
          </div>
        )}

        {/* VIEW C: CHILD ONLY VIEW (Centered phone mockup) */}
        {viewMode === 'child' && (
          <div className="max-w-md mx-auto w-full bg-slate-900 border border-slate-850 p-6 rounded-3xl" id="view-child-only">
            <ChildDevice
              device={activeDevice}
              apps={activeDeviceApps}
              onTriggerSOS={handleTriggerSOS}
              onChildActivity={handleChildActivity}
              onDeductTime={handleDeductTime}
              incomingMessage={pushMessage}
            />
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900/40 border-t border-slate-900 py-3.5 text-center text-xs text-slate-500">
        <p>© 2026 FamilySafe Link. Phát triển cho Flutter / Web Multi-Platform. Bảo mật & An toàn cho trẻ nhỏ.</p>
      </footer>

      {/* PAIRING MODAL WIZARD */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        onAddDevice={handleAddDevice}
      />

    </div>
  );
}
