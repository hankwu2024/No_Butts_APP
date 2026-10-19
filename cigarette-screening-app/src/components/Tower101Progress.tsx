import React, { useEffect, useId, useRef, useState } from 'react';

interface Tower101ProgressProps {
  total: number;
}

const TOWER_HEIGHT_CM = 50800; // 台北 101 屋頂高度 508 公尺
const BUTT_LENGTH_CM = 3; // 一根菸蒂直立的高度
const BUTTS_PER_TOWER = Math.round(TOWER_HEIGHT_CM / BUTT_LENGTH_CM);
const ANIMATION_MS = 1800;

// viewBox 0 0 100 300 的 101 剪影：塔尖、頂部、八節斗狀量體、基座
const SEGMENTS = Array.from({ length: 8 }, (_, i) => 75 + i * 20);

const TowerShape: React.FC = () => (
  <>
    <rect x="49" y="0" width="2" height="42" />
    <rect x="45" y="40" width="10" height="16" />
    <rect x="43" y="55" width="14" height="21" />
    {SEGMENTS.map(y => (
      <polygon key={y} points={`33,${y} 67,${y} 62,${y + 20.5} 38,${y + 20.5}`} />
    ))}
    <polygon points="38,235 62,235 70,282 30,282" />
    <rect x="16" y="281" width="68" height="19" rx="1" />
  </>
);

const Tower101Progress: React.FC<Tower101ProgressProps> = ({ total }) => {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const clipId = useId();

  // 數字與填色從目前的值往上衝到最新總數
  useEffect(() => {
    let frame = 0;
    const from = shownRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / ANIMATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      shownRef.current = Math.round(from + (total - from) * eased);
      setShown(shownRef.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total]);

  const completed = Math.floor(shown / BUTTS_PER_TOWER);
  const ratio = (shown % BUTTS_PER_TOWER) / BUTTS_PER_TOWER;
  const fillHeight = 300 * ratio;
  const heightMeters = (shown * BUTT_LENGTH_CM) / 100;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex gap-4 items-end">
      <svg viewBox="0 0 100 300" className="w-20 h-60 shrink-0" role="img" aria-label={`台北 101 已填滿 ${(ratio * 100).toFixed(1)}%`}>
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y={300 - fillHeight} width="100" height={fillHeight} />
          </clipPath>
        </defs>
        <g className="fill-slate-200">
          <TowerShape />
        </g>
        <g className="fill-emerald-500" clipPath={`url(#${clipId})`}>
          <TowerShape />
        </g>
      </svg>

      <div className="flex-1 min-w-0 pb-1">
        <p className="text-xs text-slate-500 font-bold mb-1">菸蒂直立疊起來有多高？</p>
        <p className="text-3xl font-bold text-emerald-600 leading-tight tabular-nums">
          {shown.toLocaleString()}
          <span className="text-sm text-slate-500 font-medium ml-1">根</span>
        </p>
        <p className="text-sm text-slate-600 mb-3 tabular-nums">
          約 {heightMeters.toLocaleString(undefined, { maximumFractionDigits: 0 })} 公尺高
        </p>

        {completed > 0 && (
          <p className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-md px-2 py-1 mb-2 inline-block">
            已疊滿 {completed} 棟 101！正在疊第 {completed + 1} 棟
          </p>
        )}

        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className="text-xs text-slate-500 tabular-nums">
          {completed > 0 ? `第 ${completed + 1} 棟` : '台北 101'} 完成 <b className="text-emerald-600">{(ratio * 100).toFixed(1)}%</b>
        </p>
        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
          以每根菸蒂 {BUTT_LENGTH_CM} 公分直立堆疊計算，疊滿一棟 101（508 公尺）需 {BUTTS_PER_TOWER.toLocaleString()} 根。統計全部實際撿拾數量，不受篩選影響。
        </p>
      </div>
    </div>
  );
};

export default Tower101Progress;
