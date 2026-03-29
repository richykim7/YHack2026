'use client';
import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Site, ResponsePlan } from '@/lib/types';
import { PHILADELPHIA_BOUNDS } from '@/lib/constants';
import { getSupplierCoord } from '@/lib/supplierCoords';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface TransferItem {
  from_site_id: string;
  from_site_name: string;
  to_site_id: string;
  to_site_name: string;
  food_category: string;
  quantity_lbs: number;
  delivery_cost: number;
  distance_miles: number;
}

function bezierArc(
  start: [number, number],  // [lng, lat]
  end: [number, number],
  curvature = 0.25,
  segments = 40
): [number, number][] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const cx = (start[0] + end[0]) / 2 - dy * curvature;
  const cy = (start[1] + end[1]) / 2 + dx * curvature;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const mt = 1 - t;
    return [
      mt * mt * start[0] + 2 * mt * t * cx + t * t * end[0],
      mt * mt * start[1] + 2 * mt * t * cy + t * t * end[1],
    ] as [number, number];
  });
}

interface MapViewProps {
  sites: Site[];
  selectedSiteId: string | null;
  onSiteClick: (site: Site) => void;
  onBackgroundClick: () => void;
  selectedPlan?: ResponsePlan | null;
}

function findNearestSite(lat: number, lng: number, sites: Site[]): Site | null {
  if (sites.length === 0) return null;
  let nearest = sites[0];
  let minDist = Infinity;
  for (const s of sites) {
    const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }
  return nearest;
}

function sitesToGeoJSON(sites: Site[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: sites.map((site) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [site.lng, site.lat],
      },
      properties: {
        id: site.id,
        name: site.name,
        type: site.type,
        health_score: site.health_score,
        serves_population: site.serves_population,
        region: site.region,
      },
    })),
  };
}

interface SiteDeliveryInfo {
  totalLbs: number;
  suppliers: Set<string>;
  categories: Set<string>;
}

export function MapView({ sites, selectedSiteId, onSiteClick, onBackgroundClick, selectedPlan }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const sitesRef = useRef<Site[]>(sites);
  const selectedSiteIdRef = useRef(selectedSiteId);
  const onSiteClickRef = useRef(onSiteClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const selectedPlanRef = useRef(selectedPlan ?? null);
  const siteDeliveryMapRef = useRef<Map<string, SiteDeliveryInfo> | null>(null);

  // Keep refs in sync so map click handlers always use latest callbacks
  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);

  useEffect(() => {
    selectedSiteIdRef.current = selectedSiteId;
  }, [selectedSiteId]);

  useEffect(() => {
    onSiteClickRef.current = onSiteClick;
    onBackgroundClickRef.current = onBackgroundClick;
  }, [onSiteClick, onBackgroundClick]);

  useEffect(() => {
    selectedPlanRef.current = selectedPlan ?? null;
  }, [selectedPlan]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-75.16, 39.95],
      zoom: 10,
    });

    map.current = m;

    // Create reusable popup (no close button, offset above marker)
    popup.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      className: 'cg-popup',
    });

    m.on('load', () => {
      m.addSource('sites', {
        type: 'geojson',
        data: sitesToGeoJSON(sitesRef.current),
      });

      // Pulse ring layer (behind markers)
      m.addLayer({
        id: 'site-pulse',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedSiteIdRef.current ?? ''],
            ['case',
              ['==', ['get', 'type'], 'warehouse'],
              22,
              16,
            ],
            0,
          ],
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'step',
            ['get', 'health_score'],
            '#f87171',
            0.5,
            '#fbbf24',
            0.7,
            '#4ade80',
          ],
          'circle-stroke-opacity': 0.4,
        },
      });

      // Main markers — differentiated by site type and health
      m.addLayer({
        id: 'site-markers',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': [
            'case',
            // Warehouses are larger
            ['==', ['get', 'type'], 'warehouse'],
            ['interpolate', ['linear'], ['get', 'health_score'],
              0, 15,
              0.5, 13,
              0.7, 12,
              1.0, 12,
            ],
            // Distribution sites are smaller
            ['interpolate', ['linear'], ['get', 'health_score'],
              0, 10,
              0.5, 8,
              0.7, 7,
              1.0, 7,
            ],
          ],
          'circle-color': [
            'step',
            ['get', 'health_score'],
            '#f87171',
            0.5,
            '#fbbf24',
            0.7,
            '#4ade80',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#1e293b',
          'circle-opacity': 0.9,
        },
      });

      // Click on site marker
      m.on('click', 'site-markers', (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        if (!props) return;

        const fullSite = sitesRef.current.find((s) => s.id === props.id);
        if (fullSite) {
          onSiteClickRef.current(fullSite);
        }
      });

      // Background click dismisses detail card
      m.on('click', (e) => {
        const features = m.queryRenderedFeatures(e.point, {
          layers: ['site-markers'],
        });
        if (features.length === 0) {
          onBackgroundClickRef.current();
        }
      });

      // Hover: show popup with site name + health (+ delivery delta when plan selected)
      m.on('mouseenter', 'site-markers', (e) => {
        m.getCanvas().style.cursor = 'pointer';
        if (!e.features || e.features.length === 0 || !popup.current) return;
        const f = e.features[0];
        const props = f.properties;
        if (!props) return;

        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const score = Math.round((props.health_score as number) * 100);
        const scoreColor = score >= 70 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';
        const typeLabel = props.type === 'warehouse' ? 'Warehouse' : 'Distribution Site';

        // Build delivery delta section when a plan is selected
        let deliveryHtml = '';
        const deliveryMap = siteDeliveryMapRef.current;
        if (selectedPlanRef.current && deliveryMap) {
          const siteId = props.id as string;
          const info = deliveryMap.get(siteId);
          if (info) {
            const healthScore = props.health_score as number;
            const projectedScore = Math.min(
              healthScore + (1 - healthScore) * Math.min(info.totalLbs / 5000, 1) * 0.3,
              1.0,
            );
            const projectedPct = Math.round(projectedScore * 100);
            const categories = Array.from(info.categories).join(', ');
            deliveryHtml = `
              <div style="border-top: 1px solid #334155; margin: 4px 0; padding-top: 4px;">
                <div style="font-size: 11px; color: #e2e8f0; font-family: var(--font-code), monospace;">${info.totalLbs.toLocaleString()} lbs incoming</div>
                <div style="font-size: 10px; color: #94a3b8;">${info.suppliers.size} supplier(s) &middot; ${categories}</div>
                <div style="font-size: 11px; margin-top: 2px;">
                  <span style="color: ${scoreColor}; font-family: var(--font-code), monospace;">${score}%</span>
                  <span style="color: #64748b;"> &rarr; </span>
                  <span style="color: #34d399; font-family: var(--font-code), monospace;">${projectedPct}%</span>
                </div>
              </div>`;
          }
        }

        popup.current
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family: var(--font-heading), system-ui; padding: 2px 0;">
              <div style="font-weight: 600; font-size: 12px; color: #e2e8f0; margin-bottom: 2px;">${props.name}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px;">${typeLabel}</div>
              <div style="font-size: 11px; color: ${scoreColor}; font-family: var(--font-code), monospace;">${score}% health</div>
              ${deliveryHtml}
            </div>
          `)
          .addTo(m);
      });

      m.on('mouseleave', 'site-markers', () => {
        m.getCanvas().style.cursor = '';
        popup.current?.remove();
      });

      // Fit bounds to show all Philadelphia sites
      m.fitBounds(PHILADELPHIA_BOUNDS, { padding: 60 });
    });

    return () => {
      popup.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Sync sites data when it changes
  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource('sites') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(sitesToGeoJSON(sites));
    }
  }, [sites]);

  // Update pulse ring when selection changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const m = map.current;
    if (m.getLayer('site-pulse')) {
      m.setPaintProperty('site-pulse', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], selectedSiteId ?? ''],
        ['case',
          ['==', ['get', 'type'], 'warehouse'],
          22,
          16,
        ],
        0,
      ]);
    }
  }, [selectedSiteId]);

  // Overlay supplier markers + route lines when a plan is selected
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    let cleanupHandlers: (() => void) | null = null;

    const applyOverlays = () => {
      // Remove previous supplier/route/dot layers if they exist
      for (const layerId of [
        'supplier-labels', 'supplier-markers',
        'flow-dots-core', 'flow-dots-glow',
        'route-lines-delivery', 'route-lines-transfer',
      ]) {
        if (m.getLayer(layerId)) m.removeLayer(layerId);
      }
      for (const sourceId of ['suppliers', 'routes', 'flow-dots']) {
        if (m.getSource(sourceId)) m.removeSource(sourceId);
      }

      if (!selectedPlan) {
        siteDeliveryMapRef.current = null;
        return;
      }

      // Aggregate quantities per supplier
      const supplierAgg: Record<string, { coord: { lat: number; lng: number }; totalQty: number; items: string[] }> = {};
      for (const li of selectedPlan.line_items) {
        const coord = getSupplierCoord(li.supplier_name);
        if (!coord) continue;
        if (!supplierAgg[li.supplier_name]) {
          supplierAgg[li.supplier_name] = { coord, totalQty: 0, items: [] };
        }
        supplierAgg[li.supplier_name].totalQty += li.quantity_lbs;
        supplierAgg[li.supplier_name].items.push(
          `${li.quantity_lbs.toLocaleString()} lbs ${li.food_category}`
        );
      }

      // Pre-compute per-site delivery map for hover popups
      const siteDeliveryMap = new Map<string, SiteDeliveryInfo>();
      for (const li of selectedPlan.line_items) {
        const coord = getSupplierCoord(li.supplier_name);
        if (!coord) continue;
        const nearestSite = findNearestSite(coord.lat, coord.lng, sitesRef.current);
        if (!nearestSite) continue;
        const existing = siteDeliveryMap.get(nearestSite.id);
        if (existing) {
          existing.totalLbs += li.quantity_lbs;
          existing.suppliers.add(li.supplier_name);
          existing.categories.add(li.food_category);
        } else {
          siteDeliveryMap.set(nearestSite.id, {
            totalLbs: li.quantity_lbs,
            suppliers: new Set([li.supplier_name]),
            categories: new Set([li.food_category]),
          });
        }
      }
      siteDeliveryMapRef.current = siteDeliveryMap;

      const supplierFeatures: GeoJSON.Feature<GeoJSON.Point>[] = Object.entries(supplierAgg).map(
        ([name, { coord, totalQty, items }]) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [coord.lng, coord.lat] },
          properties: { name, total_quantity_lbs: totalQty, items_summary: items.join(', ') },
        })
      );

      const supplierGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: supplierFeatures,
      };

      // Build route lines from each supplier to nearest site (bezier arcs)
      const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      for (const [name, { coord, totalQty }] of Object.entries(supplierAgg)) {
        const target = findNearestSite(coord.lat, coord.lng, sitesRef.current);
        if (!target) continue;
        routeFeatures.push({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: bezierArc([coord.lng, coord.lat], [target.lng, target.lat], 0.25, 40),
          },
          properties: { supplier: name, site: target.name, quantity_lbs: totalQty, route_type: 'delivery' },
        });
      }

      // Add transfer route features (site-to-site)
      const transfers: TransferItem[] = ((selectedPlan as unknown as Record<string, unknown>).transfers as TransferItem[]) ?? [];
      for (const transfer of transfers) {
        const fromSite = sitesRef.current.find(s => s.id === transfer.from_site_id);
        const toSite = sitesRef.current.find(s => s.id === transfer.to_site_id);
        if (!fromSite || !toSite) continue;
        routeFeatures.push({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: bezierArc([fromSite.lng, fromSite.lat], [toSite.lng, toSite.lat], 0.2, 40),
          },
          properties: { supplier: transfer.from_site_name, site: transfer.to_site_name, quantity_lbs: transfer.quantity_lbs, route_type: 'transfer' },
        });
      }

      const routeGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: 'FeatureCollection',
        features: routeFeatures,
      };

      // Add route lines (behind supplier markers) — bezier arcs with width encoding
      m.addSource('routes', { type: 'geojson', data: routeGeoJSON });

      // Delivery routes — faint base line
      m.addLayer({
        id: 'route-lines-delivery',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'route_type'], 'delivery'],
        paint: {
          'line-color': '#2dd4bf',
          'line-width': ['interpolate', ['linear'], ['get', 'quantity_lbs'], 500, 1.5, 5000, 3, 10000, 5],
          'line-opacity': 0.15,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      }, 'site-pulse');

      // Transfer routes — faint base line
      m.addLayer({
        id: 'route-lines-transfer',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'route_type'], 'transfer'],
        paint: {
          'line-color': '#fbbf24',
          'line-width': ['interpolate', ['linear'], ['get', 'quantity_lbs'], 500, 1.5, 5000, 3, 10000, 5],
          'line-opacity': 0.15,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      }, 'site-pulse');

      // --- Animated flowing dots along routes ---

      // Compute arc length of a coordinate path (in degrees, good enough for relative comparison)
      function pathLength(coords: [number, number][]): number {
        let len = 0;
        for (let i = 1; i < coords.length; i++) {
          const dx = coords[i][0] - coords[i - 1][0];
          const dy = coords[i][1] - coords[i - 1][1];
          len += Math.sqrt(dx * dx + dy * dy);
        }
        return len;
      }

      // Pre-compute route metadata: path coords, length, dot count, cycle duration
      const SPEED = 0.015; // degrees per second — constant across all routes
      const DOT_SPACING = 0.04; // degrees between dots — shorter paths get fewer dots
      const MIN_DOTS = 2;
      const MAX_DOTS = 6;

      const routeMeta: { coords: [number, number][]; type: string; len: number; dotCount: number; cycleMs: number }[] =
        routeFeatures
          .filter(f => (f.geometry.coordinates as [number, number][]).length >= 2)
          .map(f => {
            const coords = f.geometry.coordinates as [number, number][];
            const type = (f.properties?.route_type as string) ?? 'delivery';
            const len = pathLength(coords);
            const cycleMs = Math.max((len / SPEED) * 1000, 1); // time for one full traversal, min 1ms to avoid division by zero
            const dotCount = Math.max(MIN_DOTS, Math.min(MAX_DOTS, Math.round(len / DOT_SPACING)));
            return { coords, type, len, dotCount, cycleMs };
          });

      // Build dot features — variable count per route
      const dotFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
      const dotRouteIndex: { route: number; dotIdx: number }[] = []; // maps flat index to route+dot
      for (let r = 0; r < routeMeta.length; r++) {
        for (let d = 0; d < routeMeta[r].dotCount; d++) {
          dotFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: routeMeta[r].coords[0] },
            properties: { routeType: routeMeta[r].type },
          });
          dotRouteIndex.push({ route: r, dotIdx: d });
        }
      }

      const dotGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: dotFeatures,
      };

      m.addSource('flow-dots', { type: 'geojson', data: dotGeoJSON });

      // Glow layer (larger, blurred)
      m.addLayer({
        id: 'flow-dots-glow',
        type: 'circle',
        source: 'flow-dots',
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'case',
            ['==', ['get', 'routeType'], 'transfer'], '#fbbf24',
            '#2dd4bf',
          ],
          'circle-opacity': 0.4,
          'circle-blur': 1,
        },
      });

      // Core dot layer (bright, small)
      m.addLayer({
        id: 'flow-dots-core',
        type: 'circle',
        source: 'flow-dots',
        paint: {
          'circle-radius': 3,
          'circle-color': [
            'case',
            ['==', ['get', 'routeType'], 'transfer'], '#fbbf24',
            '#2dd4bf',
          ],
          'circle-opacity': 0.9,
        },
      });

      // Animate dots along paths — constant speed, variable dot count
      let animFrameId = 0;
      const startTime = performance.now();

      function animateDots(now: number) {
        if (!m) return;
        const elapsed = now - startTime;
        const dotSource = m.getSource('flow-dots') as mapboxgl.GeoJSONSource | undefined;
        if (!dotSource) {
          animFrameId = requestAnimationFrame(animateDots);
          return;
        }

        for (let i = 0; i < dotFeatures.length; i++) {
          const { route: r, dotIdx: d } = dotRouteIndex[i];
          const meta = routeMeta[r];
          const path = meta.coords;
          const segCount = path.length - 1;

          // Stagger dots evenly within the cycle
          const offset = d / meta.dotCount;
          const t = ((elapsed / meta.cycleMs + offset) % 1);

          // Interpolate position along path
          const exact = t * segCount;
          const segIdx = Math.min(Math.floor(exact), segCount - 1);
          const frac = exact - segIdx;
          const a = path[segIdx];
          const b = path[segIdx + 1];
          if (!a || !b) continue;
          dotFeatures[i].geometry.coordinates = [
            a[0] + (b[0] - a[0]) * frac,
            a[1] + (b[1] - a[1]) * frac,
          ];
        }

        dotSource.setData(dotGeoJSON);
        animFrameId = requestAnimationFrame(animateDots);
      }
      animFrameId = requestAnimationFrame(animateDots);

      // Add supplier markers
      m.addSource('suppliers', { type: 'geojson', data: supplierGeoJSON });
      m.addLayer({
        id: 'supplier-markers',
        type: 'circle',
        source: 'suppliers',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'total_quantity_lbs'],
            500, 6,
            2000, 9,
            5000, 13,
            10000, 16,
          ],
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#1e293b',
          'circle-opacity': 0.85,
        },
      });

      // Add supplier name labels
      m.addLayer({
        id: 'supplier-labels',
        type: 'symbol',
        source: 'suppliers',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': '#93c5fd',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1,
        },
      });

      // Supplier marker hover handlers
      const onSupplierEnter = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
        m.getCanvas().style.cursor = 'pointer';
        if (!e.features || e.features.length === 0 || !popup.current) return;
        const f = e.features[0];
        const props = f.properties;
        if (!props) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        popup.current
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family: var(--font-heading), system-ui; padding: 2px 0;">
              <div style="font-weight: 600; font-size: 12px; color: #93c5fd; margin-bottom: 2px;">${props.name}</div>
              <div style="font-size: 10px; color: #94a3b8;">Supplier</div>
              <div style="font-size: 11px; color: #e2e8f0; margin-top: 2px;">${props.items_summary}</div>
            </div>
          `)
          .addTo(m);
      };
      const onSupplierLeave = () => {
        m.getCanvas().style.cursor = '';
        popup.current?.remove();
      };
      m.on('mouseenter', 'supplier-markers', onSupplierEnter);
      m.on('mouseleave', 'supplier-markers', onSupplierLeave);

      cleanupHandlers = () => {
        cancelAnimationFrame(animFrameId);
        try {
          m.off('mouseenter', 'supplier-markers', onSupplierEnter);
          m.off('mouseleave', 'supplier-markers', onSupplierLeave);
        } catch {
          /* layer might already be removed */
        }
      };
    };

    if (m.isStyleLoaded()) {
      applyOverlays();
    } else {
      m.once('load', applyOverlays);
    }

    return () => {
      cleanupHandlers?.();
    };
  }, [selectedPlan]);

  // Resize map when container becomes visible (preserve-mount pattern)
  useEffect(() => {
    if (!mapContainer.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !map.current) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        map.current.resize();
        map.current.fitBounds(PHILADELPHIA_BOUNDS, { padding: 60 });
      }
    });
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={mapContainer} className="w-full h-full" />;
}
