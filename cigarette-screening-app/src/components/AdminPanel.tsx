import { useState, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Lock, LogOut, ShieldCheck, Trash2, Navigation } from 'lucide-react';
import { db } from '../config/firebase';
import { APP_ID } from '../constants';
import type { ScreeningData, FilterState, SortState } from '../types';
import FilterSortBar from './FilterSortBar';
import PathPreview from './PathPreview';

interface AdminPanelProps {
  user: User;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ user }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [data, setData] = useState<ScreeningData[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({ show: false, id: null });

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
    const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'screenings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScreeningData));
      setData(fetchedData);
    }, (error) => {
      console.error("Admin fetch error:", error);
    });
    return () => unsubscribe();
  }, [user, isLoggedIn]);

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
      res = res.filter(r => r.startAddress.includes(lower) || (r.endAddress && r.endAddress.includes(lower)));
    }
    if (filter.personnel) {
      const lower = filter.personnel.toLowerCase();
      res = res.filter(r => (r.recorderName && r.recorderName.toLowerCase().includes(lower)) || (r.screenerName && r.screenerName.toLowerCase().includes(lower)) || (r.photographerName && r.photographerName.toLowerCase().includes(lower)));
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

  const handleDelete = (docId: string) => setDeleteConfirm({ show: true, id: docId });

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'screenings', deleteConfirm.id));
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
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-blue-600" /></div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">後台管理登入</h2>
          <p className="text-sm text-slate-500 mb-6">提示：wifi Hank 網路密碼</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" placeholder="請輸入密碼" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500" />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">登入系統</button>
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
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
            <h3 className="font-bold text-lg text-slate-800 mb-2">確認刪除？</h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">您確定要刪除這筆資料嗎？<br />此操作<span className="text-red-600 font-bold">無法復原</span>。</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm({ show: false, id: null })} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors">取消</button>
              <button type="button" onClick={executeDelete} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> 確定刪除</button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-slate-800 text-white p-6 rounded-b-3xl mb-6 shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><ShieldCheck className="w-5 h-5" />系統管理後台</h2>
          <p className="text-slate-400 text-sm">資料維護與管理</p>
        </div>
        <button type="button" onClick={() => setIsLoggedIn(false)} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg text-xs flex items-center gap-1 transition-colors"><LogOut className="w-4 h-4" /> 登出</button>
      </div>
      <div className="px-4">
        <div className="mb-4"><FilterSortBar filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onReset={() => { setFilter({ city: '', dateStart: '', dateEnd: '', address: '', recordId: '', personnel: '' }); setSort({ field: 'recordId', direction: 'desc' }); }} /></div>
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700">資料列表 ({filteredSortedData.length})</h3></div>
        <div className="space-y-3">
          {filteredSortedData.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                <div><span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs mr-2">{record.recordId}</span><span className="text-xs text-slate-500">{record.date}</span></div>
                <button type="button" onClick={() => handleDelete(record.id!)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="刪除此筆資料"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="text-sm text-slate-700"><span className="font-bold text-slate-500 text-xs mr-2">地點:</span>{record.startAddress}</div>
              <div className="text-sm text-slate-700"><span className="font-bold text-slate-500 text-xs mr-2">人員:</span>{record.recorderName}</div>
              {record.path && record.path.length > 0 && (
                <div className="mt-1 mb-1 bg-slate-50 p-2 rounded border border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500 mb-1"><span className="font-bold flex items-center gap-1"><Navigation className="w-3 h-3" /> 軌跡距離</span><span>{record.distance?.toFixed(1) || 0} 公尺</span></div>
                  <PathPreview path={record.path} />
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 text-center text-xs bg-slate-50 p-2 rounded mt-1">
                <div><div className="text-slate-400 mb-1">實際</div><div className="font-bold text-blue-600">{record.actualPickedCount}</div></div>
                <div><div className="text-slate-400 mb-1">快篩</div><div className="font-bold text-emerald-600">{record.screenedCount}</div></div>
                <div><div className="text-slate-400 mb-1">菸盒</div><div className="font-bold text-slate-700">{record.boxCount}</div></div>
                <div><div className="text-slate-400 mb-1">水溝</div><div className="font-bold text-slate-700">{record.drainCount}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
