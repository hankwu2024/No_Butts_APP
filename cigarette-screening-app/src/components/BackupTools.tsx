import React, { useRef, useState } from 'react';
import { FileArchive, FileUp, Loader2, FileWarning, Check } from 'lucide-react';
import JSZip from 'jszip';
import { pb } from '../config/pocketbase';
import { CITY_CODES } from '../constants';
import type { ScreeningData } from '../types';
import { parseCSV } from '../utils/helpers';

interface BackupToolsProps {
  records: ScreeningData[];
  userId: string;
}

const BackupTools: React.FC<BackupToolsProps> = ({ records, userId }) => {
  const [processingState, setProcessingState] = useState<{ status: 'idle' | 'exporting' | 'importing', message: string, progress: number }>({ status: 'idle', message: '', progress: 0 });
  const [importConfirm, setImportConfirm] = useState<{show: boolean, file: File | null}>({show: false, file: null});
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExportZip = async () => {
    if (records.length === 0) {
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

      const rows = await Promise.all(records.map(async (item) => {
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

  return (
    <>
      <input type="file" ref={importInputRef} accept=".zip" className="hidden" onChange={handleFileSelect} />

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

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-700">資料備份</h3>
            <p className="text-[10px] text-slate-400">匯出目前篩選結果；匯入會覆蓋全部資料</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => importInputRef.current?.click()} disabled={processingState.status !== 'idle'} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-red-200 text-red-600 bg-red-50 hover:bg-red-100">
                <FileUp className="w-4 h-4" /> 匯入 (ZIP)
            </button>
            <button onClick={handleExportZip} disabled={processingState.status !== 'idle'} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors bg-slate-800 hover:bg-slate-700 text-white">
                <FileArchive className="w-4 h-4" /> 匯出 (ZIP)
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BackupTools;
