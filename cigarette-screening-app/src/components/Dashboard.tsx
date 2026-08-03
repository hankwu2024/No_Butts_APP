import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapPin, BarChart3, FileArchive, FileUp, Loader2, X, FileWarning, Check, ArrowLeft, ArrowRight, Navigation, AlertTriangle } from 'lucide-react';
import JSZip from 'jszip';
import { pb } from '../config/pocketbase';
import { CITY_CODES } from '../constants';
import type { ScreeningData, FilterState, SortState } from '../types';
import { parseCSV } from '../utils/helpers';
import FilterSortBar from './FilterSortBar';
import PathPreview from './PathPreview';

interface DashboardProps {
  userId: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userId }) => {
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
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        const records = await pb.collection('screenings').getFullList<ScreeningData>({ sort: '-created' });
        setData(records);
        setLoading(false);

        unsubscribe = await pb.collection('screenings').subscribe<ScreeningData>('*', (e) => {
          setData(prev => {
            if (e.action === 'create') return [e.record, ...prev];
            if (e.action === 'delete') return prev.filter(r => r.id !== e.record.id);
            if (e.action === 'update') return prev.map(r => r.id === e.record.id ? e.record : r);
            return prev;
          });
        });
      } catch (err) {
        console.error("PocketBase connection error:", err);
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const filteredSortedData = useMemo(() => {
    let res = [...data];
    if (filter.city) res = res.filter(r => r.cityCode === filter.city);
    if (filter.dateStart) res = res.filter(r => r.date >= filter.dateStart);
    if (filter.dateEnd) res = res.filter(r => r.date <= filter.dateEnd);
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
        let imageCellContent = "";

        if (item.images && item.images.length > 0) {
          item.images.forEach((imgData, imgIdx) => {
            if (imgData.startsWith('data:image')) {
              const base64Data = imgData.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
              const filename = `${item.recordId}_${imgIdx + 1}.jpg`;
              imgFolder?.file(filename, base64Data, {base64: true});
              localImages.push(filename);
            }
          });

          if (localImages.length > 0) {
            const firstImage = localImages[0];
            const displayLabel = localImages.join('; ');
            imageCellContent = `=HYPERLINK("images/${firstImage}", "${displayLabel}")`;
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

      const csvContent = "﻿" + [headers.join(","), ...rows].join("\n");
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
      if (rows.length < 2) throw new Error("CSV 檔案內容為空或格式錯誤");

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
        const method = methodStr === '單車' ? 'bike' : methodStr === '機動車' ? 'motor' : 'walk';
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
        }

        newRecords.push({
          recordId: cols[0],
          date: cols[1],
          cityCode,
          recorderName: cols[3],
          screenerName: cols[4],
          photographerName: "",
          startAddress: cols[5],
          endAddress: cols[6],
          direction: direction as 'left' | 'right',
          screenedCount: parseInt(cols[8]) || 0,
          actualPickedCount: parseInt(cols[9]) || 0,
          boxCount: parseInt(cols[10]) || 0,
          drainCount: parseInt(cols[11]) || 0,
          hotspots: [],
          photoCount: images.length,
          images,
          note: cols[14],
          method: method as any,
          roadType: roadType as any,
          userId,
        });

        setProcessingState(prev => ({
          ...prev,
          progress: 10 + Math.floor((i / totalRows) * 20),
          message: `正在解析第 ${i + 1}/${totalRows} 筆資料...`
        }));
      }

      setProcessingState({ status: 'importing', message: '正在清除舊資料...', progress: 30 });

      const existing = await pb.collection('screenings').getFullList({ fields: 'id' });
      const totalExisting = existing.length;
      for (let i = 0; i < totalExisting; i += 10) {
        await Promise.all(existing.slice(i, i + 10).map(r => pb.collection('screenings').delete(r.id)));
        setProcessingState(prev => ({
          ...prev,
          progress: 30 + Math.floor(((i + 10) / totalExisting) * 20),
          message: `正在刪除舊資料 (${Math.min(i + 10, totalExisting)}/${totalExisting})...`
        }));
      }

      setProcessingState({ status: 'importing', message: `準備寫入 ${newRecords.length} 筆新資料...`, progress: 50 });

      const totalNew = newRecords.length;
      for (let i = 0; i < totalNew; i += 10) {
        await Promise.all(newRecords.slice(i, i + 10).map(r => pb.collection('screenings').create(r)));
        setProcessingState(prev => ({
          ...prev,
          progress: 50 + Math.floor(((i + 10) / totalNew) * 50),
          message: `正在寫入新資料 (${Math.min(i + 10, totalNew)}/${totalNew})...`
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
                     <button onClick={() => setImportConfirm({show: false, file: null})} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors">取消</button>
                     <button onClick={executeImport} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
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
                        <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${processingState.progress}%` }}></div>
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
            <button onClick={() => importInputRef.current?.click()} disabled={processingState.status !== 'idle'} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 backdrop-blur-sm transition-all border border-white/20 bg-emerald-800/40 hover:bg-emerald-800/60 text-white">
                <FileUp className="w-4 h-4" /> 匯入 (ZIP)
            </button>
            <button onClick={handleExportZip} disabled={processingState.status !== 'idle'} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 backdrop-blur-sm transition-all border border-white/20 bg-white/20 hover:bg-white/30 text-white">
                <FileArchive className="w-4 h-4" /> 匯出 (ZIP)
            </button>
        </div>
      </div>

      <div className="px-4 mb-4">
         <FilterSortBar filter={filter} setFilter={setFilter} sort={sort} setSort={setSort}
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
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <span className="text-sm font-bold text-slate-600">第 {currentPage} 頁 / 共 {totalPages} 頁</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <ArrowRight className="w-5 h-5 text-slate-600" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
