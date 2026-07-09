import React, { useState } from 'react';
import { Smartphone, Shield, ArrowRight, Check, X, RefreshCw } from 'lucide-react';
import { ChildDevice } from '../types';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDevice: (newDevice: ChildDevice) => void;
}

const AVATARS = ['👦', '👧', '🦁', '🐱', '🐼', '🦊', '🦄', '🐨'];

export default function PairingModal({ isOpen, onClose, onAddDevice }: PairingModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦁');
  const [os, setOs] = useState<'iOS' | 'Android'>('Android');
  const [pairingCode, setPairingCode] = useState('');

  if (!isOpen) return null;

  const generateCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingCode(`${code.slice(0, 3)}-${code.slice(3)}`);
  };

  const handleNextToCode = () => {
    if (!name.trim()) return;
    generateCode();
    setStep(2);
  };

  const handleCompletePairing = () => {
    const randomBattery = Math.floor(60 + Math.random() * 35);
    const mockModel = os === 'iOS' ? 'iPhone 15' : 'Samsung Galaxy S24';
    
    const newDevice: ChildDevice = {
      id: `device-${Date.now()}`,
      name: name.trim(),
      avatar: selectedAvatar,
      deviceModel: mockModel,
      batteryLevel: randomBattery,
      isCharging: false,
      networkType: 'Wifi',
      status: 'online',
      screenTimeUsed: 0,
      screenTimeLimit: 120, // 2 hours default
      downtimeStart: '22:00',
      downtimeEnd: '06:00',
      isDowntimeEnabled: true,
      latitude: 10.7725,
      longitude: 106.6980,
      locationName: 'Nhà riêng (Vừa kết nối)',
      lastUpdated: 'Vừa xong',
    };

    onAddDevice(newDevice);
    reset();
    onClose();
  };

  const reset = () => {
    setStep(1);
    setName('');
    setSelectedAvatar('🦁');
    setOs('Android');
    setPairingCode('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4" id="pairing-modal-overlay">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl" id="pairing-modal-content">
        
        {/* Close Button */}
        <button 
          onClick={() => { reset(); onClose(); }}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Shield className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Thêm Thiết Bị Của Trẻ</h2>
            <p className="text-xs text-slate-400">Kết nối và giám sát từ xa bằng mã liên kết</p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-5">
              {/* Device OS Switch */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Hệ điều hành của máy trẻ</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setOs('Android')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-medium text-sm transition ${
                      os === 'Android'
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Android</span>
                  </button>
                  <button
                    onClick={() => setOs('iOS')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-medium text-sm transition ${
                      os === 'iOS'
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-slate-200" />
                    <span>Apple iOS</span>
                  </button>
                </div>
              </div>

              {/* Name input */}
              <div className="space-y-2">
                <label htmlFor="child-name-input" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Tên của trẻ</label>
                <input
                  type="text"
                  id="child-name-input"
                  placeholder="Ví dụ: Gia Bảo, Khánh Vy..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition text-sm"
                />
              </div>

              {/* Avatar chooser */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Chọn biểu tượng đại diện</label>
                <div className="grid grid-cols-4 gap-3 bg-slate-950/40 p-3 border border-slate-800/80 rounded-xl">
                  {AVATARS.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`text-2xl py-2 rounded-lg transition duration-200 ${
                        selectedAvatar === avatar
                          ? 'bg-indigo-600 border border-indigo-400 shadow-md shadow-indigo-600/10'
                          : 'bg-slate-900/60 hover:bg-slate-850 border border-transparent'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={handleNextToCode}
                disabled={!name.trim()}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition ${
                  name.trim()
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                id="btn-pairing-next"
              >
                <span>Tạo Mã Liên Kết</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6 text-center py-2">
              {/* Pairing Instructions */}
              <div className="space-y-2">
                <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Cài đặt trên điện thoại trẻ</p>
                <p className="text-sm text-slate-300 px-2 leading-relaxed">
                  Tải phần mềm <strong className="text-white">FamilySafe Kid</strong> trên thiết bị {os} của trẻ, sau đó nhập mã kết nối dưới đây:
                </p>
              </div>

              {/* Code Box */}
              <div className="relative max-w-xs mx-auto">
                <div className="bg-slate-950 border-2 border-dashed border-indigo-500/50 rounded-2xl p-4 font-mono text-3xl font-extrabold text-indigo-400 tracking-wider flex items-center justify-center gap-2 select-all shadow-inner">
                  {pairingCode}
                </div>
                <button
                  onClick={generateCode}
                  className="absolute -right-2 -bottom-2 p-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-full hover:text-white transition"
                  title="Đổi mã khác"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Simulating Pairing Actions */}
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 text-xs text-left flex items-start gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0 mt-0.5 animate-pulse"></span>
                <div>
                  <p className="text-slate-200 font-semibold">Đang chờ liên kết...</p>
                  <p className="text-slate-400 mt-0.5">Ứng dụng sẽ tự động kích hoạt ngay khi thiết bị của bé nhập đúng mã này.</p>
                </div>
              </div>

              {/* Complete Simulation Button */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="py-3 px-4 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-white font-semibold text-sm transition"
                >
                  Quay Lại
                </button>
                <button
                  onClick={handleCompletePairing}
                  className="flex items-center justify-center gap-1.5 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-600/20 transition"
                  id="btn-confirm-pairing"
                >
                  <Check className="w-4 h-4" />
                  <span>Mô phỏng Kết Nối</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
