import React, { useState } from 'react';
import { Filter, ArrowUpDown, FileText, MapPin, Users, SortAsc, SortDesc } from 'lucide-react';
import { CITY_CODES } from '../constants';
import type { FilterState, SortState, SortField } from '../types';

interface FilterSortBarProps {
  filter: FilterState;
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
  sort: SortState;
  setSort: React.Dispatch<React.SetStateAction<SortState>>;
  onReset: () => void;
}

const FilterSortBar: React.FC<FilterSortBarProps> = ({
  filter,
  setFilter,
  sort,
  setSort,
  onReset
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-700 font-bold">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>篩選與排序條件</span>
        </div>
        <ArrowUpDown
          className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
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
                  onChange={(e) => setFilter((prev) => ({ ...prev, recordId: e.target.value }))}
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
                  onChange={(e) => setFilter((prev) => ({ ...prev, address: e.target.value }))}
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
                  onChange={(e) => setFilter((prev) => ({ ...prev, personnel: e.target.value }))}
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
                onChange={(e) => setFilter((prev) => ({ ...prev, city: e.target.value }))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
              >
                <option value="">全部縣市</option>
                {CITY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">日期範圍</label>
              <div className="flex gap-1 items-center">
                <input
                  type="date"
                  value={filter.dateStart}
                  onChange={(e) => setFilter((prev) => ({ ...prev, dateStart: e.target.value }))}
                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={filter.dateEnd}
                  onChange={(e) => setFilter((prev) => ({ ...prev, dateEnd: e.target.value }))}
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
                onChange={(e) => setSort((prev) => ({ ...prev, field: e.target.value as SortField }))}
                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
              >
                <option value="recordId">案件編號</option>
                <option value="date">日期</option>
                <option value="actualPickedCount">撿拾數量</option>
                <option value="screenedCount">快篩數量</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  setSort((prev) => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))
                }
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors flex items-center justify-center w-10 shrink-0"
              >
                {sort.direction === 'asc' ? (
                  <SortAsc className="w-5 h-5 text-slate-600" />
                ) : (
                  <SortDesc className="w-5 h-5 text-slate-600" />
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
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

export default FilterSortBar;
