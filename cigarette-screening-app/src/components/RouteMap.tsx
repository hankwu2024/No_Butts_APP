import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { intersect } from '@turf/intersect';
import { featureCollection } from '@turf/helpers';
import { bboxPolygon } from '@turf/bbox-polygon';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { ScreeningData } from '../types';
import { getSeverityColor, SEVERITY_LEGEND_STOPS } from '../utils/colorScale';
import taiwanGeoJson from '../data/taiwan.geo.json';

const TAIWAN_BOUNDARY = taiwanGeoJson.features[0] as unknown as Feature<MultiPolygon>;

interface RouteMapProps {
  title: string;
  data: ScreeningData[];
  valueField: 'screenedCount' | 'actualPickedCount';
  unit?: string;
}

const AGGREGATE_ZOOM_THRESHOLD = 14;

const RouteMap: React.FC<RouteMapProps> = ({ title, data, valueField, unit = '根' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const routesRef = useRef<ScreeningData[]>([]);
  const valueFieldRef = useRef(valueField);
  const unitRef = useRef(unit);
  const renderRef = useRef<() => void>(() => {});

  const routes = data.filter(d => d.path && d.path.length > 1);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([23.6978, 120.9605], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
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
        const cellSizeDeg = (360 / Math.pow(2, zoom)) * 2;
        const cells = new Map<string, { count: number; sum: number; south: number; west: number }>();

        currentRoutes.forEach(r => {
          const pts = r.path!;
          const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
          const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
          const gy = Math.floor(lat / cellSizeDeg);
          const gx = Math.floor(lng / cellSizeDeg);
          const key = `${gy}_${gx}`;
          const value = r[field] || 0;

          if (!cells.has(key)) {
            cells.set(key, { count: 0, sum: 0, south: gy * cellSizeDeg, west: gx * cellSizeDeg });
          }
          const cell = cells.get(key)!;
          cell.count += 1;
          cell.sum += value;
        });

        cells.forEach(cell => {
          const avg = cell.sum / cell.count;
          const cellPolygon = bboxPolygon([
            cell.west,
            cell.south,
            cell.west + cellSizeDeg,
            cell.south + cellSizeDeg,
          ]);

          let clipped;
          try {
            clipped = intersect(featureCollection<Polygon | MultiPolygon>([cellPolygon, TAIWAN_BOUNDARY]));
          } catch {
            clipped = null;
          }
          if (!clipped) return; // cell falls entirely over the ocean, skip it

          const color = getSeverityColor(avg);
          L.geoJSON(clipped, {
            style: { color, weight: 1, fillColor: color, fillOpacity: 0.45 },
          })
            .bindTooltip(`區域平均：${avg.toFixed(0)} ${currentUnit}（${cell.count} 筆路線）`)
            .addTo(currentLayer);
        });
      }
    };

    renderRef.current = doRender;
    map.on('zoomend moveend', doRender);
    doRender();

    return () => {
      map.off('zoomend moveend', doRender);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const fittedRef = useRef(false);

  useEffect(() => {
    routesRef.current = routes;
    valueFieldRef.current = valueField;
    unitRef.current = unit;
    renderRef.current();

    if (!fittedRef.current && routes.length > 0 && mapRef.current) {
      const allPoints = routes.flatMap(r => r.path!.map(p => [p.lat, p.lng] as [number, number]));
      mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30], maxZoom: 16 });
      fittedRef.current = true;
    }
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <h4 className="font-bold text-sm text-slate-700">{title}</h4>
        <span className="text-[10px] text-slate-400">{routes.length} 筆路線資料</span>
      </div>
      <div ref={containerRef} className="w-full h-64" />
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
        縮小地圖會自動改以區塊平均數量統計；滑鼠移到路線或色塊上可看到詳細數字。
      </p>
    </div>
  );
};

export default RouteMap;
