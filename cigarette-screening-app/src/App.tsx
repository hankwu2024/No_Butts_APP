import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { getUserId } from './config/pocketbase';
import { LOGO_URL } from './constants';
import LoginScreen from './components/LoginScreen';
import ScreeningForm from './components/ScreeningForm';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard' | 'admin'>('form');
  const [imageError, setImageError] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const userId = getUserId();

  if (!hasStarted) {
    return <LoginScreen onLogin={() => setHasStarted(true)} />;
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
          <div>
            <h1 className="font-bold text-slate-800">菸蒂快篩</h1>
            <a href="../index.html" className="text-[10px] text-slate-400 hover:text-emerald-600">← 回個人網站</a>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('form')} className={`px-2 py-1.5 text-xs font-bold rounded-md transition-all text-emerald-600 ${activeTab === 'form' ? 'bg-white shadow-sm' : ''}`}>快篩填報</button>
          <button onClick={() => setActiveTab('dashboard')} className={`px-2 py-1.5 text-xs font-bold rounded-md transition-all text-emerald-600 ${activeTab === 'dashboard' ? 'bg-white shadow-sm' : ''}`}>數據中心</button>
          <button onClick={() => setActiveTab('admin')} className={`px-2 py-1.5 text-xs font-bold rounded-md transition-all text-emerald-600 ${activeTab === 'admin' ? 'bg-slate-700 shadow-sm' : ''}`}>後台管理</button>
        </div>
      </div>
      <div className="p-4">
        {activeTab === 'form' && <ScreeningForm userId={userId} onSubmitSuccess={() => setActiveTab('dashboard')} />}
        {activeTab === 'dashboard' && <Dashboard userId={userId} />}
        {activeTab === 'admin' && <AdminPanel userId={userId} />}
      </div>
    </div>
  );
}
