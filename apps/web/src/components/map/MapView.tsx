'use client';
import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Site } from '@/lib/types';
import { PHILADELPHIA_BOUNDS } from '@/lib/constants';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface MapViewProps {
  sites: Site[];
  selectedSiteId: string | null;
  onSiteClick: (site: Site) => void;
  onBackgroundClick: () => void;
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

export function MapView({ sites, selectedSiteId, onSiteClick, onBackgroundClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const sitesRef = useRef<Site[]>(sites);
  const selectedSiteIdRef = useRef(selectedSiteId);
  const onSiteClickRef = useRef(onSiteClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);

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
            18,
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

      // Main markers — larger for critical sites
      m.addLayer({
        id: 'site-markers',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'health_score'],
            0, 13,
            0.5, 11,
            0.7, 9,
            1.0, 9,
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

      // Hover: show popup with site name + health
      m.on('mouseenter', 'site-markers', (e) => {
        m.getCanvas().style.cursor = 'pointer';
        if (!e.features || e.features.length === 0 || !popup.current) return;
        const f = e.features[0];
        const props = f.properties;
        if (!props) return;

        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        const score = Math.round((props.health_score as number) * 100);
        const scoreColor = score >= 70 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';

        popup.current
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family: var(--font-heading), system-ui; padding: 2px 0;">
              <div style="font-weight: 600; font-size: 12px; color: #e2e8f0; margin-bottom: 2px;">${props.name}</div>
              <div style="font-size: 11px; color: ${scoreColor}; font-family: var(--font-code), monospace;">${score}% health</div>
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
        18,
        0,
      ]);
    }
  }, [selectedSiteId]);

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
