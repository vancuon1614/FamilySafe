import React, { useState, useEffect, useRef } from 'react';
import { ChildDevice as DeviceType, AppItem, SystemNotification } from '../types';
import { 
  Wifi, Battery, ShieldAlert, Lock, HelpCircle, ArrowLeft, 
  Settings, Play, Award, CheckCircle, Flame, Eye, VolumeX, Smartphone
} from 'lucide-react';

interface ChildDeviceProps {
  device: DeviceType;
  apps: AppItem[];
  onTriggerSOS: () => void;
  onChildActivity: (message: string, type: 'screentime' | 'security') => void;
  onDeductTime: (minutes: number) => void;
  incomingMessage: { text: string; timestamp: number } | null;
}

export default function ChildDevice({ 
  device, 
  apps, 
  onTriggerSOS, 
  onChildActivity, 
  onDeductTime,
  incomingMessage
}: ChildDeviceProps) {
  const [activeScreen, setActiveScreen] = useState<'home' | 'app' | 'settings' | 'blocked_warning'>('home');
  const [activeApp, setActiveApp] = useState<AppItem | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState('15:30');

  // Duolingo state
  const [languageScore, setLanguageScore] = useState(0);
  // Youtube Kids state
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  // Auto time ticking for clock and active app screen time reduction
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitor incoming push messages from Parent
  useEffect(() => {
    if (incomingMessage && Date.now() - incomingMessage.timestamp < 3000) {
      setNotificationBanner(incomingMessage.text);
      // Automatically hide banner after 5 seconds
      const bannerTimer = setTimeout(() => {
        setNotificationBanner(null);
      }, 5000);
      return () => clearTimeout(bannerTimer);
    }
  }, [incomingMessage]);

  // Monitor screen time consumption when inside a mock app
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeScreen === 'app' && activeApp) {
      interval = setInterval(() => {
        // Deplete overall limit and app limit by 1 minute (represented as 1 minute every 5 seconds for demonstration)
        onDeductTime(1);
        
        // Check if limit is now exceeded
        const currentLimit = device.screenTimeLimit;
        const currentUsed = device.screenTimeUsed + 1;
        
        if (currentLimit > 0 && currentUsed >= currentLimit) {
          setActiveScreen('home');
          setActiveApp(null);
          onChildActivity(`🛑 Thiết bị ${device.name} tự động Khóa do đã dùng hết giới hạn màn hình cả ngày (${currentLimit} phút).`, 'screentime');
        }

        // Check if specific app limit is exceeded
        if (activeApp.timeLimitMinutes) {
          const appUsed = activeApp.timeUsedMinutes + 1;
          if (appUsed >= activeApp.timeLimitMinutes) {
            setActiveScreen('home');
            setActiveApp(null);
            onChildActivity(`⏳ ${device.name} đã dùng hết giới hạn ${activeApp.timeLimitMinutes} phút cho ứng dụng ${activeApp.name}.`, 'screentime');
          }
        }
      }, 6000); // Ticks every 6 seconds = 1 virtual minute
    }
    return () => clearInterval(interval);
  }, [activeScreen, activeApp, device.screenTimeUsed, device.screenTimeLimit]);

  const handleOpenApp = (app: AppItem) => {
    if (app.isBlocked) {
      setActiveApp(app);
      setActiveScreen('blocked_warning');
      onChildActivity(`⚠️ Cảnh báo: ${device.name} đã cố gắng truy cập ứng dụng BỊ CHẶN: ${app.name}.`, 'security');
      return;
    }

    // Check overall time limit
    if (device.screenTimeLimit > 0 && device.screenTimeUsed >= device.screenTimeLimit) {
      onChildActivity(`🔒 ${device.name} không thể mở ${app.name} vì đã dùng hết thời gian trong ngày.`, 'screentime');
      return;
    }

    // Check specific app limit
    if (app.timeLimitMinutes && app.timeUsedMinutes >= app.timeLimitMinutes) {
      setActiveApp(app);
      setActiveScreen('blocked_warning');
      onChildActivity(`⚠️ Cảnh báo: ${device.name} cố mở ${app.name} mặc dù đã hết giới hạn sử dụng ứng dụng này.`, 'screentime');
      return;
    }

    setActiveApp(app);
    setActiveScreen('app');
  };

  const handleTriggerSOS = () => {
    if (sosCountdown !== null) return;
    setSosCountdown(3);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sosCountdown !== null && sosCountdown > 0) {
      timer = setTimeout(() => {
        setSosCountdown(sosCountdown - 1);
      }, 1000);
    } else if (sosCountdown === 0) {
      onTriggerSOS();
      setSosCountdown(null);
      setNotificationBanner('🚨 SOS ĐÃ GỬI TỚI CHA MẸ!');
    }
    return () => clearTimeout(timer);
  }, [sosCountdown]);

  const handleParentSettingsUnlock = () => {
    if (pinInput === '1234') { // Default Parental PIN
      setActiveScreen('settings');
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
      onChildActivity(`🔒 ${device.name} nhập sai mã PIN Phụ huynh khi cố vào mục Cài đặt.`, 'security');
    }
  };

  // Determine if device is locked globally by parent or by active downtime schedule
  const isGloballyBlocked = device.status === 'blocked';
  
  // Calculate downtime block
  const checkDowntimeActive = () => {
    if (!device.isDowntimeEnabled) return false;
    const [startH, startM] = device.downtimeStart.split(':').map(Number);
    const [endH, endM] = device.downtimeEnd.split(':').map(Number);
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    const currentMins = currentH * 60 + currentM;
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins > endMins) {
      // Over-midnight (e.g. 22:00 to 06:00)
      return currentMins >= startMins || currentMins <= endMins;
    } else {
      // Inline day (e.g. 13:00 to 15:00)
      return currentMins >= startMins && currentMins <= endMins;
    }
  };

  const isDowntimeBlocked = checkDowntimeActive();
  const isDeviceLocked = isGloballyBlocked || isDowntimeBlocked || (device.screenTimeLimit > 0 && device.screenTimeUsed >= device.screenTimeLimit);

  return (
    <div className="flex flex-col items-center justify-center h-full p-2 bg-slate-950/40" id="child-device-simulator">
      
      {/* Visual Header Indicator */}
      <div className="text-center mb-2">
        <span className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
          <Smartphone className="w-3.5 h-3.5" />
          Điện Thoại Trẻ Em (Mô phỏng)
        </span>
        <p className="text-[10px] text-slate-400 mt-1">
          Thiết bị: <strong className="text-slate-300">{device.name} ({device.deviceModel})</strong>
        </p>
      </div>

      {/* Realistic Smartphone Frame Wrap */}
      <div className="relative w-[320px] h-[580px] bg-slate-900 border-[8px] border-slate-950 rounded-[40px] shadow-2xl overflow-hidden flex flex-col ring-4 ring-indigo-500/5 select-none" id="phone-frame">
        
        {/* Dynamic Island / Camera Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-950 rounded-b-2xl z-50 flex items-center justify-around px-2">
          <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full border border-indigo-500/10 shrink-0"></div>
          <div className="w-12 h-1.5 bg-zinc-900 rounded-full shrink-0"></div>
          <div className="w-1.5 h-1.5 bg-zinc-900 rounded-full shrink-0"></div>
        </div>

        {/* Dynamic slide-down push notification banner */}
        {notificationBanner && (
          <div className="absolute top-8 left-3 right-3 bg-slate-950/95 border border-indigo-500/40 rounded-2xl p-3 shadow-2xl z-40 flex items-start gap-3 animate-slide-down" id="ios-toast-banner">
            <span className="text-xl">💬</span>
            <div className="flex-1 text-left">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">Tin nhắn từ Cha Mẹ</p>
              <p className="text-xs text-white leading-snug font-medium mt-0.5">{notificationBanner}</p>
            </div>
          </div>
        )}

        {/* SOS Countdown Overlay */}
        {sosCountdown !== null && (
          <div className="absolute inset-0 bg-red-950/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-pulse">
            <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center text-4xl text-white font-extrabold shadow-lg shadow-red-600/50 mb-4 animate-ping">
              {sosCountdown}
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider">ĐANG GỬI SOS KHẨN CẤP</h3>
            <p className="text-xs text-red-300 mt-2 max-w-[200px]">Thông báo khẩn cấp và vị trí chính xác sẽ được chuyển ngay đến máy Ba Mẹ!</p>
          </div>
        )}

        {/* Device Status Bar */}
        <div className="h-9 bg-slate-950/30 backdrop-blur-md flex items-center justify-between px-6 pt-3 text-[11px] text-white font-semibold z-30">
          <span>{currentTimeStr}</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-slate-200" />
            <span className="text-[10px]">{device.networkType}</span>
            <div className="flex items-center gap-1 bg-slate-800 px-1 py-0.5 rounded">
              <Battery className={`w-3.5 h-3.5 ${device.batteryLevel < 20 ? 'text-red-500 animate-pulse' : 'text-slate-200'}`} />
              <span className="text-[9px]">{device.batteryLevel}%</span>
            </div>
          </div>
        </div>

        {/* CORE DEVICE RENDER PATHS */}
        <div className="flex-1 relative flex flex-col bg-cover bg-center" style={{ backgroundImage: 'radial-gradient(circle at top, #1e293b, #0f172a)' }}>
          
          {/* A. EXTREME LOCK OVERLAY: GLOBALLY LOCKED / DOWNTIME / TIME OVER */}
          {isDeviceLocked ? (
            <div className="absolute inset-0 bg-slate-950/95 z-40 flex flex-col justify-between p-6 text-center" id="device-locked-screen">
              <div className="my-auto space-y-6">
                <div className="inline-flex p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full animate-bounce">
                  <Lock className="w-10 h-10" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-white tracking-tight">Máy Đang Bị Khóa</h2>
                  <p className="text-sm text-slate-300 px-4">
                    {isGloballyBlocked 
                      ? 'Ba Mẹ đã khóa máy của bạn từ xa để tập trung học tập.' 
                      : isDowntimeBlocked 
                      ? `Đang trong khung giờ giới hạn sử dụng máy (${device.downtimeStart} - ${device.downtimeEnd}).` 
                      : 'Bạn đã dùng hết giới hạn thời gian sử dụng thiết bị cho hôm nay.'}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-xs text-left inline-block w-full max-w-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏰</span>
                    <div>
                      <p className="text-slate-400 font-medium">Giới hạn hôm nay:</p>
                      <p className="text-white font-bold">{device.screenTimeLimit} phút (Đã dùng {device.screenTimeUsed}m)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency / PIN input */}
              <div className="space-y-3 pt-4 border-t border-slate-900">
                <p className="text-[10px] text-slate-500">Chỉ cho phép Cuộc gọi khẩn cấp hoặc mở khóa bằng PIN Phụ huynh</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Mật khẩu phụ huynh"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleParentSettingsUnlock}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    Mở
                  </button>
                </div>
                {pinError && <p className="text-[10px] text-red-500 font-medium">Sai mã PIN Phụ huynh (Mặc định: 1234)</p>}

                <div className="flex justify-between text-xs text-indigo-400 font-semibold px-4 pt-1">
                  <button onClick={() => alert('Đang thực hiện cuộc gọi khẩn cấp cho Bố/Mẹ...')} className="hover:underline">Gọi khẩn cấp SOS</button>
                  <button onClick={() => alert('Mật khẩu mở khóa mặc định là: 1234')} className="text-slate-500 hover:underline">Gợi ý PIN</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* B. ACTIVE SCREENS */}

              {/* 1. HOME SCREEN */}
              {activeScreen === 'home' && (
                <div className="flex-1 flex flex-col justify-between p-4" id="child-home-screen">
                  {/* Stats widget */}
                  <div className="bg-slate-900/60 border border-slate-800/40 rounded-2xl p-3 flex items-center justify-between text-white backdrop-blur-sm shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⏱️</span>
                      <div className="text-left">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Thời gian hôm nay</p>
                        <p className="text-xs font-bold">{device.screenTimeUsed} / {device.screenTimeLimit || '∞'} phút</p>
                      </div>
                    </div>
                    {/* Progress Ring */}
                    <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-indigo-500 flex items-center justify-center text-[9px] font-bold">
                      {Math.min(100, Math.round((device.screenTimeUsed / (device.screenTimeLimit || 1)) * 100))}%
                    </div>
                  </div>

                  {/* App Grid */}
                  <div className="grid grid-cols-3 gap-y-5 gap-x-3 my-auto py-4">
                    {apps.filter(a => a.isInstalled).map((app) => (
                      <button
                        key={app.id}
                        onClick={() => handleOpenApp(app)}
                        className="flex flex-col items-center group focus:outline-none"
                      >
                        <div className="relative w-14 h-14 bg-slate-800/90 border border-slate-700/50 rounded-2xl flex items-center justify-center text-3xl shadow-lg transition duration-200 group-active:scale-90 overflow-hidden">
                          {app.icon}
                          {/* Block Overlay visual */}
                          {app.isBlocked && (
                            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
                              <Lock className="w-5 h-5 text-red-500 fill-current" />
                            </div>
                          )}
                          {/* Remaining limit badge */}
                          {app.timeLimitMinutes && (
                            <span className="absolute bottom-1 right-1 bg-indigo-600/90 text-white text-[8px] font-black px-1 rounded-sm">
                              {app.timeLimitMinutes - app.timeUsedMinutes}m
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-200 font-medium mt-1.5 truncate max-w-[70px]">
                          {app.name}
                        </span>
                      </button>
                    ))}

                    {/* Locked Settings (Parent Override) */}
                    <button
                      onClick={() => {
                        // Prompt PIN
                        setActiveScreen('blocked_warning');
                        setActiveApp({ id: 'settings', name: 'Cài đặt Phụ huynh', packageName: 'parent.settings', icon: '⚙️', category: 'utility', isBlocked: true, timeUsedMinutes: 0, isInstalled: true });
                      }}
                      className="flex flex-col items-center group focus:outline-none"
                    >
                      <div className="w-14 h-14 bg-slate-800/80 border border-slate-700/50 rounded-2xl flex items-center justify-center text-3xl shadow-lg transition duration-200 group-active:scale-90">
                        ⚙️
                      </div>
                      <span className="text-[10px] text-slate-200 font-medium mt-1.5 truncate max-w-[70px]">
                        Cài đặt Ba Mẹ
                      </span>
                    </button>
                  </div>

                  {/* Bottom Panel Controls */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/40">
                    <button
                      onClick={handleTriggerSOS}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 active:scale-95 transition"
                    >
                      🚨 SOS KHẨN CẤP
                    </button>
                    <button
                      onClick={() => alert(`Máy đang bảo mật tuyệt đối.\nBa Mẹ quản lý mọi quyền cài đặt, chặn app, định vị GPS qua bảng điều khiển.`)}
                      className="flex items-center justify-center gap-1 py-2.5 bg-slate-800 hover:bg-slate-755 text-slate-300 rounded-xl text-xs font-medium active:scale-95 transition"
                    >
                      🛡️ Bảo Mật
                    </button>
                  </div>
                </div>
              )}

              {/* 2. BLOCKED WARNING OVERLAY (When app is locked/limits reached or Settings opened) */}
              {activeScreen === 'blocked_warning' && activeApp && (
                <div className="flex-1 flex flex-col justify-between p-5 text-center bg-slate-950/95" id="app-blocked-warning-screen">
                  <div className="my-auto space-y-5">
                    <div className="inline-flex p-3.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full">
                      <ShieldAlert className="w-9 h-9" />
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-white">Tính Năng Bị Giới Hạn</h3>
                      <p className="text-xs text-slate-400">
                        {activeApp.packageName === 'parent.settings'
                          ? 'Mục này chỉ dành riêng cho Cha Mẹ quản trị.'
                          : `Ứng dụng ${activeApp.name} đang bị tạm khóa hoặc hết giới hạn thời gian.`}
                      </p>
                    </div>

                    <p className="text-[11px] text-indigo-400 font-medium bg-indigo-950/40 border border-indigo-900/50 py-2 px-3 rounded-lg max-w-xs mx-auto">
                      {activeApp.packageName === 'parent.settings'
                        ? 'Nhập PIN Phụ huynh bên dưới để vượt qua'
                        : 'Không thể can thiệp thiết lập của máy Parent.'}
                    </p>

                    {/* PIN validation */}
                    <div className="space-y-2 max-w-[200px] mx-auto pt-2">
                      <input
                        type="password"
                        placeholder="Nhập PIN 4 số"
                        maxLength={4}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 text-white text-xs text-center font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleParentSettingsUnlock}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg transition"
                      >
                        Xác nhận PIN Phụ huynh
                      </button>
                      {pinError && <p className="text-[10px] text-red-500 font-medium">Sai PIN (Mặc định: 1234)</p>}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveScreen('home');
                      setActiveApp(null);
                      setPinInput('');
                      setPinError(false);
                    }}
                    className="w-full py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    Quay lại Màn hình chính
                  </button>
                </div>
              )}

              {/* 3. SIMULATED ACTIVE APP INTERFACE */}
              {activeScreen === 'app' && activeApp && (
                <div className="flex-1 flex flex-col bg-slate-950" id="simulated-app-screen">
                  {/* Mock App Header */}
                  <div className="h-10 bg-slate-900 border-b border-slate-850 px-3 flex items-center justify-between text-xs text-white">
                    <button 
                      onClick={() => {
                        setActiveScreen('home');
                        setActiveApp(null);
                      }}
                      className="flex items-center gap-1 text-slate-400 hover:text-white"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Thoát</span>
                    </button>
                    <span className="font-bold flex items-center gap-1">
                      {activeApp.icon} {activeApp.name}
                    </span>
                    <span className="text-[9px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono">
                      {activeApp.timeLimitMinutes ? `${activeApp.timeLimitMinutes - activeApp.timeUsedMinutes}m còn lại` : 'Không giới hạn'}
                    </span>
                  </div>

                  {/* App Inner Content Simulations */}
                  <div className="flex-1 overflow-y-auto p-3 text-white flex flex-col">
                    
                    {/* Roblox Simulation */}
                    {activeApp.id === 'app-roblox' && (
                      <div className="flex-1 flex flex-col justify-between text-center py-4">
                        <div className="space-y-3">
                          <div className="w-14 h-14 bg-red-600 rounded-xl mx-auto flex items-center justify-center text-3xl font-black shadow-lg shadow-red-600/20">R</div>
                          <h4 className="text-sm font-extrabold text-white">Roblox Obby Parkour</h4>
                          <p className="text-[11px] text-slate-400 px-4">Hãy cẩn thận tránh chướng ngại vật màu đỏ!</p>
                        </div>

                        {/* Gaming Canvas Box */}
                        <div className="h-44 bg-zinc-900 rounded-xl border border-zinc-800 relative overflow-hidden flex flex-col items-center justify-center">
                          <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[9px] text-emerald-400">Ping: 32ms</div>
                          {/* Animated game mock */}
                          <div className="w-8 h-8 bg-indigo-500 rounded-full animate-bounce mb-2"></div>
                          <div className="flex gap-1 w-full px-6">
                            <div className="h-2 bg-red-500 flex-1 rounded"></div>
                            <div className="h-2 bg-slate-700 flex-1 rounded"></div>
                            <div className="h-2 bg-slate-700 flex-1 rounded"></div>
                          </div>
                        </div>

                        <button 
                          onClick={() => alert('Đang nhảy! Tránh chướng ngại vật thành công +10 điểm')}
                          className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg text-xs"
                        >
                          Nhảy Lên! 🚀
                        </button>
                      </div>
                    )}

                    {/* Duolingo Simulation */}
                    {activeApp.id === 'app-duolingo' && (
                      <div className="flex-1 flex flex-col justify-between text-center py-4">
                        <div className="space-y-2">
                          <span className="text-4xl animate-bounce inline-block">🦉</span>
                          <h4 className="text-sm font-extrabold text-emerald-400">Duolingo Tiếng Anh</h4>
                          <p className="text-xs text-slate-300">Hoàn thành bài học để duy trì streak!</p>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-left space-y-3">
                          <p className="text-xs text-slate-400 uppercase font-black">Câu hỏi dịch thuật:</p>
                          <p className="text-sm font-bold text-white">"Where is my book?" nghĩa là gì?</p>
                          
                          <div className="space-y-1.5">
                            <button 
                              onClick={() => { setLanguageScore(languageScore + 5); alert('Chính xác! Bạn được cộng 5 điểm kinh nghiệm.'); }}
                              className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg p-2 text-left text-xs text-emerald-400 flex items-center justify-between"
                            >
                              <span>Quyển sách của tôi ở đâu?</span>
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => alert('Sai rồi! Hãy chọn phương án khác nhé.')}
                              className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-lg p-2 text-left text-xs text-slate-300"
                            >
                              Trường học của bạn ở đâu?
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-around text-xs text-amber-400 font-bold bg-amber-500/10 py-1.5 rounded-lg">
                          <span className="flex items-center gap-1"><Flame className="w-4 h-4 fill-current" /> Streak: 12 ngày</span>
                          <span>XP: {languageScore}</span>
                        </div>
                      </div>
                    )}

                    {/* YouTube Kids Kids Simulation */}
                    {activeApp.id === 'app-youtube-kids' && (
                      <div className="flex-1 flex flex-col justify-between text-center py-4">
                        <h4 className="text-sm font-extrabold text-red-500">YouTube Kids an toàn</h4>
                        
                        {isPlayingVideo ? (
                          <div className="flex-1 flex flex-col justify-center gap-2">
                            <div className="h-36 bg-slate-900 rounded-xl border border-red-500/20 relative overflow-hidden flex items-center justify-center">
                              {/* Animated wave mock */}
                              <div className="flex gap-1 items-end h-12">
                                <div className="w-1.5 bg-red-500 rounded animate-pulse" style={{ height: '70%', animationDuration: '0.8s' }}></div>
                                <div className="w-1.5 bg-red-500 rounded animate-pulse" style={{ height: '40%', animationDuration: '0.5s' }}></div>
                                <div className="w-1.5 bg-red-500 rounded animate-pulse" style={{ height: '90%', animationDuration: '1.2s' }}></div>
                                <div className="w-1.5 bg-red-500 rounded animate-pulse" style={{ height: '50%', animationDuration: '0.7s' }}></div>
                              </div>
                              <span className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded text-[8px] font-mono text-white">02:15</span>
                            </div>
                            <p className="text-xs font-bold">Học bảng chữ cái Tiếng Anh qua bài hát</p>
                            <button 
                              onClick={() => setIsPlayingVideo(false)}
                              className="mx-auto bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-3 py-1 rounded-md"
                            >
                              Dừng video
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-400">Chọn video hoạt hình giáo dục:</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => setIsPlayingVideo(true)}
                                className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-left active:scale-95 transition"
                              >
                                <div className="h-16 bg-slate-800 rounded mb-1 bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url("https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=200&auto=format&fit=crop")' }}></div>
                                <span className="text-[9px] font-bold line-clamp-1">Bài hát Thỏ con vui vẻ</span>
                              </button>
                              <button 
                                onClick={() => setIsPlayingVideo(true)}
                                className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-left active:scale-95 transition"
                              >
                                <div className="h-16 bg-slate-800 rounded mb-1 bg-cover bg-center" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url("https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=200&auto=format&fit=crop")' }}></div>
                                <span className="text-[9px] font-bold line-clamp-1">Khám phá vũ trụ khoa học</span>
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 italic">Được đề xuất bởi Nhà trường và Phụ huynh</div>
                      </div>
                    )}

                    {/* Default generic other app simulation */}
                    {!['app-roblox', 'app-duolingo', 'app-youtube-kids'].includes(activeApp.id) && (
                      <div className="flex-1 flex flex-col justify-center items-center gap-4 text-center my-auto">
                        <span className="text-5xl">{activeApp.icon}</span>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold">{activeApp.name}</h4>
                          <p className="text-xs text-slate-400">Đã sử dụng: {activeApp.timeUsedMinutes} phút hôm nay</p>
                        </div>
                        <div className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl text-[11px] text-slate-300 max-w-[220px]">
                          Phần mềm này được cấp quyền hoạt động bởi Phụ huynh. Ứng dụng này không có quảng cáo độc hại.
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* 4. PIN SECURED CHILD INTERNAL SETTINGS */}
              {activeScreen === 'settings' && (
                <div className="flex-1 flex flex-col justify-between p-4 text-left text-white" id="child-settings-panel">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                      <Settings className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-sm font-bold">Cài Đặt Hệ Thống Child</h3>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                        <p className="text-indigo-400 font-bold uppercase text-[9px] tracking-wider">Mã Thiết Bị ID</p>
                        <p className="text-slate-300 font-mono mt-0.5">{device.id}</p>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                        <p className="text-indigo-400 font-bold uppercase text-[9px] tracking-wider">Trạng thái định vị GPS</p>
                        <p className="text-emerald-400 font-medium mt-0.5">● Đang hoạt động tốt</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Bảo mật gỡ bỏ liên kết</p>
                        <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-300 rounded-lg text-[11px] leading-relaxed">
                          ⚠️ Trẻ không thể tự gỡ ứng dụng hay tắt định vị. Mọi thao tác can thiệp hệ thống đều bị chặn nếu không có mật khẩu của Cha Mẹ.
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveScreen('home');
                      setActiveApp(null);
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/10"
                  >
                    Thoát Cài Đặt Phụ Huynh
                  </button>
                </div>
              )}

            </>
          )}

        </div>

        {/* Home Screen indicator button bar */}
        <div className="h-8 bg-slate-950 flex items-center justify-center pb-2 z-30">
          <button 
            onClick={() => {
              if (isDeviceLocked) return;
              setActiveScreen('home');
              setActiveApp(null);
            }}
            className={`w-20 h-1 rounded-full transition ${isDeviceLocked ? 'bg-slate-800 cursor-not-allowed' : 'bg-slate-500 hover:bg-white'}`}
          />
        </div>
      </div>
    </div>
  );
}
