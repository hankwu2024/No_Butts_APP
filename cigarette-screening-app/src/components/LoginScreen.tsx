import React, { useState } from 'react';
import { MapPin, ClipboardList, Loader2, Navigation } from 'lucide-react';
import { LOGO_URL } from '../constants';

interface LoginScreenProps {
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
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
                type="button"
                onClick={handleStart}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
              >
                再試一次
              </button>
              <button
                type="button"
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
        type="button"
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

export default LoginScreen;
