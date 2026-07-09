import React, { useState, useEffect } from 'react';
import { ChildDevice, Geofence } from '../types';
import { GEOFENCES } from '../data/mockData';
import { Compass, Navigation, MapPin, Eye, Play, Square, AlertTriangle } from 'lucide-react';

interface MockMapProps {
  device: ChildDevice;
  onLocationTrigger: (message: string, type: 'location' | 'security') => void;
  onUpdateLocation: (lat: number, lng: number, locName: string) => void;
}

// Predefined waypoints for the "Auto-walk" simulation route (relative % coordinate system for rendering)
// Mapping saigon-like coordinates to our 0-100 grid for pristine SVG layout
const WAYPOINTS = [
  { x: 30, y: 35, name: 'Nhà riêng', lat: 10.7725, lng: 106.6980 },
  { x: 42, y: 45, name: 'Đường Nguyễn Thị Minh Khai', lat: 10.7735, lng: 106.6955 },
  { x: 60, y: 55, name: 'Ngã tư CMT8', lat: 10.7710, lng: 106.6920 },
  { x: 75, y: 70, name: 'Quán Net Cyber (Vùng cấm)', lat: 10.7680, lng: 106.6940, isDangerous: true },
  { x: 62, y: 80, name: 'Công viên Tao Đàn (Vui chơi)', lat: 10.7743, lng: 106.6913 },
  { x: 48, y: 65, name: 'Đường Lê Duẩn', lat: 10.7755, lng: 106.6970 },
  { x: 35, y: 50, name: 'Trường học Nguyễn Du', lat: 10.7769, lng: 106.7009 },
  { x: 30, y: 35, name: 'Nhà riêng', lat: 10.7725, lng: 106.6980 },
];

export default function MockMap({ device, onLocationTrigger, onUpdateLocation }: MockMapProps) {
  const [isWalking, setIsWalking] = useState(false);
  const [waypointIndex, setWaypointIndex] = useState(0);
  const [currentPos, setCurrentPos] = useState({ x: 30, y: 35 });
  const [activeGeofences, setActiveGeofences] = useState<string[]>(['geo-home']);

  // Map configuration
  const mapWidth = 500;
  const mapHeight = 320;

  // Render coordinates derived from lat/lng or relative path
  // If not walking, set static relative coordinates based on device state
  useEffect(() => {
    if (!isWalking) {
      // Find closest waypoint or set a custom grid position
      if (device.id === 'device-1') {
        setCurrentPos({ x: 35, y: 50 }); // Near School
      } else {
        setCurrentPos({ x: 68, y: 72 }); // English center
      }
    }
  }, [device.id, isWalking]);

  // Handle Walking Simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWalking) {
      interval = setInterval(() => {
        setWaypointIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % WAYPOINTS.length;
          const nextPoint = WAYPOINTS[nextIndex];

          // Update actual parent coordinates
          onUpdateLocation(nextPoint.lat, nextPoint.lng, nextPoint.name);
          setCurrentPos({ x: nextPoint.x, y: nextPoint.y });

          // Detect Geofence crossings
          checkGeofenceCrossings(nextPoint);

          return nextIndex;
        });
      }, 4000); // Step every 4 seconds
    }
    return () => clearInterval(interval);
  }, [isWalking, waypointIndex]);

  const checkGeofenceCrossings = (point: typeof WAYPOINTS[0]) => {
    // Determine which geofences are entered
    const entered: string[] = [];
    
    if (point.name.includes('Nhà riêng')) {
      entered.push('geo-home');
      if (!activeGeofences.includes('geo-home')) {
        onLocationTrigger(`📍 ${device.name} đã VỀ nhà an toàn.`, 'location');
      }
    } else if (point.name.includes('Trường học')) {
      entered.push('geo-school');
      if (!activeGeofences.includes('geo-school')) {
        onLocationTrigger(`📍 ${device.name} đã ĐẾN Trường học Nguyễn Du.`, 'location');
      }
    } else if (point.name.includes('Công viên')) {
      entered.push('geo-park');
      if (!activeGeofences.includes('geo-park')) {
        onLocationTrigger(`🌳 ${device.name} đã ĐẾN Công viên Tao Đàn chơi thể thao.`, 'location');
      }
    } else if (point.name.includes('Quán Net')) {
      entered.push('geo-game');
      if (!activeGeofences.includes('geo-game')) {
        onLocationTrigger(`⚠️ CẢNH BÁO: ${device.name} đã ĐI VÀO Quán Net Cyber (Vùng cấm)!`, 'security');
      }
    }

    // Check exited geofences
    activeGeofences.forEach((geoId) => {
      const geo = GEOFENCES.find(g => g.id === geoId);
      if (geo && !entered.includes(geoId)) {
        const placeName = geo.name.split(' (')[0];
        onLocationTrigger(`🚶 ${device.name} đã RỜI KHỎI ${placeName}.`, 'location');
      }
    });

    setActiveGeofences(entered);
  };

  const toggleWalkSimulation = () => {
    if (isWalking) {
      setIsWalking(false);
    } else {
      setIsWalking(true);
      // Reset to starting point
      const startPoint = WAYPOINTS[0];
      setWaypointIndex(0);
      setCurrentPos({ x: startPoint.x, y: startPoint.y });
      onUpdateLocation(startPoint.lat, startPoint.lng, startPoint.name);
      setActiveGeofences(['geo-home']);
      onLocationTrigger(`🔄 Đã khởi động giả lập di chuyển trực tuyến của ${device.name}.`, 'location');
    }
  };

  // Convert map relative coordinates to viewport
  const getX = (pct: number) => (pct / 100) * mapWidth;
  const getY = (pct: number) => (pct / 100) * mapHeight;

  // Convert predefined geofences to grid positions for rendering
  const getGeofenceGridCenter = (id: string) => {
    switch(id) {
      case 'geo-home': return { x: 30, y: 35, color: 'rgba(34, 197, 94, 0.15)', stroke: '#22c55e', text: 'Nhà riêng' };
      case 'geo-school': return { x: 35, y: 50, color: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6', text: 'Trường học' };
      case 'geo-park': return { x: 62, y: 80, color: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', text: 'Công viên' };
      case 'geo-game': return { x: 75, y: 70, color: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', text: 'Vùng cấm' };
      default: return { x: 50, y: 50, color: 'rgba(156, 163, 175, 0.15)', stroke: '#9ca3af', text: 'Vùng giám sát' };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full" id="mock-map-container">
      {/* Map Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Bản Đồ Định Vị GPS</h3>
            <p className="text-xs text-slate-400">Thời gian thực • Sai số ±5m</p>
          </div>
        </div>

        <button
          onClick={toggleWalkSimulation}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            isWalking
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/15'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/15'
          }`}
          id="btn-auto-walk"
        >
          {isWalking ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Dừng Giả Lập</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chạy Giả Lập Di Chuyển</span>
            </>
          )}
        </button>
      </div>

      {/* Map Canvas Canvas Container */}
      <div className="relative flex-1 min-h-[260px] bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden shadow-inner">
        {/* SVG stylized map content */}
        <svg 
          viewBox={`0 0 ${mapWidth} ${mapHeight}`} 
          className="w-full h-full select-none"
          id="svg-styled-map"
        >
          {/* Defs for grid pattern and glows */}
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(51, 65, 85, 0.15)" strokeWidth="1" />
            </pattern>
            <radialGradient id="childGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Grid background */}
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* District water or block zones */}
          <rect x={getX(10)} y={getY(10)} width="80" height="50" rx="6" fill="#1e293b" opacity="0.15" />
          <rect x={getX(55)} y={getY(15)} width="120" height="80" rx="8" fill="#1e293b" opacity="0.15" />
          <rect x={getX(15)} y={getY(60)} width="100" height="90" rx="8" fill="#1e293b" opacity="0.15" />

          {/* Streets and roads (Primary skeleton grid) */}
          {/* Main vertical road */}
          <line x1={getX(35)} y1="0" x2={getX(35)} y2={mapHeight} stroke="rgba(71, 85, 105, 0.4)" strokeWidth="14" strokeLinecap="round" />
          <line x1={getX(35)} y1="0" x2={getX(35)} y2={mapHeight} stroke="#0f172a" strokeWidth="1" strokeDasharray="5,5" />

          {/* Secondary vertical road */}
          <line x1={getX(70)} y1="0" x2={getX(70)} y2={mapHeight} stroke="rgba(71, 85, 105, 0.4)" strokeWidth="10" strokeLinecap="round" />

          {/* Main horizontal road */}
          <line x1="0" y1={getY(50)} x2={mapWidth} y2={getY(50)} stroke="rgba(71, 85, 105, 0.4)" strokeWidth="14" strokeLinecap="round" />
          <line x1="0" y1={getY(50)} x2={mapWidth} y2={getY(50)} stroke="#0f172a" strokeWidth="1" strokeDasharray="5,5" />

          {/* Secondary diagonal road */}
          <line x1="0" y1={getY(15)} x2={mapWidth} y2={getY(90)} stroke="rgba(71, 85, 105, 0.3)" strokeWidth="8" />

          {/* Geofence zones (circles with labels) */}
          {GEOFENCES.map((geo) => {
            const layout = getGeofenceGridCenter(geo.id);
            const cx = getX(layout.x);
            const cy = getY(layout.y);
            const size = (geo.radius / 1000) * 180; // approximate pixel scaling
            const isRestricted = geo.type === 'restricted';
            
            return (
              <g key={geo.id} className="transition-all duration-300">
                {/* Glowing range */}
                <circle 
                  cx={cx} 
                  cy={cy} 
                  r={size} 
                  fill={layout.color} 
                  stroke={layout.stroke} 
                  strokeWidth="1.5" 
                  strokeDasharray={isRestricted ? "3,3" : "none"} 
                  className={isRestricted ? "animate-pulse" : ""}
                />
                
                {/* Center marker dot */}
                <circle cx={cx} cy={cy} r="4" fill={layout.stroke} />
                
                {/* Zone Label banner */}
                <rect 
                  x={cx - 45} 
                  y={cy - size - 18} 
                  width="90" 
                  height="14" 
                  rx="3" 
                  fill={isRestricted ? '#ef4444' : '#1e293b'} 
                  opacity="0.9" 
                  stroke={isRestricted ? '#fca5a5' : '#475569'}
                  strokeWidth="0.5"
                />
                <text 
                  x={cx} 
                  y={cy - size - 8} 
                  textAnchor="middle" 
                  fill="#ffffff" 
                  fontSize="8" 
                  fontWeight="600"
                  fontFamily="sans-serif"
                >
                  {layout.text}
                </text>
              </g>
            );
          })}

          {/* Predefined static road labels */}
          <text x={getX(2)} y={getY(47)} fill="#64748b" fontSize="8" fontFamily="sans-serif" fontWeight="500">Đại lộ Lê Duẩn</text>
          <text x={getX(38)} y={getY(95)} fill="#64748b" fontSize="8" fontFamily="sans-serif" fontWeight="500" transform={`rotate(90, ${getX(38)}, ${getY(95)})`}>Phố Nguyễn Du</text>

          {/* Simulated Child Dot marker */}
          <g transform={`translate(${getX(currentPos.x)}, ${getY(currentPos.y)})`} className="transition-all duration-500">
            {/* Ambient Pulse */}
            <circle cx="0" cy="0" r="28" fill="url(#childGlow)" className="animate-ping" style={{ animationDuration: '3s' }} />
            <circle cx="0" cy="0" r="14" fill={WAYPOINTS[waypointIndex]?.isDangerous && isWalking ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.25)'} className="animate-pulse" />
            
            {/* Pin pointer */}
            <path d="M 0 -18 L 8 -4 A 10 10 0 1 0 -8 -4 Z" fill={WAYPOINTS[waypointIndex]?.isDangerous && isWalking ? '#ef4444' : '#6366f1'} />
            
            {/* White inner border */}
            <circle cx="0" cy="-6" r="9" fill="#ffffff" />
            
            {/* Child avatar icon */}
            <text x="0" y="-3" textAnchor="middle" fontSize="11" fill="#000">
              {device.avatar}
            </text>

            {/* Glowing active state indicator */}
            <circle cx="6" cy="-12" r="3" fill="#22c55e" stroke="#ffffff" strokeWidth="0.75" />
          </g>
        </svg>

        {/* Floating current location details HUD */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-500/10 text-indigo-400 rounded">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Vị trí hiện tại của {device.name}</p>
              <p className="text-white font-medium truncate max-w-[240px]" id="current-location-text">
                {isWalking ? WAYPOINTS[waypointIndex].name : device.locationName}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-500/20">
              ● Trực tuyến
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">Tọa độ: {isWalking ? WAYPOINTS[waypointIndex].lat.toFixed(5) : device.latitude.toFixed(5)}, {isWalking ? WAYPOINTS[waypointIndex].lng.toFixed(5) : device.longitude.toFixed(5)}</p>
          </div>
        </div>

        {/* Warning Indicator Overlay when in Cyber Net */}
        {isWalking && WAYPOINTS[waypointIndex]?.isDangerous && (
          <div className="absolute top-2.5 left-2.5 bg-red-600/95 backdrop-blur-sm text-white px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-lg border border-red-500/30 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 fill-current" />
            <span>Khu vực cấm!</span>
          </div>
        )}
      </div>

      {/* Geofence Reference List */}
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="p-1.5 bg-slate-950/40 rounded border border-slate-800/50 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
          <span className="text-slate-300 truncate">Vùng An Toàn (Trường, Nhà)</span>
        </div>
        <div className="p-1.5 bg-slate-950/40 rounded border border-slate-800/50 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0"></span>
          <span className="text-slate-300 truncate">Vùng Cấm (Tiệm Games)</span>
        </div>
      </div>
    </div>
  );
}
