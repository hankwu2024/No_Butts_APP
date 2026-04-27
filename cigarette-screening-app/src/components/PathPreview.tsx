import React, { useEffect, useRef } from 'react';

interface PathPoint {
  lat: number;
  lng: number;
}

interface PathPreviewProps {
  path: PathPoint[];
}

const PathPreview: React.FC<PathPreviewProps> = ({ path }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !path || path.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (path.length === 1) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (path.length > 1) {
      const lats = path.map((p) => p.lat);
      const lngs = path.map((p) => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const latDiff = maxLat - minLat || 0.0001;
      const lngDiff = maxLng - minLng || 0.0001;

      const padding = 15;
      const usableWidth = canvas.width - padding * 2;
      const usableHeight = canvas.height - padding * 2;

      const getX = (lng: number) => padding + ((lng - minLng) / lngDiff) * usableWidth;
      const getY = (lat: number) =>
        canvas.height - (padding + ((lat - minLat) / latDiff) * usableHeight);

      // 畫連線
      ctx.beginPath();
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      path.forEach((p, i) => {
        const x = getX(p.lng);
        const y = getY(p.lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 畫起點與終點
      const startX = getX(path[0].lng);
      const startY = getY(path[0].lat);
      ctx.fillStyle = '#22c55e'; // 綠色起點
      ctx.beginPath();
      ctx.arc(startX, startY, 5, 0, Math.PI * 2);
      ctx.fill();

      const endX = getX(path[path.length - 1].lng);
      const endY = getY(path[path.length - 1].lat);
      ctx.fillStyle = '#ef4444'; // 紅色終點
      ctx.beginPath();
      ctx.arc(endX, endY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [path]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={150}
      className="w-full h-24 bg-white border border-slate-200 rounded-lg shadow-inner object-contain mt-1"
    />
  );
};

export default PathPreview;
