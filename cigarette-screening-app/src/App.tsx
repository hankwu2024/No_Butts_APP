import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ClipboardList,
  MapPin,
  Camera,
  Save,
  BarChart3,
  Users,
  Bike,
  Car,
  Footprints,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  X,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  FileArchive,
  FileUp,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  Navigation,
  FileWarning,
  Check,
  Filter,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  FileText,
  Play,
  Square
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
  getDocs,
  deleteDoc,
  doc,
  writeBatch
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import JSZip from 'jszip';

// --- Configuration & Initialization ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let storage: any;
try {
  storage = getStorage(app);
} catch (e) {
  console.warn("Firebase Storage 未設定", e);
}
const appId = import.meta.env.VITE_APP_ID || 'default-app-id';

// --- Constants & Types ---
const CITY_CODES = [
  { code: 'A', name: '臺北市' },
  { code: 'B', name: '臺中市' },
  { code: 'C', name: '基隆市' },
  { code: 'D', name: '臺南市' },
  { code: 'E', name: '高雄市' },
  { code: 'F', name: '新北市' },
  { code: 'G', name: '宜蘭縣' },
  { code: 'H', name: '桃園市' },
  { code: 'I', name: '嘉義市' },
  { code: 'J', name: '新竹縣' },
  { code: 'K', name: '苗栗縣' },
  { code: 'M', name: '南投縣' },
  { code: 'N', name: '彰化縣' },
  { code: 'O', name: '新竹市' },
  { code: 'P', name: '雲林縣' },
  { code: 'Q', name: '嘉義縣' },
  { code: 'T', name: '屏東縣' },
  { code: 'U', name: '花蓮縣' },
  { code: 'V', name: '臺東縣' },
  { code: 'W', name: '金門縣' },
  { code: 'X', name: '澎湖縣' },
  { code: 'Y', name: '陽明山(範例/其它)' },
  { code: 'Z', name: '連江縣' },
];

const LOGO_URL = "/不落蒂大圖.jpg"; // 請將此圖片放在 public 資料夾下

interface Hotspot {
  id: string;
  address: string;
  count: number;
  note: string;
}

interface ScreeningData {
  id?: string;
  recordId: string;
  date: string; // YYYY-MM-DD
  cityCode: string;
    
  // Personnel
  recorderName: string;
  screenerName: string;
  photographerName: string;
    
  // Location
  startAddress: string;
  endAddress: string;
  direction: 'right' | 'left';
    
  // Counts (Main Statistics)
  screenedCount: number;
  actualPickedCount: number;
  boxCount: number;
  drainCount: number;
    
  note: string;
  photoCount: number;
  images: string[];
    
  // Tracking
  path?: {lat: number, lng: number, timestamp: number}[];
  distance?: number;
    
  // Hotspots
  hotspots: Hotspot[];
    
  // Method
  method: 'walk' | 'bike' | 'motor';
  roadType: 'complex' | 'normal' | 'road_only';
    
  userId: string;
  createdAt: any;
}

// --- Types for Filtering & Sorting ---
type SortField = 'date' | 'actualPickedCount' | 'screenedCount' | 'recordId';
type SortDirection = 'asc' | 'desc';

interface FilterState {
  city: string;
  dateStart: string;
  dateEnd: string;
  address: string;
  recordId: string;
  personnel: string;
}

interface SortState {
  field: SortField;
  direction: SortDirection;
}

// --- Utils ---
// Helper to resize images
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        const width = scaleSize < 1 ? MAX_WIDTH : img.width;
        const height = scaleSize < 1 ? img.height * scaleSize : img.height;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
    };
  });
};

// --- ROBUST CSV PARSER ---
const parseCSV = (text: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuote = false;
    
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuote && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === ',' && !inQuote) {
      currentRow.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal);
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
    
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }
  return rows;
};

// --- Helper Functions ---
const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// --- Helper UI Components ---
const InputText = ({ label, name, value, onChange, placeholder, required, onLocate }: any) => (
  <div>
    <label className="block text-xs font-medium text-slate-500 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
    <div className="flex gap-2">
      <input type="text" name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
      {onLocate && (
        <button 
          type="button" 
          onClick={onLocate}
          className="shrink-0 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 w-10 rounded-lg transition-colors flex items-center justify-center active:scale-95"
          title="使用 GPS 定位"
        >
          <MapPin className="w-5 h-5" />
        </button>
      )}
    </div>
  </div>
);

const SelectionCard = ({ selected, onClick, title, subtitle, icon, smallText }: any) => (
  <button type="button" onClick={onClick} className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-emerald-200'}`}>
    {icon && <div className="mb-2">{icon}</div>}
    <div className={`${smallText ? 'text-xs' : 'text-sm'} font-bold`}>{title}</div>
    {subtitle && <div className="text-[10px] opacity-75 mt-1">{subtitle}</div>}
    {selected && <div className="absolute top-1 right-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>}
  </button>
);

const CounterInput = ({
  label,
  value,
  onChange,
  colorClass = "text-emerald-600",
  bgClass = "bg-emerald-50",
  btnClass = "bg-emerald-100 text-emerald-700"
}: {
  label: string,
  value: number,
  onChange: (val: number) => void,
  colorClass?: string,
  bgClass?: string,
  btnClass?: string
}) => {
  const handleDecrease = () => {
    if (value > 0) onChange(value - 1);
  };
  const handleIncrease = () => {
    onChange(value + 1);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    if (val >= 0) onChange(val);
  };
    
  return (
    <div className={`flex flex-col items-center p-4 rounded-xl border border-slate-100 ${bgClass}`}>
      <span className="text-xl font-bold text-slate-700 mb-4">{label}</span>
      <div className="flex items-center gap-2 w-full justify-center">
        <button
          type="button"
          onClick={handleDecrease}
          disabled={value <= 0}
          className={`w-[100px] sm:w-[140px] h-[60px] sm:h-[80px] rounded-xl flex items-center justify-center transition-active active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed bg-white border border-slate-200 text-slate-500 shadow-sm`}
        >
          <Minus className="w-8 h-8 sm:w-12 sm:h-12" />
        </button>
          
        <input
          type="number"
          min="0"
          value={value}
          onChange={handleInputChange}
          className={`w-20 sm:w-28 text-center text-3xl sm:text-4xl font-bold bg-transparent outline-none ${colorClass}`}
        />
        <button
          type="button"
          onClick={handleIncrease}
          className={`w-[100px] sm:w-[140px] h-[60px] sm:h-[80px] rounded-xl flex items-center justify-center transition-active active:scale-95 shadow-sm ${btnClass}`}
        >
          <Plus className="w-8 h-8 sm:w-12 sm:h-12" />
        </button>
      </div>
    </div>
  );
};

// 軌跡預覽小地圖元件
const PathPreview = ({ path }: { path: {lat: number, lng: number}[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !path || path.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (path.length === 1) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (path.length > 1) {
      const lats = path.map(p => p.lat);
      const lngs = path.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
        
      const latDiff = maxLat - minLat || 0.0001;
      const lngDiff = maxLng - minLng || 0.0001;
        
      const padding = 15;
      const usableWidth = canvas.width - padding * 2;
      const usableHeight = canvas.height - padding * 2;

      const getX = (lng: number) => padding + ((lng - minLng) / lngDiff) * usableWidth;
      const getY = (lat: number) => canvas.height - (padding + ((lat - minLat) / latDiff) * usableHeight);

      // 畫連線
      ctx.beginPath();
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      path.forEach((p, i) => {
        const x = getX(p.lng);
        const y = getY(p.lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 畫起點與終點
      const startX = getX(path[0].lng);
      const startY = getY(path[0].lat);
      ctx.fillStyle = '#22c55e'; // 綠色起點
      ctx.beginPath();
      ctx.arc(startX, startY, 5, 0, Math.PI * 2);
      ctx.fill();

      const endX = getX(path[path.length - 1].lng);
      const endY = getY(path[path.length - 1].lat);
      ctx.fillStyle = '#ef4444'; // 紅色終點
      ctx.beginPath();
      ctx.arc(endX, endY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [path]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={150}
      className="w-full h-24 bg-white border border-slate-200 rounded-lg shadow-inner object-contain mt-1"
    />
  );
};

// --- Feature Components ---

// Reusable Filter & Sort Component
const FilterSortBar = ({
  filter,
  setFilter,
  sort,
  setSort,
  onReset
}: {
  filter: FilterState;
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
  sort: SortState;
  setSort: React.Dispatch<React.SetStateAction<SortState>>;
  onReset: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-700 font-bold">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>篩選與排序條件</span>
        </div>
        <ArrowUpDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
        
      {isExpanded && (
        <div className="p-4 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">案件編號</label>
              <div className="relative">
                <FileText className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="輸入編號..." 
                  value={filter.recordId}
                  onChange={(e) => setFilter(prev => ({...prev, recordId: e.target.value}))}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">地址關鍵字</label>
              <div className="relative">
                <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="輸入路段或地點..." 
                  value={filter.address}
                  onChange={(e) => setFilter(prev => ({...prev, address: e.target.value}))}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">人員姓名</label>
              <div className="relative">
                <Users className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="紀錄/快篩/拍照人員..." 
                  value={filter.personnel}
                  onChange={(e) => setFilter(prev => ({...prev, personnel: e.target.value}))}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">縣市</label>
              <select 
                value={filter.city} 
                onChange={(e) => setFilter(prev => ({...prev, city: e.target.value}))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
              >
                <option value="">全部縣市</option>
                {CITY_CODES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">日期範圍</label>
              <div className="flex gap-1 items-center">
                 <input 
                   type="date" 
                   value={filter.dateStart}
                   onChange={(e) => setFilter(prev => ({...prev, dateStart: e.target.value}))}
                   className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" 
                 />
                 <span className="text-slate-400">-</span>
                 <input 
                   type="date" 
                   value={filter.dateEnd}
                   onChange={(e) => setFilter(prev => ({...prev, dateEnd: e.target.value}))}
                   className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" 
                 />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3">
             <label className="block text-xs font-bold text-slate-500 mb-2">排序方式</label>
             <div className="flex gap-2">
                <select 
                  value={sort.field}
                  onChange={(e) => setSort(prev => ({...prev, field: e.target.value as SortField}))}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                >
                  <option value="recordId">案件編號</option>
                  <option value="date">日期</option>
                  <option value="actualPickedCount">撿拾數量</option>
                  <option value="screenedCount">快篩數量</option>
                </select>
                <button 
                  onClick={() => setSort(prev => ({...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc'}))}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors flex items-center justify-center w-10 shrink-0"
                >
                  {sort.direction === 'asc' ? <SortAsc className="w-5 h-5 text-slate-600"/> : <SortDesc className="w-5 h-5 text-slate-600"/>}
                </button>
             </div>
          </div>
          <button 
            onClick={onReset}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
          >
            重設所有條件
          </button>
        </div>
      )}
    </div>
  );
};

// 1. Splash / Login Screen
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [imageError, setImageError] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
    
  const handleStart = () => {
    setStatus('requesting');
      
    if (!navigator.geolocation) {
      setErrorMsg("您的裝置不支援 GPS 定位，請更換裝置。");
      setStatus('error');
      return;
    }
      
    navigator.geolocation.getCurrentPosition(
      () => {
        setTimeout(() => onLogin(), 600);
      },
      (error) => {
        console.warn("Location error:", error);
        let msg = "定位失敗";
        if (error.code === 1) msg = "您已「拒絕」定位權限。\n\n如需使用自動填入 GPS 功能，請至瀏覽器設定開啟權限。";
        else if (error.code === 2) msg = "無法偵測目前位置 (訊號不良)。";
        else if (error.code === 3) msg = "定位請求逾時，請重試。";
          
        setErrorMsg(msg);
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };
    
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-emerald-50 p-6 text-center">
      {status === 'error' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">無法取得位置</h3>
            <p className="text-slate-600 mb-6 text-sm whitespace-pre-wrap leading-relaxed">{errorMsg}</p>
              
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleStart}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
              >
                再試一次
              </button>
              <button 
                onClick={onLogin}
                className="w-full py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-colors"
              >
                仍要進入 (無GPS功能)
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-6 shadow-xl overflow-hidden p-4 ${imageError ? 'bg-emerald-600' : 'bg-white'}`}>
         {!imageError ? (
           <img
            src={LOGO_URL}
            alt="Logo"
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
           />
         ) : (
           <ClipboardList className="w-12 h-12 text-white" />
         )}
      </div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">菸蒂快篩公民科學</h1>
      <p className="text-slate-600 mb-8 max-w-sm">
        杜絕菸害，不留餘地。
      </p>
        
      <button
        onClick={handleStart}
        disabled={status === 'requesting'}
        className={`bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-full shadow-md transition-all transform hover:scale-105 flex items-center gap-2 ${status === 'requesting' ? 'opacity-75 cursor-not-allowed' : ''}`}
      >
        {status === 'requesting' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            正在請求定位...
          </>
        ) : (
          <>
            <Navigation className="w-5 h-5" />
            開啟定位並進入
          </>
        )}
      </button>
        
      <p className="mt-8 text-xs text-slate-400">Environment Protection & Citizen Science</p>
    </div>
  );
};

// 2. Data Entry Form
const ScreeningForm = ({ user, onSubmitSuccess }: { user: User, onSubmitSuccess: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("上傳中...");
  const [gpsLoading] = useState(false);
  const [modal, setModal] = useState<{show: boolean, title: string, content: string}>({
    show: false, title: '', content: ''
  });
    
  // Tracking State
  const [isTracking, setIsTracking] = useState(false);
  const [path, setPath] = useState<{lat: number, lng: number, timestamp: number}[]>([]);
  const [distance, setDistance] = useState(0);
  const trackingRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
    
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
    
  const getToday = () => new Date().toISOString().split('T')[0];
    
  const [formData, setFormData] = useState({
    date: getToday(),
    cityCode: 'G',
    recorderName: '',
    screenerName: '',
    photographerName: '',
    startAddress: '',
    endAddress: '',
    direction: 'right' as 'right' | 'left',
    screenedCount: 0,
    actualPickedCount: 0,
    boxCount: 0,
    drainCount: 0,
    note: '',
    method: '' as '' | 'walk' | 'bike' | 'motor',
    roadType: '' as '' | 'complex' | 'normal' | 'road_only',
  });
    
  const [hotspots, setHotspots] = useState<Hotspot[]>([
    { id: '1', address: '', count: 0, note: '' }
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLoading(true);
      try {
        const files = Array.from(e.target.files);
        const processedImages = await Promise.all(files.map(file => resizeImage(file)));
        setPreviewImages(prev => [...prev, ...processedImages]);
      } catch (err) {
        console.error("Image processing failed", err);
        setModal({ show: true, title: "錯誤", content: "圖片處理失敗" });
      } finally {
        setLoading(false);
      }
    }
  };

  const removeImage = (index: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const updateHotspot = (index: number, field: keyof Hotspot, value: any) => {
    const newHotspots = [...hotspots];
    newHotspots[index] = { ...newHotspots[index], [field]: value };
    setHotspots(newHotspots);
  };

  const addHotspot = () => {
    setHotspots([...hotspots, { id: Date.now().toString(), address: '', count: 0, note: '' }]);
  };

  const removeHotspot = (index: number) => {
    const newHotspots = hotspots.filter((_, i) => i !== index);
    setHotspots(newHotspots);
  };

  // 處理畫布軌跡與距離更新
  useEffect(() => {
    // 1. 計算距離
    let dist = 0;
    for (let i = 1; i < path.length; i++) {
      dist += calcDistance(path[i-1].lat, path[i-1].lng, path[i].lat, path[i].lng);
    }
    setDistance(dist);

    // 2. 自動綁定起點與終點至 formData
    if (path.length > 0) {
      setFormData(prev => ({
        ...prev,
        startAddress: `${path[0].lat.toFixed(6)}, ${path[0].lng.toFixed(6)}`,
        endAddress: `${path[path.length - 1].lat.toFixed(6)}, ${path[path.length - 1].lng.toFixed(6)}`
      }));
    } else {
      setFormData(prev => ({ ...prev, startAddress: '', endAddress: '' }));
    }

    // 3. 繪製軌跡
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (path.length === 1) {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (path.length > 1) {
          const lats = path.map(p => p.lat);
          const lngs = path.map(p => p.lng);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const latDiff = maxLat - minLat || 0.0001;
          const lngDiff = maxLng - minLng || 0.0001;
          const padding = 20;
          const usableWidth = canvas.width - padding * 2;
          const usableHeight = canvas.height - padding * 2;

          const getX = (lng: number) => padding + ((lng - minLng) / lngDiff) * usableWidth;
          const getY = (lat: number) => canvas.height - (padding + ((lat - minLat) / latDiff) * usableHeight);

          // 畫連線
          ctx.beginPath();
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 3;
          path.forEach((p, i) => {
            const x = getX(p.lng);
            const y = getY(p.lat);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();

          // 畫點
          path.forEach((p, i) => {
            const x = getX(p.lng);
            const y = getY(p.lat);
            ctx.beginPath();
            if (i === 0) {
              ctx.fillStyle = '#22c55e'; // 起點綠色
              ctx.arc(x, y, 6, 0, Math.PI * 2);
            } else if (i === path.length - 1 && !isTracking) {
              ctx.fillStyle = '#ef4444'; // 終點紅色 (結束定位才標示)
              ctx.arc(x, y, 6, 0, Math.PI * 2);
            } else {
              ctx.fillStyle = '#3b82f6'; // 中間點藍色
              ctx.arc(x, y, 3, 0, Math.PI * 2);
            }
            ctx.fill();
          });
        }
      }
    }
  }, [path, isTracking]);

  useEffect(() => {
    return () => {
      if (trackingRef.current) clearInterval(trackingRef.current);
    };
  }, []);

  const toggleTracking = () => {
    if (isTracking) {
      // 停止定位
      setIsTracking(false);
      if (trackingRef.current) {
        clearInterval(trackingRef.current);
        trackingRef.current = null;
      }
    } else {
      // 開始定位
      if (!navigator.geolocation) {
        setModal({ show: true, title: "不支援", content: "您的裝置不支援 GPS 定位" });
        return;
      }
      setIsTracking(true);
      setPath([]);
      setDistance(0);
        
      const fetchLocation = () => {
        navigator.geolocation.getCurrentPosition((pos) => {
          setPath(prev => [...prev, { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }]);
        }, (err) => console.error(err), { enableHighAccuracy: true });
      };
        
      fetchLocation(); // 取第一筆
      trackingRef.current = window.setInterval(fetchLocation, 10000) as unknown as number; // 每 10 秒打點一次
    }
  };

  const generateRecordId = async () => {
    try {
      const dateStr = formData.date.replace(/-/g, '');
      const prefix = `${formData.cityCode}${dateStr}`;
        
      const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'screenings'),
        where('cityCode', '==', formData.cityCode),
        where('date', '==', formData.date)
      );
        
      const snapshot = await getDocs(q);
      const count = snapshot.size + 1;
      const sequence = String(count).padStart(3, '0');
      return `${prefix}-${sequence}`;
    } catch (e) {
      console.error("Error generating ID", e);
      return `${formData.cityCode}${Date.now()}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isTracking) {
      setModal({ show: true, title: "定位中", content: "請先按下「結束定位」再提交表單。" });
      return;
    }
      
    // 檢查並收集所有漏填的必填欄位
    const missingFields: string[] = [];
    if (!formData.recorderName) missingFields.push("紀錄人員");
    if (!formData.startAddress) missingFields.push("起點地址");
    if (!formData.endAddress) missingFields.push("終點地址");
    if (!formData.method) missingFields.push("移動方式");
    if (!formData.roadType) missingFields.push("路段型態");

    // 如果有漏填，動態產生提示訊息
    if (missingFields.length > 0) {
      setModal({ 
        show: true, 
        title: "缺少必填欄位", 
        content: `您還有以下必填欄位尚未填寫：\n\n${missingFields.map(f => `• ${f}`).join('\n')}` 
      });
      return;
    }

    setLoading(true);
    setLoadingText("準備資料中...");
    try {
      const recordId = await generateRecordId();
        
      // 處理圖片上傳至 Firebase Storage
      const finalImages: string[] = [];
      if (previewImages.length > 0) {
        for (let i = 0; i < previewImages.length; i++) {
          setLoadingText(`上傳圖片中... (${i + 1}/${previewImages.length})`);
          try {
            // 嘗試上傳到 Storage
            if (!storage || !app.options.storageBucket || app.options.storageBucket === 'dummy') {
              throw new Error("Storage not configured");
            }
            const imageRef = ref(storage, `artifacts/${appId}/public/images/${recordId}_${Date.now()}_${i}.jpg`);
            await uploadString(imageRef, previewImages[i], 'data_url');
            const url = await getDownloadURL(imageRef);
            finalImages.push(url);
          } catch (e) {
            console.warn("Storage 上傳失敗，降級使用 Base64 儲存", e);
            // 降級機制：如果 Storage 失敗或未開通，退回儲存 Base64
            finalImages.push(previewImages[i]);
          }
        }
      }

      setLoadingText("儲存紀錄中...");
        
      const safeData = {
        ...formData,
        screenedCount: Math.max(0, formData.screenedCount),
        actualPickedCount: Math.max(0, formData.actualPickedCount),
        boxCount: Math.max(0, formData.boxCount),
        drainCount: Math.max(0, formData.drainCount),
        hotspots: hotspots.filter(h => h.address).map(h => ({...h, count: Math.max(0, h.count)}))
      };
        
      const payload: ScreeningData = {
        ...safeData,
        method: formData.method as 'walk' | 'bike' | 'motor',
        roadType: formData.roadType as 'complex' | 'normal' | 'road_only',
        recordId,
        userId: user.uid,
        photoCount: finalImages.length,
        images: finalImages,
        path: path,
        distance: distance,
        createdAt: serverTimestamp()
      };
        
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'screenings'), payload);
        
      setModal({ 
          show: true, 
          title: "上傳成功", 
          content: `案件編號：${recordId}\n(照片已記錄數量: ${finalImages.length} 張)`
      });
        
    } catch (err) {
      console.error(err);
      setModal({ show: true, title: "上傳失敗", content: "請檢查網路或稍後再試。" });
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
      setModal(prev => ({ ...prev, show: false }));
      if (modal.title === "上傳成功") {
          onSubmitSuccess();
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">
      {gpsLoading && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full">
                 <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                 <h3 className="font-bold text-lg text-slate-800 mb-2">正在定位中...</h3>
                 <p className="text-slate-500 text-sm">請稍候，正在獲取 GPS 座標</p>
             </div>
        </div>
      )}
        
      {modal.show && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
             <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col max-w-sm w-full">
                 <h3 className="font-bold text-lg text-slate-800 mb-2">{modal.title}</h3>
                 <p className="text-slate-600 text-sm whitespace-pre-wrap mb-6 leading-relaxed">
                    {modal.content}
                 </p>
                 <button 
                    type="button"
                    onClick={handleModalClose}
                    className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors"
                 >
                    確定
                 </button>
             </div>
        </div>
      )}
        
      <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      <input type="file" ref={galleryInputRef} accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
        
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
           <ClipboardList className="w-5 h-5 text-emerald-600" />
           基本資料
        </h2>
          
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">縣市代碼</label>
            <select name="cityCode" value={formData.cityCode} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              {CITY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">日期</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono" />
          </div>
        </div>
          
        <div className="space-y-3">
          <InputText label="紀錄人員" name="recorderName" value={formData.recorderName} onChange={handleInputChange} required />
          <InputText label="快篩人員" name="screenerName" value={formData.screenerName} onChange={handleInputChange} />
          <InputText label="拍照人員" name="photographerName" value={formData.photographerName} onChange={handleInputChange} />
        </div>
      </div>
        
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
           <Footprints className="w-5 h-5 text-emerald-600" />
           快篩方式與型態
        </h2>
          
        <label className="block text-xs font-medium text-slate-500 mb-2">移動方式 <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-3 gap-2 mb-6">
          <SelectionCard selected={formData.method === 'walk'} onClick={() => setFormData(prev => ({...prev, method: 'walk'}))} title="步行" icon={<Footprints className="w-5 h-5" />} />
          <SelectionCard selected={formData.method === 'bike'} onClick={() => setFormData(prev => ({...prev, method: 'bike'}))} title="單車" icon={<Bike className="w-5 h-5" />} />
          <SelectionCard selected={formData.method === 'motor'} onClick={() => setFormData(prev => ({...prev, method: 'motor'}))} title="機動車" icon={<Car className="w-5 h-5" />} />
        </div>
          
        <label className="block text-xs font-medium text-slate-500 mb-2">路段型態 <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-3 gap-2">
          <SelectionCard smallText selected={formData.roadType === 'complex'} onClick={() => setFormData(prev => ({...prev, roadType: 'complex'}))} title="複雜" subtitle="(人行+花圃)" />
          <SelectionCard smallText selected={formData.roadType === 'normal'} onClick={() => setFormData(prev => ({...prev, roadType: 'normal'}))} title="普通" subtitle="(人行)" />
          <SelectionCard smallText selected={formData.roadType === 'road_only'} onClick={() => setFormData(prev => ({...prev, roadType: 'road_only'}))} title="純馬路" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
           <MapPin className="w-5 h-5 text-emerald-600" />
           快篩地點與方向
        </h2>
          
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-2">軌跡定位 <span className="text-red-500">*</span></label>
          <div className="flex flex-col gap-3">
             <button 
               type="button" 
               onClick={toggleTracking} 
               className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isTracking ? 'bg-red-100 text-red-600 border border-red-200 animate-pulse' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}
             >
               {isTracking ? (
                 <><Square className="w-5 h-5" fill="currentColor" /> 結束定位</>
               ) : (
                 <><Play className="w-5 h-5" fill="currentColor" /> 開始定位</>
               )}
             </button>
               
             {/* 儀表與畫布顯示 */}
             <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex justify-between items-center text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-2">
                   <span>已紀錄點數：<span className="text-emerald-600">{path.length}</span></span>
                   <span>總距離：<span className="text-blue-600">{distance.toFixed(1)}</span> 公尺</span>
                </div>
                  
                <canvas 
                  ref={canvasRef} 
                  width={400} 
                  height={250} 
                  className="w-full bg-white border border-slate-200 rounded-lg shadow-inner mb-2"
                />

                <div className="text-xs text-slate-500 flex justify-between">
                   <span>起點: {path.length > 0 ? "已記錄" : "尚未開始"}</span>
                   <span>終點: {path.length > 1 && !isTracking ? "已記錄" : (isTracking ? "定位中..." : "尚未開始")}</span>
                </div>
             </div>
          </div>
        </div>
          
        <div className="grid grid-cols-2 gap-3">
          <SelectionCard selected={formData.direction === 'right'} onClick={() => setFormData(prev => ({...prev, direction: 'right'}))} title="右向 (順向)" icon={<ArrowRight className="w-6 h-6" />} />
          <SelectionCard selected={formData.direction === 'left'} onClick={() => setFormData(prev => ({...prev, direction: 'left'}))} title="左向 (逆向)" icon={<ArrowLeft className="w-6 h-6" />} />
        </div>
      </div>
        
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
           <Trash2 className="w-5 h-5 text-emerald-600" />
           數據統計
        </h2>
          
        <div className="grid grid-cols-1 gap-6 mb-6">
          <CounterInput label="1. 快篩估計數量" value={formData.screenedCount} onChange={(v) => setFormData(prev => ({...prev, screenedCount: v}))} colorClass="text-emerald-600" btnClass="bg-emerald-100 text-emerald-700 hover:bg-emerald-200" />
          <CounterInput label="2. 水溝蓋數量" value={formData.drainCount} onChange={(v) => setFormData(prev => ({...prev, drainCount: v}))} colorClass="text-slate-700" bgClass="bg-slate-50" btnClass="bg-slate-200 text-slate-700 hover:bg-slate-300" />
          <CounterInput label="3. 菸盒數量" value={formData.boxCount} onChange={(v) => setFormData(prev => ({...prev, boxCount: v}))} colorClass="text-slate-700" bgClass="bg-slate-50" btnClass="bg-slate-200 text-slate-700 hover:bg-slate-300" />
          <CounterInput label="4. 實際撿拾數量" value={formData.actualPickedCount} onChange={(v) => setFormData(prev => ({...prev, actualPickedCount: v}))} colorClass="text-blue-600" bgClass="bg-blue-50" btnClass="bg-blue-100 text-blue-700 hover:bg-blue-200" />
        </div>
          
        <textarea name="note" value={formData.note} onChange={handleInputChange} placeholder="備註 (拍照紀錄或其他說明)..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-20 mb-4" />
          
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-bold text-sm hover:bg-emerald-100 active:scale-95 transition-all shadow-sm">
            <Camera className="w-5 h-5" /> 開啟相機
          </button>
          <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex items-center justify-center gap-2 p-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-bold text-sm hover:bg-slate-200 active:scale-95 transition-all shadow-sm">
            <ImageIcon className="w-5 h-5" /> 上傳圖片
          </button>
        </div>
          
        {previewImages.length > 0 && (
          <div className="grid grid-cols-4 gap-2 animate-fadeIn">
            {previewImages.map((src, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm group bg-black">
                <img src={src} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-80 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
        
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-orange-500">
        <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
           <AlertTriangle className="w-5 h-5 text-orange-500" />
           菸蒂熱點通報
        </h2>
        <p className="text-xs text-orange-600 mb-4 bg-orange-50 p-2 rounded">定義：1平方公尺超過 50 根菸蒂</p>
          
        {hotspots.map((hotspot, idx) => (
          <div key={hotspot.id} className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 relative">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-slate-700 bg-orange-100 text-orange-800 px-2 py-0.5 rounded">熱點 #{idx + 1}</span>
              {hotspots.length > 0 && <button type="button" onClick={() => removeHotspot(idx)} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>}
            </div>
              
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">熱點地址/位置</label>
                <input type="text" placeholder="請輸入地址或描述" value={hotspot.address} onChange={(e) => updateHotspot(idx, 'address', e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded text-sm" />
              </div>
              <div className="flex gap-4 items-center bg-white p-2 rounded border border-slate-200">
                 <label className="text-xs font-bold text-slate-600 shrink-0">此熱點菸蒂數:</label>
                 <div className="flex items-center gap-2 flex-1 justify-end">
                    <button type="button" onClick={() => updateHotspot(idx, 'count', Math.max(0, hotspot.count - 1))} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><Minus className="w-4 h-4"/></button>
                    <input type="number" value={hotspot.count} min="0" onChange={(e) => updateHotspot(idx, 'count', Math.max(0, parseInt(e.target.value) || 0))} className="w-16 text-center font-bold text-orange-600 outline-none" />
                    <button type="button" onClick={() => updateHotspot(idx, 'count', hotspot.count + 1)} className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><Plus className="w-4 h-4"/></button>
                 </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">備註</label>
                <input type="text" placeholder="熱點相關備註..." value={hotspot.note} onChange={(e) => updateHotspot(idx, 'note', e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded text-sm" />
              </div>
            </div>
          </div>
        ))}
          
        <button type="button" onClick={addHotspot} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-400 transition-colors font-bold">
          <Plus className="w-5 h-5" /> 新增熱點
        </button>
      </div>
        
      <div className="mt-6 mb-8 px-1">
        <button type="submit" disabled={loading} className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'}`}>
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {loadingText}</> : <><Save className="w-5 h-5" /> 提交資料</>}
        </button>
      </div>
    </form>
  );
};

// 3. Admin/Gov Dashboard
const Dashboard = ({ user }: { user: User }) => {
  const [data, setData] = useState<ScreeningData[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingState, setProcessingState] = useState<{ status: 'idle' | 'exporting' | 'importing', message: string, progress: number }>({ status: 'idle', message: '', progress: 0 });
  const [importConfirm, setImportConfirm] = useState<{show: boolean, file: File | null}>({show: false, file: null});
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
    
  const [filter, setFilter] = useState<FilterState>({ city: '', dateStart: '', dateEnd: '', address: '', recordId: '', personnel: '' });
  const [sort, setSort] = useState<SortState>({ field: 'recordId', direction: 'desc' });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
    
  useEffect(() => {
    if (!user) return;
      
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'screenings'),
      orderBy('createdAt', 'desc')
    );
      
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedData: ScreeningData[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ScreeningData));
      setData(fetchedData);
      setLoading(false);
    }, (error) => {
        console.error("Fetch error:", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredSortedData = useMemo(() => {
    let res = [...data];
    if (filter.city) {
        res = res.filter(r => r.cityCode === filter.city);
    }
    if (filter.dateStart) {
        res = res.filter(r => r.date >= filter.dateStart);
    }
    if (filter.dateEnd) {
        res = res.filter(r => r.date <= filter.dateEnd);
    }
    if (filter.recordId) {
        const lower = filter.recordId.toLowerCase();
        res = res.filter(r => r.recordId.toLowerCase().includes(lower));
    }
    if (filter.address) {
        const lower = filter.address.toLowerCase();
        res = res.filter(r => 
            r.startAddress.includes(lower) || 
            (r.endAddress && r.endAddress.includes(lower))
        );
    }
    if (filter.personnel) {
        const lower = filter.personnel.toLowerCase();
        res = res.filter(r => 
            (r.recorderName && r.recorderName.toLowerCase().includes(lower)) ||
            (r.screenerName && r.screenerName.toLowerCase().includes(lower)) ||
            (r.photographerName && r.photographerName.toLowerCase().includes(lower))
        );
    }
      
    res.sort((a, b) => {
        let valA = a[sort.field];
        let valB = b[sort.field];
          
        if (typeof valA === 'string' && typeof valB === 'string') {
            return sort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if ((valA as any) < (valB as any)) return sort.direction === 'asc' ? -1 : 1;
        if ((valA as any) > (valB as any)) return sort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    return res;
  }, [data, filter, sort]);

  const stats = useMemo(() => {
    const targetData = filteredSortedData; 
      
    const totalActualPicked = targetData.reduce((sum, item) => sum + (item.actualPickedCount || 0), 0);
    const totalScreenedEst = targetData.reduce((sum, item) => sum + (item.screenedCount || 0), 0);
    const totalHotspots = targetData.reduce((sum, item) => sum + (item.hotspots?.length || 0), 0);
    const totalRecords = targetData.length;
      
    const cityCount: Record<string, number> = {};
    targetData.forEach(d => {
      const name = CITY_CODES.find(c => c.code === d.cityCode)?.name || d.cityCode;
      cityCount[name] = (cityCount[name] || 0) + (d.actualPickedCount || 0);
    });
    return { totalActualPicked, totalScreenedEst, totalHotspots, totalRecords, cityCount };
  }, [filteredSortedData]);

  useEffect(() => {
      setCurrentPage(1);
  }, [filter, sort]);

  const totalPages = Math.ceil(filteredSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredSortedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleExportZip = async () => {
    if (filteredSortedData.length === 0) {
      alert("目前列表沒有資料可匯出");
      return;
    }
      
    setProcessingState({ status: 'exporting', message: '正在打包資料與照片...', progress: 0 });
      
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder("images");
        
      const headers = [
        "案件編號", "日期", "縣市", "紀錄人員", "快篩人員",
        "起點地址", "終點地址", "方向",
        "快篩估計數量", "實際撿拾數量", "菸盒數量", "水溝蓋數量",
        "熱點數量", "照片數量", "備註", "移動方式", "路段型態", "照片檔名"
      ];
        
      const rows = await Promise.all(filteredSortedData.map(async (item) => {
        const cityName = CITY_CODES.find(c => c.code === item.cityCode)?.name || item.cityCode;
        const directionStr = item.direction === 'right' ? '右向(順向)' : '左向(逆向)';
        const methodMap: Record<string, string> = { walk: '步行', bike: '單車', motor: '機動車' };
        const roadMap: Record<string, string> = { complex: '複雜', normal: '普通', road_only: '純馬路' };
          
        const localImages: string[] = [];
        const externalUrls: string[] = [];
        let imageCellContent = "";
          
        if (item.images && item.images.length > 0) {
            item.images.forEach((imgData, imgIdx) => {
                if (imgData.startsWith('data:image')) {
                    // Base64 邏輯
                    const base64Data = imgData.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                    const filename = `${item.recordId}_${imgIdx + 1}.jpg`;
                    imgFolder?.file(filename, base64Data, {base64: true});
                    localImages.push(filename);
                } else {
                    // Firebase Storage URL 邏輯
                    externalUrls.push(imgData);
                }
            });
              
            if (localImages.length > 0) {
                const firstImage = localImages[0];
                const displayLabel = localImages.join('; ');
                imageCellContent = `=HYPERLINK("images/${firstImage}", "${displayLabel}")`;
            } else if (externalUrls.length > 0) {
                imageCellContent = externalUrls.join('\\n'); // 多個網址直接換行呈現
            }
        }
          
        const safeNote = `"${(item.note || '').replace(/"/g, '""')}"`;
        const safeImages = imageCellContent ? `"${imageCellContent.replace(/"/g, '""')}"` : "";
          
        return [
          item.recordId, item.date, cityName, item.recorderName, item.screenerName,
          `"${item.startAddress}"`, `"${item.endAddress || ''}"`, directionStr,
          item.screenedCount, item.actualPickedCount, item.boxCount, item.drainCount,
          item.hotspots ? item.hotspots.length : 0, item.images ? item.images.length : 0,
          safeNote, methodMap[item.method] || item.method, roadMap[item.roadType] || item.roadType,
          safeImages
        ].join(",");
      }));
        
      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      zip.file("data.csv", csvContent);
        
      const content = await zip.generateAsync({type: "blob"});
        
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `菸蒂快篩資料包_${new Date().toISOString().slice(0,10)}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
        
    } catch (e) {
      console.error("Export failed", e);
      alert("匯出失敗，請稍後再試");
    } finally {
      setProcessingState({ status: 'idle', message: '', progress: 0 });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportConfirm({ show: true, file });
    e.target.value = "";
  };

  const executeImport = async () => {
    const file = importConfirm.file;
    setImportConfirm({ show: false, file: null });
    if (!file) return;
    setProcessingState({ status: 'importing', message: '讀取備份檔案中...', progress: 5 });
      
    try {
        const zip = await JSZip.loadAsync(file);
          
        const csvFile = zip.file("data.csv");
        if (!csvFile) throw new Error("找不到 data.csv，請確認匯入的是正確的備份檔。");
          
        const csvText = await csvFile.async("string");
        const rows = parseCSV(csvText); 
          
        if (rows.length < 2) {
             throw new Error("CSV 檔案內容為空或格式錯誤");
        }
        setProcessingState({ status: 'importing', message: '解析 CSV 與圖片...', progress: 10 });
        const dataRows = rows.slice(1);
        const newRecords: Partial<ScreeningData>[] = [];
        const totalRows = dataRows.length;
          
        for (let i = 0; i < totalRows; i++) {
            const cols = dataRows[i];
            if (cols.length < 5) continue;
              
            const cityName = cols[2];
            const cityCode = CITY_CODES.find(c => c.name === cityName || c.code === cityName)?.code || 'G';
              
            const dirStr = cols[7] || '';
            const direction = dirStr.includes('左') ? 'left' : 'right';
            const methodStr = cols[15] || '';
            const method = methodStr === '單車' ? 'bike' : methodStr === '機動車' ? 'walk' : 'walk'; // 根據欄位名稱處理
            const roadStr = cols[16] || '';
            const roadType = roadStr === '複雜' ? 'complex' : roadStr === '純馬路' ? 'road_only' : 'normal';
            const images: string[] = [];
            const imageFormula = cols[17] || '';
              
            if (imageFormula.includes("HYPERLINK")) {
                const matches = imageFormula.match(/"([^"]+)"\)$/);
                if (matches && matches[1]) {
                    const filenames = matches[1].split(';').map((s: string) => s.trim());
                    for (const fname of filenames) {
                        const imgFile = zip.file(`images/${fname}`);
                        if (imgFile) {
                            const base64 = await imgFile.async("base64");
                            const ext = fname.toLowerCase().endsWith("png") ? "png" : "jpeg";
                            images.push(`data:image/${ext};base64,${base64}`);
                        }
                    }
                }
            } else if (imageFormula.includes("http")) {
                // 支援從 CSV 中還原外部 URL (Firebase Storage)
                const urls = imageFormula.split('\\n').map(s => s.trim()).filter(s => s.startsWith('http'));
                images.push(...urls);
            }
              
            const record: Partial<ScreeningData> = {
                recordId: cols[0],
                date: cols[1],
                cityCode,
                recorderName: cols[3],
                screenerName: cols[4],
                photographerName: "",
                startAddress: cols[5],
                endAddress: cols[6],
                direction,
                screenedCount: parseInt(cols[8]) || 0,
                actualPickedCount: parseInt(cols[9]) || 0,
                boxCount: parseInt(cols[10]) || 0,
                drainCount: parseInt(cols[11]) || 0,
                hotspots: [],
                photoCount: images.length,
                images: images,
                note: cols[14],
                method: method as any,
                roadType: roadType as any,
                userId: user.uid,
                createdAt: serverTimestamp()
            };
            newRecords.push(record);
            setProcessingState(prev => ({ 
                ...prev, 
                progress: 10 + Math.floor((i / totalRows) * 20),
                message: `正在解析第 ${i + 1}/${totalRows} 筆資料...`
            }));
        }
          
        setProcessingState({ status: 'importing', message: '正在清除舊資料...', progress: 30 });
          
        const snapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'screenings'));
        if (!snapshot.empty) {
            const chunkSize = 400;
            const totalDocs = snapshot.docs.length;
              
            for (let i = 0; i < totalDocs; i += chunkSize) {
                const batch = writeBatch(db);
                snapshot.docs.slice(i, i + chunkSize).forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                  
                setProcessingState(prev => ({ 
                    ...prev, 
                    progress: 30 + Math.floor(((i + chunkSize) / totalDocs) * 20),
                    message: `正在刪除舊資料 (${Math.min(i + chunkSize, totalDocs)}/${totalDocs})...`
                }));
            }
        }
          
        setProcessingState({ status: 'importing', message: `準備寫入 ${newRecords.length} 筆新資料...`, progress: 50 });
          
        const batchSize = 400; 
        const totalNew = newRecords.length;
          
        for (let i = 0; i < totalNew; i += batchSize) {
             const batch = writeBatch(db);
             const chunk = newRecords.slice(i, i + batchSize);
               
             chunk.forEach(record => {
                 const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'screenings'));
                 batch.set(newRef, record);
             });
               
             await batch.commit();
             setProcessingState(prev => ({ 
                 ...prev, 
                 progress: 50 + Math.floor(((i + chunk.length) / totalNew) * 50),
                 message: `正在寫入新資料 (${Math.min(i + batchSize, totalNew)}/${totalNew})...`
             }));
        }
          
        setProcessingState({ status: 'idle', message: '', progress: 100 });
        alert(`匯入成功！已還原 ${newRecords.length} 筆資料。`);
    } catch (e) {
        console.error("Import failed", e);
        alert("匯入失敗: " + (e as any).message);
    } finally {
        setProcessingState({ status: 'idle', message: '', progress: 0 });
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">載入數據中...</div>;

  return (
    <div className="pb-20">
      <input type="file" ref={importInputRef} accept=".zip" className="hidden" onChange={handleFileSelect} />
        
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2"><X className="w-6 h-6" /></button>
        </div>
      )}
        
      {importConfirm.show && (
         <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
             <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col max-w-sm w-full">
                 <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                     <FileWarning className="w-6 h-6 text-red-600" />
                 </div>
                 <h3 className="font-bold text-lg text-slate-800 mb-2">確認還原資料？</h3>
                 <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    您選擇了檔案：<br/>
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 rounded">{importConfirm.file?.name}</span>
                 </p>
                 <p className="text-red-500 text-sm font-bold mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
                    警告：此操作將「完全刪除」目前的雲端資料，並以備份檔的內容取代。此動作無法復原！
                 </p>
                 <div className="flex gap-3">
                     <button 
                        onClick={() => setImportConfirm({show: false, file: null})}
                        className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                     >
                        取消
                     </button>
                     <button 
                        onClick={executeImport}
                        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                     >
                        <Check className="w-4 h-4" /> 確定匯入
                     </button>
                 </div>
             </div>
         </div>
      )}
        
      {processingState.status !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full">
                 <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                 <h3 className="font-bold text-lg text-slate-800 mb-2">
                    {processingState.status === 'exporting' ? '匯出中' : '匯入中'}
                 </h3>
                 <p className="text-slate-500 text-sm text-center mb-4">{processingState.message}</p>
                   
                 {processingState.status === 'importing' && (
                    <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
                        <div 
                            className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300" 
                            style={{ width: `${processingState.progress}%` }}
                        ></div>
                    </div>
                 )}
                 {processingState.status === 'importing' && (
                     <span className="text-xs font-bold text-emerald-600">{processingState.progress}%</span>
                 )}
             </div>
        </div>
      )}
        
      <div className="bg-emerald-600 text-white p-6 rounded-b-3xl mb-6 shadow-lg relative min-h-[140px]">
        <h2 className="text-xl font-bold mb-1">公部門決策儀表板</h2>
        <p className="text-emerald-100 text-sm mb-4">環境部 / 衛生局 數據參考</p>
          
        <div className="flex gap-2 justify-end absolute right-4 bottom-4">
            <button 
                onClick={() => importInputRef.current?.click()}
                disabled={processingState.status !== 'idle'}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 backdrop-blur-sm transition-all border border-white/20 bg-emerald-800/40 hover:bg-emerald-800/60 text-white"
            >
                <FileUp className="w-4 h-4" /> 匯入 (ZIP)
            </button>
            <button 
                onClick={handleExportZip}
                disabled={processingState.status !== 'idle'}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 backdrop-blur-sm transition-all border border-white/20 bg-white/20 hover:bg-white/30 text-white"
            >
                <FileArchive className="w-4 h-4" /> 匯出 (ZIP)
            </button>
        </div>
      </div>
        
      <div className="px-4 mb-4">
         <FilterSortBar 
            filter={filter} 
            setFilter={setFilter} 
            sort={sort} 
            setSort={setSort} 
            onReset={() => {
                setFilter({ city: '', dateStart: '', dateEnd: '', address: '', recordId: '', personnel: '' });
                setSort({ field: 'recordId', direction: 'desc' });
            }}
         />
      </div>
        
      <div className="px-4 grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col items-center">
           <span className="text-3xl font-bold text-blue-600 mb-1">{stats.totalActualPicked}</span>
           <span className="text-xs text-slate-500 font-bold">總實際撿拾 (根)</span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col items-center">
           <span className="text-3xl font-bold text-emerald-600 mb-1">{stats.totalScreenedEst}</span>
           <span className="text-xs text-slate-500 font-bold">總快篩估計 (根)</span>
        </div>
          
        <div className="col-span-2 grid grid-cols-2 gap-4">
             <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                 <span className="text-xl font-bold text-slate-700">{stats.totalRecords}</span>
                 <span className="text-[10px] text-slate-400">總回報筆數</span>
             </div>
             <div className="bg-gradient-to-r from-orange-50 to-red-50 p-3 rounded-xl border border-orange-100 flex items-center justify-between px-4">
                 <div className="flex flex-col">
                     <span className="text-xl font-bold text-orange-600">{stats.totalHotspots}</span>
                     <span className="text-[10px] text-orange-800">熱點數 ({'>'}50根/m²)</span>
                 </div>
                 <AlertTriangle className="w-6 h-6 text-orange-300" />
             </div>
        </div>
      </div>
        
      <div className="px-4 mb-6">
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          各縣市實際撿拾量排名
        </h3>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           {Object.entries(stats.cityCount)
             .sort(([,a], [,b]) => b - a)
             .map(([city, count], idx) => (
               <div key={city} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                 <div className="flex items-center gap-3">
                   <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                     {idx + 1}
                   </span>
                   <span className="text-slate-700 font-medium">{city}</span>
                 </div>
                 <span className="font-mono text-emerald-600 font-bold">{count}</span>
               </div>
           ))}
           {Object.keys(stats.cityCount).length === 0 && <div className="p-4 text-center text-sm text-slate-400">尚無數據 (或被篩選過濾)</div>}
        </div>
      </div>
        
      <div className="px-4">
        <h3 className="font-bold text-slate-700 mb-3">近期回報紀錄</h3>
        <div className="space-y-3">
          {paginatedData.map(record => (
            <div key={record.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">{record.recordId}</span>
                <span className="text-xs text-slate-400">{record.date}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-800 truncate flex-1">{record.startAddress}</span>
              </div>
              <div className="flex justify-between items-center text-xs mt-2 border-t border-slate-50 pt-2 mb-2">
                 <span className="text-slate-500">撿拾: <b className="text-blue-600">{record.actualPickedCount}</b></span>
                 <span className="text-slate-500">快篩: <b className="text-emerald-600">{record.screenedCount}</b></span>
                 <span className="text-slate-500">菸盒: <b>{record.boxCount}</b></span>
              </div>
                
              {/* 如果資料包含軌跡路徑，則在此處顯示迷你小地圖預覽 */}
              {record.path && record.path.length > 0 && (
                <div className="mt-2 mb-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span className="font-bold flex items-center gap-1"><Navigation className="w-3 h-3" /> 軌跡紀錄</span>
                    <span>{record.distance?.toFixed(1) || 0} 公尺</span>
                  </div>
                  <PathPreview path={record.path} />
                </div>
              )}

              {record.images && record.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                  {record.images.map((imgSrc, imgIdx) => (
                    <button key={imgIdx} type="button" onClick={() => setSelectedImage(imgSrc)} className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden border border-slate-200">
                      <img src={imgSrc} alt="Evidence" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {paginatedData.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">查無符合篩選條件的資料</div>}
        </div>
          
        {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <span className="text-sm font-bold text-slate-600">
                    第 {currentPage} 頁 / 共 {totalPages} 頁
                </span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ArrowRight className="w-5 h-5 text-slate-600" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
}

// 4. Admin Panel
const AdminPanel = ({ user }: { user: User }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [password, setPassword] = useState('');
    const [data, setData] = useState<ScreeningData[]>([]);
    const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: string | null}>({show: false, id: null});
      
    const [filter, setFilter] = useState<FilterState>({ city: '', dateStart: '', dateEnd: '', address: '', recordId: '', personnel: '' });
    const [sort, setSort] = useState<SortState>({ field: 'recordId', direction: 'desc' });
      
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === '20120507') {
            setIsLoggedIn(true);
        } else {
            alert("密碼錯誤");
        }
    };

    useEffect(() => {
        if (!user || !isLoggedIn) return;
          
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'screenings'),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ScreeningData));
            setData(fetchedData);
        }, (error) => {
             console.error("Admin fetch error:", error);
        });
        return () => unsubscribe();
    }, [user, isLoggedIn]);

    const filteredSortedData = useMemo(() => {
        let res = [...data];
        if (filter.city) {
            res = res.filter(r => r.cityCode === filter.city);
        }
        if (filter.dateStart) {
            res = res.filter(r => r.date >= filter.dateStart);
        }
        if (filter.dateEnd) {
            res = res.filter(r => r.date <= filter.dateEnd);
        }
        if (filter.recordId) {
            const lower = filter.recordId.toLowerCase();
            res = res.filter(r => r.recordId.toLowerCase().includes(lower));
        }
        if (filter.address) {
            const lower = filter.address.toLowerCase();
            res = res.filter(r => 
                r.startAddress.includes(lower) || 
                (r.endAddress && r.endAddress.includes(lower))
            );
        }
        if (filter.personnel) {
            const lower = filter.personnel.toLowerCase();
            res = res.filter(r => 
                (r.recorderName && r.recorderName.toLowerCase().includes(lower)) ||
                (r.screenerName && r.screenerName.toLowerCase().includes(lower)) ||
                (r.photographerName && r.photographerName.toLowerCase().includes(lower))
            );
        }
          
        res.sort((a, b) => {
            let valA = a[sort.field];
            let valB = b[sort.field];
              
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if ((valA as any) < (valB as any)) return sort.direction === 'asc' ? -1 : 1;
            if ((valA as any) > (valB as any)) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return res;
    }, [data, filter, sort]);

    const handleDelete = (docId: string) => {
        setDeleteConfirm({ show: true, id: docId });
    };

    const executeDelete = async () => {
        if (!deleteConfirm.id) return;
          
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'screenings', deleteConfirm.id));
            setDeleteConfirm({ show: false, id: null });
        } catch (e) {
            alert("刪除失敗");
            console.error(e);
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">後台管理登入</h2>
                    <p className="text-sm text-slate-500 mb-6">提示：wifi Hank 網路密碼</p>
                      
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            placeholder="請輸入密碼"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        />
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
                            登入系統
                        </button>
                    </form>
                </div>
            </div>
        );
    }
      
    return (
        <div className="pb-20">
            {deleteConfirm.show && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col max-w-sm w-full">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <Trash2 className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-2">確認刪除？</h3>
                        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                            您確定要刪除這筆資料嗎？<br/>
                            此操作<span className="text-red-600 font-bold">無法復原</span>。
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirm({show: false, id: null})}
                                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={executeDelete}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> 確定刪除
                            </button>
                        </div>
                    </div>
                </div>
            )}
              
            <div className="bg-slate-800 text-white p-6 rounded-b-3xl mb-6 shadow-lg flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5" />
                        系統管理後台
                    </h2>
                    <p className="text-slate-400 text-sm">資料維護與管理</p>
                </div>
                <button
                    onClick={() => setIsLoggedIn(false)}
                    className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg text-xs flex items-center gap-1 transition-colors"
                >
                    <LogOut className="w-4 h-4" /> 登出
                </button>
            </div>
              
            <div className="px-4">
                <div className="mb-4">
                    <FilterSortBar 
                        filter={filter} 
                        setFilter={setFilter} 
                        sort={sort} 
                        setSort={setSort} 
                        onReset={() => {
                            setFilter({ city: '', dateStart: '', dateEnd: '', address: '', recordId: '', personnel: '' });
                            setSort({ field: 'recordId', direction: 'desc' });
                        }}
                    />
                </div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-700">資料列表 ({filteredSortedData.length})</h3>
                </div>
                  
                <div className="space-y-3">
                    {filteredSortedData.map(record => (
                        <div key={record.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                            <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                                <div>
                                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs mr-2">
                                        {record.recordId}
                                    </span>
                                    <span className="text-xs text-slate-500">{record.date}</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(record.id!)}
                                    className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                    title="刪除此筆資料"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                              
                            <div className="text-sm text-slate-700">
                                <span className="font-bold text-slate-500 text-xs mr-2">地點:</span>
                                {record.startAddress}
                            </div>
                            <div className="text-sm text-slate-700">
                                <span className="font-bold text-slate-500 text-xs mr-2">人員:</span>
                                {record.recorderName}
                            </div>

                            {/* 後台也同步顯示軌跡 */}
                            {record.path && record.path.length > 0 && (
                                <div className="mt-1 mb-1 bg-slate-50 p-2 rounded border border-slate-100">
                                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span className="font-bold flex items-center gap-1"><Navigation className="w-3 h-3" /> 軌跡距離</span>
                                    <span>{record.distance?.toFixed(1) || 0} 公尺</span>
                                  </div>
                                  <PathPreview path={record.path} />
                                </div>
                            )}
                              
                            <div className="grid grid-cols-4 gap-2 text-center text-xs bg-slate-50 p-2 rounded mt-1">
                                <div>
                                    <div className="text-slate-400 mb-1">實際</div>
                                    <div className="font-bold text-blue-600">{record.actualPickedCount}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 mb-1">快篩</div>
                                    <div className="font-bold text-emerald-600">{record.screenedCount}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 mb-1">熱點</div>
                                    <div className="font-bold text-orange-600">{record.hotspots?.length || 0}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 mb-1">照片</div>
                                    <div className="font-bold text-slate-600">{record.images?.length || 0}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                      
                    {filteredSortedData.length === 0 && (
                        <div className="text-center py-10 text-slate-400">目前沒有符合條件的資料</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 5. Main App Component
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard' | 'admin'>('form');
  const [imageError, setImageError] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
        await signInAnonymously(auth);
    };
    initAuth();
      
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  if (!hasStarted) {
    return <LoginScreen onLogin={() => setHasStarted(true)} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
           <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
           <p className="text-slate-500 text-sm">系統載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 font-sans text-slate-900 relative shadow-2xl">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm ${imageError ? 'bg-emerald-600' : 'bg-white'}`}>
             {!imageError ? (
               <img 
                 src={LOGO_URL} 
                 alt="Logo" 
                 className="w-full h-full object-contain" 
                 onError={() => setImageError(true)} 
               />
             ) : (
               <ClipboardList className="w-5 h-5 text-white" />
             )}
          </div>
          <h1 className="font-bold text-slate-800">菸蒂快篩</h1>
        </div>
          
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('form')} className={`px-2 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'form' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-50'}`}>快篩填報</button>
          <button onClick={() => setActiveTab('dashboard')} className={`px-2 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-50'}`}>數據中心</button>
          <button onClick={() => setActiveTab('admin')} className={`px-2 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'admin' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-50'}`}>後台管理</button>
        </div>
      </div>
      <div className="p-4">
        {activeTab === 'form' && <ScreeningForm user={user} onSubmitSuccess={() => setActiveTab('dashboard')} />}
        {activeTab === 'dashboard' && <Dashboard user={user} />}
        {activeTab === 'admin' && <AdminPanel user={user} />}
      </div>
    </div>
  );
}
