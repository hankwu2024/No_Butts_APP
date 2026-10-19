import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import type { ScreeningData } from '../types';
import { getSeverityColor, SEVERITY_LEGEND_STOPS } from '../utils/colorScale';

interface RouteMapProps {
  title: string;
  data: ScreeningData[];
  valueField: 'screenedCount' | 'actualPickedCount';
  unit?: string;
}

const AGGREGATE_ZOOM_THRESHOLD = 14;
const CLUSTER_CELL_PX = 64;

const RouteMap: React.FC<RouteMapProps> = ({ title, data, valueField, unit = '根' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const routesRef = useRef<ScreeningData[]>([]);
  const valueFieldRef = useRef(valueField);
  const unitRef = useRef(unit);
  const renderRef = useRef<() => void>(() => {});

  const routes = useMemo(() => data.filter(d => d.path && d.path.length > 1), [data]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // canvas renderer keeps zooming smooth; the grey basemap keeps the severity colors readable
    const map = L.map(containerRef.current, { preferCanvas: true }).setView([23.6978, 120.9605], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      className: 'muted-tiles',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const doRender = () => {
      const currentMap = mapRef.current;
      const currentLayer = layerRef.current;
      if (!currentMap || !currentLayer) return;
      currentLayer.clearLayers();

      const currentRoutes = routesRef.current;
      const field = valueFieldRef.current;
      const currentUnit = unitRef.current;
      if (currentRoutes.length === 0) return;

      const zoom = currentMap.getZoom();

      if (zoom >= AGGREGATE_ZOOM_THRESHOLD) {
        currentRoutes.forEach(r => {
          const latlngs = r.path!.map(p => [p.lat, p.lng] as [number, number]);
          const value = r[field] || 0;
          L.polyline(latlngs, { color: getSeverityColor(value), weight: 5, opacity: 0.85 })
            .bindTooltip(`${r.recordId}：${value} ${currentUnit}`)
            .addTo(currentLayer);
        });
      } else {
        // cluster routes within roughly CLUSTER_CELL_PX screen pixels of each other
        const cellSizeDeg = (CLUSTER_CELL_PX * 360) / (256 * Math.pow(2, zoom));
        const cells = new Map<string, { count: number; sum: number; lat: number; lng: number }>();

        currentRoutes.forEach(r => {
          const pts = r.path!;
          const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
          const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
          const key = `${Math.floor(lat / cellSizeDeg)}_${Math.floor(lng / cellSizeDeg)}`;

          if (!cells.has(key)) cells.set(key, { count: 0, sum: 0, lat: 0, lng: 0 });
          const cell = cells.get(key)!;
          cell.count += 1;
          cell.sum += r[field] || 0;
          cell.lat += lat;
          cell.lng += lng;
        });

        // one circle per cell, placed at the centre of its routes and sized by route count
        cells.forEach(cell => {
          const avg = cell.sum / cell.count;
          const color = getSeverityColor(avg);
          L.circleMarker([cell.lat / cell.count, cell.lng / cell.count], {
            radius: Math.min(10 + Math.sqrt(cell.count) * 5, 28),
            color: '#ffffff',
            weight: 2,
            fillColor: color,
            fillOpacity: 0.85,
          })
            .bindTooltip(`區域平均：${avg.toFixed(0)} ${currentUnit}（${cell.count} 筆路線）`)
            .addTo(currentLayer);
        });
      }
    };

    renderRef.current = doRender;
    map.on('zoomend', doRender);
    doRender();

    return () => {
      map.off('zoomend', doRender);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const fittedRef = useRef(false);

  useEffect(() => {
    routesRef.current = routes;
    valueFieldRef.current = valueField;
    unitRef.current = unit;

    if (!fittedRef.current && routes.length > 0 && mapRef.current) {
      const allPoints = routes.flatMap(r => r.path!.map(p => [p.lat, p.lng] as [number, number]));
      fittedRef.current = true;
      // fitBounds fires zoomend, which renders; render directly too in case the zoom doesn't change
      mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30], maxZoom: 16 });
    }
    renderRef.current();
  }, [routes, valueField, unit]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <h4 className="font-bold text-sm text-slate-700">{title}</h4>
        <span className="text-[10px] text-slate-400">{routes.length} 筆路線資料</span>
      </div>
      <div ref={containerRef} className="w-full h-64 relative z-0 isolate" />
      <div className="px-3 pt-2 flex items-center gap-2">
        <span className="text-[10px] text-slate-400 shrink-0">少</span>
        <div
          className="flex-1 h-2 rounded-full"
          style={{ background: `linear-gradient(to right, ${SEVERITY_LEGEND_STOPS.map(v => getSeverityColor(v)).join(', ')})` }}
        />
        <span className="text-[10px] text-slate-400 shrink-0">多</span>
      </div>
      <div className="px-3 pb-2 flex justify-between">
        {SEVERITY_LEGEND_STOPS.map(v => (
          <span key={v} className="text-[9px] text-slate-400">{v}{unit}</span>
        ))}
      </div>
      <p className="px-3 pb-3 text-[10px] text-slate-400 leading-relaxed">
        縮小地圖會自動把鄰近路線合併成圓點（顏色＝平均數量、大小＝路線筆數）；滑鼠移到路線或色塊上可看到詳細數字。
      </p>
    </div>
  );
};

export default RouteMap;
