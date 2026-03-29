'use client';
import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Site, ResponsePlan } from '@/lib/types';
import { PHILADELPHIA_BOUNDS } from '@/lib/constants';
import { getSupplierCoord } from '@/lib/supplierCoords';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

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
      // Remove previous supplier/route/arrow layers if they exist
      if (m.getLayer('supplier-labels')) m.removeLayer('supplier-labels');
      if (m.getLayer('supplier-markers')) m.removeLayer('supplier-markers');
      if (m.getLayer('route-arrows')) m.removeLayer('route-arrows');
      if (m.getLayer('route-lines')) m.removeLayer('route-lines');
      if (m.getSource('suppliers')) m.removeSource('suppliers');
      if (m.getSource('routes')) m.removeSource('routes');

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

      // Build route lines from each supplier to nearest site
      const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      for (const [name, { coord }] of Object.entries(supplierAgg)) {
        const target = findNearestSite(coord.lat, coord.lng, sitesRef.current);
        if (!target) continue;
        routeFeatures.push({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: [[coord.lng, coord.lat], [target.lng, target.lat]],
          },
          properties: { supplier: name, site: target.name },
        });
      }

      const routeGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: 'FeatureCollection',
        features: routeFeatures,
      };

      // Add route lines (behind supplier markers) — static dashed lines
      m.addSource('routes', { type: 'geojson', data: routeGeoJSON });
      m.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': '#60a5fa',
          'line-width': 1.5,
          'line-dasharray': [4, 3],
          'line-opacity': 0.5,
        },
      }, 'site-pulse');

      // Add chevron arrows along the route lines to show direction of flow
      m.addLayer({
        id: 'route-arrows',
        type: 'symbol',
        source: 'routes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 80,
          'text-field': '\u203A',
          'text-size': 18,
          'text-keep-upright': false,
          'text-rotation-alignment': 'map',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#60a5fa',
          'text-opacity': 0.7,
        },
      });

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
