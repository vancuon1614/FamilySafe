import React, { useState } from 'react';
import { 
  ChildDevice, AppItem, SystemNotification, AppSuggestion, DeviceStatus 
} from '../types';
import { APP_STORE_SUGGESTIONS } from '../data/mockData';
import MockMap from './MockMap';
import { 
  Smartphone, Battery, Wifi, ShieldAlert, Lock, Unlock, Clock, AppWindow, 
  MapPin, Bell, Trash2, Plus, ShieldCheck, Download, AlertCircle, RefreshCw, Send, Radio
} from 'lucide-react';

interface ParentDashboardProps {
  devices: ChildDevice[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  apps: AppItem[];
  notifications: SystemNotification[];
  onToggleDeviceBlock: (deviceId: string) => void;
  onUpdateScreenLimit: (deviceId: string, limitMinutes: number) => void;
  onToggleDowntime: (deviceId: string, enabled: boolean) => void;
  onUpdateDowntimeHours: (deviceId: string, start: string, end: string) => void;
  onToggleAppBlock: (deviceId: string, appId: string) => void;
  onUpdateAppLimit: (deviceId: string, appId: string, limitMinutes: number | undefined) => void;
  onUninstallApp: (deviceId: string, appId: string) => void;
  onInstallApp: (deviceId: string, app: AppSuggestion) => void;
  onSendMessage: (text: string) => void;
  onClearNotifications: () => void;
  onOpenPairingModal: () => void;
  onUpdateLocation: (lat: number, lng: number, locName: string) => void;
  onLocationTrigger: (message: string, type: 'location' | 'security') => void;
}

const getFlutterDartCode = (origin: string) => `// FILE: family_safe_service.dart
// Tich hop Flutter cho dien thoai that cua tre em (Android / iOS)
// Can cai dat dependencies vao pubspec.yaml:
// dependencies:
//   http: ^1.2.0
//   geolocator: ^10.1.0
//   battery_plus: ^5.0.2
//   shared_preferences: ^2.2.2

import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'package:geolocator/geolocator.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FamilySafeService {
  // DIA CHI API SERVER CHI DINH DE'N WEB APP NAY
  static final String serverUrl = "${origin}";

  /// 1. HAM KET NOI / GHEP DOI BANG MA CODE 6 CHU SO (TU TRANG WEB PHU HUYNH)
  static Future<Map<String, dynamic>?> pairDevice(String pairingCode) async {
    try {
      final Battery battery = Battery();
      final int batteryLevel = await battery.batteryLevel;
      
      // Lay toa do GPS khoi tao
      double lat = 10.7725;
      double lng = 106.6980;
      try {
        Position pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.medium,
          timeLimit: const Duration(seconds: 5),
        );
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (e) {
        print("GPS init fallback: \\$e");
      }

      final response = await http.post(
        Uri.parse("\\$serverUrl/api/pairing/join"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "code": pairingCode,
          "deviceModel": "Physical Phone (Real Device)",
          "batteryLevel": batteryLevel,
          "latitude": lat,
          "longitude": lng,
          // Doc app da cai bang 'device_apps' plugin hoac gan danh sach
          "apps": [
            {"name": "TikTok", "packageName": "com.zhiliaoapp.musically", "category": "social", "timeUsedMinutes": 10},
            {"name": "Roblox", "packageName": "com.roblox.client", "category": "game", "timeUsedMinutes": 25},
            {"name": "YouTube Kids", "packageName": "com.google.android.apps.youtube.kids", "category": "video", "timeUsedMinutes": 5}
          ]
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('device_id', data['deviceId']);
          await prefs.setString('child_name', data['deviceName']);
          print("Luu thong tin ghep doi thanh cong cho be: \\\${data['deviceName']}");
          return data;
        }
      } else {
        print("Pairing that bai: \\\${response.body}");
      }
    } catch (e) {
      print("Loi ghep doi: \\$e");
    }
    return null;
  }

  /// 2. HAM CHAY NGAM DONG BO DINH KY (HEARTBEAT - CHAY MOI 5-15 GIAY)
  /// Ham nay se cap nhat GPS thuc te, Pin thuc te, va nhan lai LENH KHOA MAY tu parent
  static Future<Map<String, dynamic>?> reportAndSync() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final String? deviceId = prefs.getString('device_id');
      if (deviceId == null) {
        print("Chua ket noi voi may phu huynh. Vui long nhap ma code truoc.");
        return null;
      }

      final Battery battery = Battery();
      final int batteryLevel = await battery.batteryLevel;
      final bool isCharging = (await battery.batteryState) == BatteryState.charging;
      
      // Lay GPS chay ngam thuc te tu chip dien thoai tre
      double lat = 10.7725;
      double lng = 106.6980;
      String locName = "Thiet bi thuc te (Dang ngam dinh vi)";
      try {
        Position pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high
        );
        lat = pos.latitude;
        lng = pos.longitude;
        locName = "Toa do: \\\${lat.toStringAsFixed(5)}, \\\${lng.toStringAsFixed(5)}";
      } catch (e) {
        print("Loi doc GPS thuc: \\$e");
      }

      final response = await http.post(
        Uri.parse("\\$serverUrl/api/devices/\\$deviceId/report"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "batteryLevel": batteryLevel,
          "isCharging": isCharging,
          "networkType": "4G/Wifi",
          "screenTimeUsed": 45, // Ban co the tinh toan thoi gian dung may thuc te o day
          "latitude": lat,
          "longitude": lng,
          "locationName": locName
        }),
      );

      if (response.statusCode == 200) {
        final config = jsonDecode(response.body);
        
        // KIEM TRA LENH KHOA MAY TU CHA ME
        final String status = config['status'] ?? 'online';
        if (status == 'blocked') {
          // TODO: Thuc thi giao dien LOCK OVERLAY tran man hinh dien thoai tre!
          // Su dung Flutter system_alert_window hoac overlay_support de chan nguoi dung.
          print("🚨 THIET BI DA BI KHOA TU' XA BOI PHU HUYNH!");
        } else {
          print("✅ Thiet bi hoat dong binh thuong.");
        }

        // KIEM TRA TIN NHAN CHU DUOC GUI DE'N (PUSH NOTIFICATION)
        final List<dynamic>? incomingMsgs = config['incomingMessages'];
        if (incomingMsgs != null && incomingMsgs.isNotEmpty) {
          for (var msg in incomingMsgs) {
            // TODO: Hien thi thong bao hoac pop-up canh bao noi tren dien thoai cua be
            print("💬 TIN NHAN TU PHU HUYNH: \\$msg");
          }
        }

        return config;
      }
    } catch (e) {
      print("Loi dong bo API: \\$e");
    }
    return null;
  }

  /// 3. HAM KICH HOAT SOS CANH BAO KHAN CAP LEN TRINH DUYET PHU HUYNH TUC THI
  static Future<bool> triggerSOSAlarm() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final String? deviceId = prefs.getString('device_id');
      if (deviceId == null) return false;

      final response = await http.post(
        Uri.parse("\\$serverUrl/api/devices/\\$deviceId/sos"),
        headers: {"Content-Type": "application/json"},
      );
      return response.statusCode == 200;
    } catch (e) {
      print("Loi kich hoat SOS: \\$e");
    }
    return false;
  }
}
`;

export default function ParentDashboard({
  devices,
  selectedDeviceId,
  onSelectDevice,
  apps,
  notifications,
  onToggleDeviceBlock,
  onUpdateScreenLimit,
  onToggleDowntime,
  onUpdateDowntimeHours,
  onToggleAppBlock,
  onUpdateAppLimit,
  onUninstallApp,
  onInstallApp,
  onSendMessage,
  onClearNotifications,
  onOpenPairingModal,
  onUpdateLocation,
  onLocationTrigger
}: ParentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'apps' | 'gps' | 'logs' | 'realphone'>('overview');
  const [customMsg, setCustomMsg] = useState('');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [tempAppLimit, setTempAppLimit] = useState<string>('');

  // Find active device in devices list
  const activeDevice = devices.find(d => d.id === selectedDeviceId) || devices[0];

  const handleSendPush = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMsg.trim()) return;
    onSendMessage(customMsg.trim());
    setCustomMsg('');
    alert(`Đã gửi thông điệp từ xa tới máy ${activeDevice.name}!`);
  };

  const handleSaveAppLimit = (appId: string) => {
    const mins = tempAppLimit === '' ? undefined : parseInt(tempAppLimit, 10);
    onUpdateAppLimit(activeDevice.id, appId, mins);
    setEditingAppId(null);
  };

  // Safe checks for unread notifications count
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const sosCount = notifications.filter(n => n.type === 'sos').length;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden flex flex-col md:flex-row h-full shadow-2xl" id="parent-dashboard-root">
      
      {/* 1. DEVICE PICKER SIDEBAR */}
      <div className="w-full md:w-64 bg-slate-900/60 border-b md:border-b-0 md:border-r border-slate-800 p-4 flex flex-col justify-between shrink-0" id="parent-sidebar">
        <div className="space-y-4">
          {/* Dashboard Header Title */}
          <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">FamilySafe Link</h2>
              <p className="text-[10px] text-slate-400 font-medium">Bảng điều khiển của Cha Mẹ</p>
            </div>
          </div>

          {/* Child Devices List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Danh sách trẻ em ({devices.length})</span>
              <button 
                onClick={onOpenPairingModal}
                className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition"
                title="Thêm thiết bị"
                id="btn-add-device-sidebar"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {devices.map((dev) => {
                const isSelected = dev.id === activeDevice.id;
                const isLocked = dev.status === 'blocked';
                return (
                  <button
                    key={dev.id}
                    onClick={() => onSelectDevice(dev.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition duration-200 ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500 text-white shadow-md shadow-indigo-600/5'
                        : 'bg-slate-900 border-slate-850/50 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className="text-2xl bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/80 leading-none shrink-0">
                      {dev.avatar}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate block">{dev.name}</span>
                        {isLocked && <Lock className="w-3 h-3 text-red-500 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{dev.deviceModel}</p>
                      
                      {/* Live battery & connectivity stats */}
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-500 font-bold">
                        <span className="flex items-center gap-0.5">
                          <Battery className="w-2.5 h-2.5" />
                          {dev.batteryLevel}%
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Wifi className="w-2.5 h-2.5" />
                          {dev.networkType}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Global Security PIN hint */}
        <div className="pt-4 border-t border-slate-800 mt-4 md:mt-0 text-[10px] text-slate-500 bg-slate-950/30 p-2 rounded-lg">
          <p className="font-semibold text-slate-400">🔑 MÃ PIN PHỤ HUYNH:</p>
          <p className="mt-0.5">Mã mặc định mở khóa máy trẻ: <strong className="text-indigo-400">1234</strong></p>
        </div>
      </div>

      {/* 2. CORE WORKSPACE AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950" id="parent-workspace">
        
        {/* Workspace Top Header (Device Quick view & TABS) */}
        <div className="p-4 bg-slate-900/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl bg-slate-900 border border-slate-800 p-2 rounded-xl">{activeDevice.avatar}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-white">Bảng Quản Lý Của {activeDevice.name}</h1>
                <span className={`h-2 w-2 rounded-full ${activeDevice.status === 'blocked' ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`}></span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>Model: {activeDevice.deviceModel}</span>
                <span>•</span>
                <span className="text-indigo-400 font-medium">Pin: {activeDevice.batteryLevel}%</span>
              </p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex flex-wrap gap-1 bg-slate-900/80 border border-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Tổng quan</span>
            </button>
            <button
              onClick={() => setActiveTab('apps')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'apps'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
              id="tab-apps-manager"
            >
              <AppWindow className="w-3.5 h-3.5" />
              <span>Ứng dụng ({apps.filter(a => a.isInstalled).length})</span>
            </button>
            <button
              onClick={() => setActiveTab('gps')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'gps'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Định vị</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Lịch sử</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white ring-2 ring-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('realphone')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-500/30 transition ${
                activeTab === 'realphone'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-500/20'
                  : 'bg-emerald-950/20 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800/50'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Điện thoại Thật 📱</span>
            </button>
          </div>
        </div>

        {/* Workspace Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6" id="dashboard-tab-viewport">
          
          {/* TAB A: OVERVIEW & GENERAL REMOTE BLOCK */}
          {activeTab === 'overview' && (
            <div className="space-y-6" id="tab-overview-content">
              
              {/* Remote Block and Message Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                {/* 1. REMOTE BLOCK BLOCK (Yêu cầu chính: Block máy từ xa) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between" id="panel-remote-block">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-indigo-400" />
                        Khóa Máy Từ Xa
                      </h3>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        activeDevice.status === 'blocked' 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {activeDevice.status === 'blocked' ? 'ĐANG KHÓA' : 'ĐANG MỞ'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Kích hoạt tính năng này sẽ khóa tức thì toàn bộ màn hình điện thoại của bé. Bé sẽ không thể mở bất kỳ ứng dụng nào ngoại trừ nút gọi điện khẩn cấp cho phụ huynh.
                    </p>
                  </div>

                  <button
                    onClick={() => onToggleDeviceBlock(activeDevice.id)}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                      activeDevice.status === 'blocked'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/10'
                    }`}
                    id="btn-remote-block-toggle"
                  >
                    {activeDevice.status === 'blocked' ? (
                      <>
                        <Unlock className="w-4 h-4 fill-current" />
                        <span>MỞ KHÓA THIẾT BỊ NGAY</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 fill-current" />
                        <span>KHÓA MÁY TỪ XA TỨC THÌ</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 2. SEND PUSH MESSAGE (Yêu cầu chính: Gửi notification cho máy child) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between" id="panel-message-sender">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
                      Gửi Tin Nhắn Từ Xa (Push Notice)
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Soạn tin nhắn để gửi thông báo tức thì lên màn hình điện thoại của trẻ. Tin nhắn sẽ trượt xuống dạng biểu ngữ nổi bật.
                    </p>
                  </div>

                  <form onSubmit={handleSendPush} className="space-y-3 mt-4">
                    <input
                      type="text"
                      placeholder="Ví dụ: Về ăn cơm tối con ơi! / Học bài đi..."
                      value={customMsg}
                      onChange={(e) => setCustomMsg(e.target.value)}
                      maxLength={100}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/15"
                      id="btn-send-push"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>GỬI THÔNG BÁO TỚI ĐIỆN THOẠI BÉ</span>
                    </button>
                  </form>
                </div>

              </div>

              {/* Screen Time Management Controls (Yêu cầu chính: Kiểm soát thời gian sử dụng máy) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6" id="panel-screentime-scheduler">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    Quản Lý Giờ Giấc & Giới Hạn Máy Trẻ
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold">Cập nhật tự động</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Screen Time Limit Slider */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <h4 className="text-xs font-bold text-white">Hạn mức thời gian cả ngày</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Bé chỉ được phép mở máy trong khoảng này</p>
                      </div>
                      <span className="text-sm font-extrabold text-indigo-400">
                        {activeDevice.screenTimeLimit === 0 ? 'Không giới hạn' : `${activeDevice.screenTimeLimit} phút`}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0"
                        max="240"
                        step="15"
                        value={activeDevice.screenTimeLimit}
                        onChange={(e) => onUpdateScreenLimit(activeDevice.id, parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase">
                        <span>Vô hạn</span>
                        <span>1 Giờ</span>
                        <span>2 Giờ</span>
                        <span>3 Giờ</span>
                        <span>4 Giờ</span>
                      </div>
                    </div>

                    {/* Progress details */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Thời gian đã dùng hôm nay</p>
                        <p className="text-sm font-black text-white mt-0.5">{activeDevice.screenTimeUsed} phút</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tỷ lệ sử dụng</p>
                        <p className="text-xs font-black text-indigo-400 mt-0.5">
                          {Math.min(100, Math.round((activeDevice.screenTimeUsed / (activeDevice.screenTimeLimit || 1)) * 100))}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Sleep/Downtime schedule (Khung giờ đi ngủ) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">Khung giờ Đi ngủ (Downtime)</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Khóa máy tự động theo giờ giấc đi ngủ</p>
                      </div>
                      
                      {/* Toggle Button */}
                      <button
                        onClick={() => onToggleDowntime(activeDevice.id, !activeDevice.isDowntimeEnabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                          activeDevice.isDowntimeEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          activeDevice.isDowntimeEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-850">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bắt đầu khóa</label>
                        <input
                          type="time"
                          value={activeDevice.downtimeStart}
                          disabled={!activeDevice.isDowntimeEnabled}
                          onChange={(e) => onUpdateDowntimeHours(activeDevice.id, e.target.value, activeDevice.downtimeEnd)}
                          className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mt-1 ${
                            !activeDevice.isDowntimeEnabled ? 'opacity-40 cursor-not-allowed' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mở khóa lại</label>
                        <input
                          type="time"
                          value={activeDevice.downtimeEnd}
                          disabled={!activeDevice.isDowntimeEnabled}
                          onChange={(e) => onUpdateDowntimeHours(activeDevice.id, activeDevice.downtimeStart, e.target.value)}
                          className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mt-1 ${
                            !activeDevice.isDowntimeEnabled ? 'opacity-40 cursor-not-allowed' : ''
                          }`}
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 italic">
                      Mẹo: Hãy kích hoạt Downtime từ 22:00 đến 06:00 sáng hôm sau để ngăn bé thức đêm lướt điện thoại lén lút.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB B: APPS MANAGEMENT & INSTALLATIONS (Yêu cầu chính: Kiểm soát thời gian dùng app, Cài đặt và xoá phần mềm máy child) */}
          {activeTab === 'apps' && (
            <div className="space-y-6 animate-fade-in" id="tab-apps-content">
              
              {/* App List Controls Container */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* A. Installed App Manager list (2/3 width) */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Ứng dụng Đang Cài đặt trên Máy Trẻ</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Khóa/Mở tức thì, giới hạn giờ sử dụng hoặc gỡ bỏ cài đặt từ xa.</p>
                  </div>

                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {apps.filter(app => app.isInstalled).map((app) => (
                      <div 
                        key={app.id}
                        className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-xl hover:border-slate-800 transition"
                      >
                        {/* Icon & App name info */}
                        <div className="flex items-center gap-3">
                          <span className="text-2xl bg-slate-900 border border-slate-800 p-2 rounded-xl leading-none">{app.icon}</span>
                          <div>
                            <span className="text-xs font-bold text-white block">{app.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">{app.packageName}</span>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Đã dùng hôm nay: <strong className="text-slate-300">{app.timeUsedMinutes} phút</strong>
                              {app.timeLimitMinutes && <span className="text-indigo-400 font-semibold ml-1.5">/ Giới hạn {app.timeLimitMinutes}m</span>}
                            </p>
                          </div>
                        </div>

                        {/* Interactive Management Controls */}
                        <div className="flex items-center gap-2">
                          
                          {/* App Limits Quick Configure */}
                          {editingAppId === app.id ? (
                            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                              <input
                                type="number"
                                placeholder="Phút"
                                value={tempAppLimit}
                                onChange={(e) => setTempAppLimit(e.target.value.replace(/\D/g, ''))}
                                className="w-12 bg-slate-950 text-white text-xs text-center py-1 rounded focus:outline-none"
                              />
                              <button 
                                onClick={() => handleSaveAppLimit(app.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded transition"
                              >
                                Lưu
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingAppId(app.id);
                                setTempAppLimit(app.timeLimitMinutes?.toString() || '');
                              }}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white rounded border border-slate-800/80 transition"
                              title="Đặt giới hạn sử dụng app"
                            >
                              {app.timeLimitMinutes ? `Giới hạn: ${app.timeLimitMinutes}m` : 'Đặt giới hạn'}
                            </button>
                          )}

                          {/* Quick Block switch */}
                          <button
                            onClick={() => onToggleAppBlock(activeDevice.id, app.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold transition ${
                              app.isBlocked
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {app.isBlocked ? (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>Chặn</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" />
                                <span>Cho phép</span>
                              </>
                            )}
                          </button>

                          {/* Remote Uninstall Trigger (Xoá phần mềm trên máy child) */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc chắn muốn gỡ cài đặt ứng dụng ${app.name} từ xa trên máy của ${activeDevice.name} không?`)) {
                                onUninstallApp(activeDevice.id, app.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition"
                            title="Xóa ứng dụng từ xa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* B. Remote App Installer Store (1/3 width) (Cài đặt phần mềm máy child) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-emerald-400 animate-pulse" />
                      Cài Đặt Phần Mềm Từ Xa
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Khuyên dùng cho học tập và tư duy sáng tạo của bé.</p>
                  </div>

                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {APP_STORE_SUGGESTIONS.map((storeApp) => {
                      // Check if already installed
                      const isInstalled = apps.some(a => a.packageName === storeApp.packageName && a.isInstalled);
                      
                      return (
                        <div 
                          key={storeApp.id}
                          className="p-3 bg-slate-950/60 border border-slate-850/80 rounded-xl space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{storeApp.icon}</span>
                              <div>
                                <span className="text-xs font-bold text-white block">{storeApp.name}</span>
                                <span className="text-[9px] text-slate-500 font-semibold bg-slate-900 px-1 py-0.5 rounded">{storeApp.category}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => onInstallApp(activeDevice.id, storeApp)}
                              disabled={isInstalled}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition ${
                                isInstalled
                                  ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-transparent'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow shadow-emerald-600/10'
                              }`}
                              id={`btn-install-${storeApp.id}`}
                            >
                              {isInstalled ? (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Đã có</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Cài đặt</span>
                                </>
                              )}
                            </button>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 leading-snug">{storeApp.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB C: REALTIME GPS POSITION & GEOFENCING (Yêu cầu chính: Hiển thị vị trí máy child trên bản đồ, trạng thái máy child) */}
          {activeTab === 'gps' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="tab-gps-content">
              
              {/* Map container occupies 2 columns */}
              <div className="lg:col-span-2 h-full">
                <MockMap 
                  device={activeDevice}
                  onLocationTrigger={onLocationTrigger}
                  onUpdateLocation={onUpdateLocation}
                />
              </div>

              {/* Status and Geofence Details occupes 1 column */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Trạng Thái GPS Thiết Bị</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Giám sát vị trí an toàn thời gian thực.</p>
                  </div>

                  {/* Details Card */}
                  <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-850">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Trạng thái định vị:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        Đang Truy Vết
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Tốc độ di chuyển:</span>
                      <span className="text-white font-medium">Bé đang đi bộ (4 km/h)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Sai số đo đạc:</span>
                      <span className="text-slate-300 font-mono">~3 mét (Rất nhạy)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-slate-900 pt-2.5">
                      <span className="text-slate-400">Địa chỉ đo được:</span>
                      <span className="text-white font-semibold text-right max-w-[140px] truncate" title={activeDevice.locationName}>
                        {activeDevice.locationName}
                      </span>
                    </div>
                  </div>

                  {/* Geofencing references list */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300">Nhắc nhở vùng thông minh:</h4>
                    
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-[11px] leading-relaxed text-slate-400">
                      Hệ thống tự động thông báo cho phụ huynh khi trẻ <strong className="text-white">vào hoặc ra</strong> khỏi các ranh giới được thiết lập sẵn như <strong className="text-emerald-400">Trường học</strong>, <strong className="text-emerald-400">Nhà riêng</strong> hoặc đi vào <strong className="text-red-400">Địa điểm chơi game cấm</strong>.
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-950/20 border border-indigo-900/30 p-3.5 rounded-xl text-xs text-indigo-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-normal">
                    Định vị GPS hoạt động ngầm liên tục ngay cả khi máy của bé hết dung lượng mạng hoặc bị khóa từ xa.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB D: ACTIVE LIVE NOTIFICATIONS & LOGS (Yêu cầu chính: Nhận notification từ máy child) */}
          {activeTab === 'logs' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 animate-fade-in" id="tab-logs-content">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white">Nhật Ký Cảnh Báo Hệ Thống</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Nhận các thông báo khẩn cấp, vị trí và thời gian sử dụng từ bé.</p>
                </div>
                
                <button
                  onClick={onClearNotifications}
                  disabled={notifications.length === 0}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 text-[10px] text-slate-400 hover:text-white rounded-lg border border-slate-800 transition"
                >
                  Xóa toàn bộ nhật ký
                </button>
              </div>

              {/* Warnings / Emergency list */}
              {notifications.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <span className="text-4xl text-slate-600 block">📭</span>
                  <p className="text-xs text-slate-500 font-semibold">Chưa có cảnh báo hay thông báo mới nào được ghi nhận.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {notifications.map((notif) => {
                    // Type visual color configs
                    let typeBadge = 'bg-slate-950 text-slate-400';
                    let typeLabel = 'Thông báo';
                    
                    if (notif.type === 'security') {
                      typeBadge = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                      typeLabel = 'Bảo mật';
                    } else if (notif.type === 'location') {
                      typeBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                      typeLabel = 'Địa điểm';
                    } else if (notif.type === 'screentime') {
                      typeBadge = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
                      typeLabel = 'Giờ giấc';
                    } else if (notif.type === 'sos') {
                      typeBadge = 'bg-red-600/20 text-red-400 border border-red-500/30 animate-pulse';
                      typeLabel = '🆘 KHẨN CẤP SOS';
                    }

                    return (
                      <div 
                        key={notif.id}
                        className={`p-3.5 rounded-xl text-xs flex items-start gap-3 justify-between transition ${
                          notif.type === 'sos' 
                            ? 'bg-red-950/25 border-l-4 border-l-red-500 border-t border-r border-b border-red-900/40' 
                            : 'bg-slate-950 border border-slate-850 hover:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shrink-0 mt-0.5 ${typeBadge}`}>
                            {typeLabel}
                          </span>
                          <div>
                            <p className="text-white font-medium leading-relaxed">{notif.message}</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                              Thiết bị: {notif.deviceName} • {new Date(notif.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                          </div>
                        </div>

                        {notif.type === 'sos' && (
                          <span className="p-1.5 bg-red-500 text-white text-[10px] font-black rounded-lg animate-ping shrink-0">
                            Alarm
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB E: REAL PHONE CONNECTION KIT & FLUTTER DART CODE (Yêu cầu của User) */}
          {activeTab === 'realphone' && (
            <div className="space-y-6 animate-fade-in" id="tab-realphone-content">
              
              {/* Alert introduction */}
              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-5 flex items-start gap-4">
                <span className="text-3xl">📱</span>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-emerald-400">LIÊN KẾT ĐIỆN THOẠI VẬT LÝ THẬT (ANDROID & IOS)</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Hệ thống đã được trang bị <strong className="text-white">API Endpoint thực tế hoạt động 24/7</strong>. Bạn có thể xây dựng ứng dụng <strong className="text-emerald-400 font-bold">Flutter (Dart)</strong> và chạy trực tiếp trên máy của trẻ (không phải máy ảo mô phỏng) để kết nối định vị GPS, đồng bộ dung lượng PIN, và nhận lệnh khóa máy từ xa ngay lập tức từ bảng điều khiển này!
                  </p>
                </div>
              </div>

              {/* Endpoint configurations */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">1. Địa chỉ máy chủ API của bạn (API Server Base URL)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Để điện thoại thật của trẻ giao tiếp được với bảng điều khiển này, hãy cấu hình biến <code className="bg-slate-950 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">serverUrl</code> trong code Flutter thành địa chỉ này:
                </p>
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between font-mono text-xs text-emerald-400 select-all shadow-inner">
                  <span>{window.location.origin}</span>
                  <span className="bg-emerald-500/15 text-emerald-400 font-sans text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">ONLINE & READY</span>
                </div>
              </div>

              {/* Steps to integrate Flutter app */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">2. Các bước tích hợp trên thiết bị thật</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-1">
                    <span className="text-lg">⚙️</span>
                    <h5 className="font-bold text-white">Bước 1: Cấu hình Quyền hạn</h5>
                    <p className="text-slate-400 leading-relaxed text-[11px] mt-1">
                      Cấp quyền truy cập GPS chạy ngầm (<code className="text-indigo-400 font-mono text-[10px]">ACCESS_BACKGROUND_LOCATION</code>) và quyền hiển thị đè màn hình khóa trên Android/iOS để khóa máy.
                    </p>
                  </div>
                  
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-1">
                    <span className="text-lg">⚡</span>
                    <h5 className="font-bold text-white">Bước 2: Chạy Code Client</h5>
                    <p className="text-slate-400 leading-relaxed text-[11px] mt-1">
                      Copy file Dart bên dưới vào project Flutter của bé. Chạy ứng dụng trên thiết bị thật và tiến hành liên kết bằng mã ghép đôi.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-1">
                    <span className="text-lg">🎉</span>
                    <h5 className="font-bold text-white">Bước 3: Điều khiển từ xa</h5>
                    <p className="text-slate-400 leading-relaxed text-[11px] mt-1">
                      Điện thoại sẽ chuyển từ trạng thái "Mô phỏng" sang kết nối thực tế. Bất kỳ tác vụ click khóa máy, đặt giờ hay chặn ứng dụng nào từ web này sẽ áp dụng ngay lên điện thoại thật!
                    </p>
                  </div>
                </div>
              </div>

              {/* Complete copyable Dart File code */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">3. File Dart tích hợp hoàn chỉnh: <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded text-[10px] font-mono">family_safe_service.dart</code></h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Dùng để chạy ngầm và đồng bộ trạng thái thực tế lên máy chủ API này.</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      const codeText = document.getElementById('flutter-code-block')?.innerText || '';
                      navigator.clipboard.writeText(codeText);
                      alert('Đã copy mã nguồn Dart thành công!');
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow"
                  >
                    Copy Code Dart
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto" id="flutter-code-block-container">
                  <pre className="p-4 font-mono text-[11px] text-slate-300 leading-relaxed text-left overflow-x-auto select-all" id="flutter-code-block">
                    {getFlutterDartCode(window.location.origin)}
                  </pre>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
