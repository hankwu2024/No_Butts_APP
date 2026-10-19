import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, BarChart3, AlertTriangle, Building2 } from 'lucide-react';
import { pb } from '../config/pocketbase';
import { CITY_CODES } from '../constants';
import type { ScreeningData, FilterState, SortState } from '../types';
import FilterSortBar from './FilterSortBar';
import RouteMap from './RouteMap';
import Tower101Progress from './Tower101Progress';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<ScreeningData[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<FilterState>({ city: '', dateStart: '', dateEnd: '', address: '', recordId: '', personnel: '' });
  const [sort, setSort] = useState<SortState>({ field: 'recordId', direction: 'desc' });

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

  // 101 進度看的是全部資料，篩選時大樓不會「掉下去」
  const grandTotalPicked = useMemo(
    () => data.reduce((sum, item) => sum + (item.actualPickedCount || 0), 0),
    [data]
  );

  if (loading) return <div className="p-8 text-center text-slate-500">載入數據中...</div>;

  return (
    <div className="pb-20">
      <div className="bg-emerald-600 text-white p-6 rounded-b-3xl mb-6 shadow-lg">
        <h2 className="text-xl font-bold mb-1">公部門決策儀表板</h2>
        <p className="text-emerald-100 text-sm">環境部 / 衛生局 數據參考</p>
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

      <div className="px-4 mb-6 space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-600" />
          路線分佈地圖
        </h3>
        <RouteMap title="快篩估計數量" data={filteredSortedData} valueField="screenedCount" />
        <RouteMap title="實際撿拾數量" data={filteredSortedData} valueField="actualPickedCount" />
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
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-600" />
          菸蒂疊疊樂
        </h3>
        <Tower101Progress total={grandTotalPicked} />
      </div>
    </div>
  );
};

export default Dashboard;
