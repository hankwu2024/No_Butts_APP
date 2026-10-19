import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PathPoint {
  lat: number;
  lng: number;
}

interface PathPreviewProps {
  path: PathPoint[];
}

const PathPreview: React.FC<PathPreviewProps> = ({ path }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // 列表可能很長，等卡片捲進畫面才建立地圖
  useEffect(() => {
    const el = containerRef.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    const el = containerRef.current;
    if (!visible || !el || !path || path.length === 0) return;

    // 預覽用的小地圖：不攔截捲動與拖曳，避免手機上滑不動列表
    const map = L.map(el, {
      preferCanvas: true,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      className: 'muted-tiles',
      maxZoom: 19,
    }).addTo(map);

    const latlngs = path.map(p => [p.lat, p.lng] as [number, number]);
    const start = latlngs[0];
    const end = latlngs[latlngs.length - 1];

    if (latlngs.length > 1) {
      L.polyline(latlngs, { color: '#059669', weight: 4, opacity: 0.9 }).addTo(map);
      map.fitBounds(L.latLngBounds(latlngs), { padding: [16, 16], maxZoom: 17 });
    } else {
      map.setView(start, 16);
    }

    // 綠色起點、紅色終點
    L.circleMarker(start, { radius: 6, color: '#ffffff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(map);
    if (latlngs.length > 1) {
      L.circleMarker(end, { radius: 6, color: '#ffffff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(map);
    }

    return () => {
      map.remove();
    };
  }, [visible, path]);

  return (
    <div
      ref={containerRef}
      className="w-full h-36 bg-white border border-slate-200 rounded-lg shadow-inner mt-1 overflow-hidden relative z-0 isolate"
    />
  );
};

export default PathPreview;
