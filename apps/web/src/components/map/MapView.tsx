'use client';
import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Site } from '@/lib/types';
import { PHILADELPHIA_BOUNDS } from '@/lib/constants';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface MapViewProps {
  sites: Site[];
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

export function MapView({ sites, onSiteClick, onBackgroundClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const sitesRef = useRef<Site[]>(sites);
  const onSiteClickRef = useRef(onSiteClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);

  // Keep refs in sync so map click handlers always use latest callbacks
  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);

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

    m.on('load', () => {
      m.addSource('sites', {
        type: 'geojson',
        data: sitesToGeoJSON(sitesRef.current),
      });

      m.addLayer({
        id: 'site-markers',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': 10,
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
        },
      });

      // Click on site marker
      m.on('click', 'site-markers', (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        if (!props) return;

        // Look up full Site object from the sites array by id
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

      // Cursor pointer on markers
      m.on('mouseenter', 'site-markers', () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'site-markers', () => {
        m.getCanvas().style.cursor = '';
      });

      // Fit bounds to show all Philadelphia sites
      m.fitBounds(PHILADELPHIA_BOUNDS, { padding: 60 });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync sites data when it changes
  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource('sites') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(sitesToGeoJSON(sites));
    }
  }, [sites]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
