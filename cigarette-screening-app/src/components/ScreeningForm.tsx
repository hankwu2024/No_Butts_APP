import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList,
  MapPin,
  Footprints,
  Bike,
  Car,
  ArrowRight,
  ArrowLeft,
  Square,
  Play,
  Trash2,
  Camera,
  Image as ImageIcon,
  X,
  AlertTriangle,
  Minus,
  Plus,
  Loader2,
  Save
} from 'lucide-react';
import { pb } from '../config/pocketbase';
import { CITY_CODES } from '../constants';
import type { Hotspot } from '../types';
import { resizeImage, calcDistance } from '../utils/helpers';
import CounterInput from './CounterInput';
import SelectionCard from './SelectionCard';

interface ScreeningFormProps {
  userId: string;
  onSubmitSuccess: () => void;
}

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

const ScreeningForm: React.FC<ScreeningFormProps> = ({ userId, onSubmitSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("上傳中...");
  const [gpsLoading] = useState(false);
  const [modal, setModal] = useState<{show: boolean, title: string, content: string}>({
    show: false, title: '', content: ''
  });

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

  useEffect(() => {
    let dist = 0;
    for (let i = 1; i < path.length; i++) {
      dist += calcDistance(path[i-1].lat, path[i-1].lng, path[i].lat, path[i].lng);
    }
    setDistance(dist);

    if (path.length > 0) {
      setFormData(prev => ({
        ...prev,
        startAddress: `${path[0].lat.toFixed(6)}, ${path[0].lng.toFixed(6)}`,
        endAddress: `${path[path.length - 1].lat.toFixed(6)}, ${path[path.length - 1].lng.toFixed(6)}`
      }));
    } else {
      setFormData(prev => ({ ...prev, startAddress: '', endAddress: '' }));
    }

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

          path.forEach((p, i) => {
            const x = getX(p.lng);
            const y = getY(p.lat);
            ctx.beginPath();
            if (i === 0) {
              ctx.fillStyle = '#22c55e';
              ctx.arc(x, y, 6, 0, Math.PI * 2);
            } else if (i === path.length - 1 && !isTracking) {
              ctx.fillStyle = '#ef4444';
              ctx.arc(x, y, 6, 0, Math.PI * 2);
            } else {
              ctx.fillStyle = '#3b82f6';
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
      setIsTracking(false);
      if (trackingRef.current) {
        clearInterval(trackingRef.current);
        trackingRef.current = null;
      }
    } else {
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

      fetchLocation();
      trackingRef.current = window.setInterval(fetchLocation, 10000) as unknown as number;
    }
  };

  const generateRecordId = async () => {
    try {
      const dateStr = formData.date.replace(/-/g, '');
      const prefix = `${formData.cityCode}${dateStr}`;

      const result = await pb.collection('screenings').getList(1, 1, {
        filter: `cityCode = "${formData.cityCode}" && date = "${formData.date}"`
      });
      const count = result.totalItems + 1;
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

    const missingFields: string[] = [];
    if (!formData.recorderName) missingFields.push("紀錄人員");
    if (!formData.startAddress) missingFields.push("起點地址");
    if (!formData.endAddress) missingFields.push("終點地址");
    if (!formData.method) missingFields.push("移動方式");
    if (!formData.roadType) missingFields.push("路段型態");

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

      setLoadingText("儲存紀錄中...");

      const payload = {
        ...formData,
        screenedCount: Math.max(0, formData.screenedCount),
        actualPickedCount: Math.max(0, formData.actualPickedCount),
        boxCount: Math.max(0, formData.boxCount),
        drainCount: Math.max(0, formData.drainCount),
        hotspots: hotspots.filter(h => h.address).map(h => ({...h, count: Math.max(0, h.count)})),
        method: formData.method as 'walk' | 'bike' | 'motor',
        roadType: formData.roadType as 'complex' | 'normal' | 'road_only',
        recordId,
        userId,
        photoCount: previewImages.length,
        images: previewImages,
        path,
        distance,
      };

      await pb.collection('screenings').create(payload);

      setModal({
        show: true,
        title: "上傳成功",
        content: `案件編號：${recordId}\n(照片已記錄數量: ${previewImages.length} 張)`
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

export default ScreeningForm;
