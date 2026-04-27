import { useState, useEffect } from 'react';
import { ClipboardList, MapPin, ShieldCheck, Loader2 } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './config/firebase';
import LoginScreen from './components/LoginScreen';
import ScreeningForm from './components/ScreeningForm';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import './App.css';

type View = 'entry' | 'dashboard' | 'admin';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('entry');
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signInAnonymously(auth).catch(err => console.error("Auth error", err));
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-emerald-50">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="mt-4 text-emerald-800 font-bold">系統啟動中...</p>
      </div>
    );
  }

  if (!isAppReady) {
    return <LoginScreen onLogin={() => setIsAppReady(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24">
      <main className="max-w-md mx-auto min-h-screen bg-white shadow-xl relative">
        {/* Header */}
        {view === 'entry' && (
          <header className="bg-emerald-600 text-white p-6 rounded-b-3xl mb-6 shadow-lg">
            <h1 className="text-2xl font-bold">菸蒂快篩填報</h1>
            <p className="text-emerald-100 text-sm mt-1">公民科學家現場紀錄</p>
          </header>
        )}

        <div className="px-4">
          {view === 'entry' && user && (
            <ScreeningForm user={user} onSubmitSuccess={() => setView('dashboard')} />
          )}
          {view === 'dashboard' && user && (
            <Dashboard user={user} />
          )}
          {view === 'admin' && user && (
            <AdminPanel user={user} />
          )}
        </div>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-around py-3 px-6 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setView('entry')}
            className={`flex flex-col items-center gap-1 transition-colors ${view === 'entry' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ClipboardList className={`w-6 h-6 ${view === 'entry' ? 'fill-emerald-50' : ''}`} />
            <span className="text-[10px] font-bold">填報</span>
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors ${view === 'dashboard' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <MapPin className={`w-6 h-6 ${view === 'dashboard' ? 'fill-blue-50' : ''}`} />
            <span className="text-[10px] font-bold">儀表板</span>
          </button>
          <button
            onClick={() => setView('admin')}
            className={`flex flex-col items-center gap-1 transition-colors ${view === 'admin' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ShieldCheck className={`w-6 h-6 ${view === 'admin' ? 'fill-slate-100' : ''}`} />
            <span className="text-[10px] font-bold">後台</span>
          </button>
        </nav>
      </main>
    </div>
  );
}

export default App;
