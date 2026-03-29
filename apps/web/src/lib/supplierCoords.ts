export interface SupplierCoord {
  lat: number;
  lng: number;
  name: string;
}

export const SUPPLIER_COORDS: Record<string, SupplierCoord> = {
  'Philabundance': { lat: 39.9097, lng: -75.1603, name: 'Philabundance' },
  'Philabundance Warehouse': { lat: 39.9097, lng: -75.1603, name: 'Philabundance' },
  'SHARE Food Program': { lat: 39.9916, lng: -75.1680, name: 'SHARE Food Program' },
  'Share Food Program': { lat: 39.9916, lng: -75.1680, name: 'Share Food Program' },
  'Feeding America Eastern PA': { lat: 39.9536, lng: -75.1674, name: 'Feeding America Eastern PA' },
  'USDA TEFAP Program': { lat: 38.8867, lng: -77.0300, name: 'USDA TEFAP Program' },
  'USDA TEFAP Distribution': { lat: 38.8867, lng: -77.0300, name: 'USDA TEFAP Distribution' },
  'Chester County Food Bank': { lat: 39.9607, lng: -75.6055, name: 'Chester County Food Bank' },
  'MANNA': { lat: 39.9621, lng: -75.1734, name: 'MANNA' },
  'Bucks County Opportunity Council': { lat: 40.1051, lng: -74.8599, name: 'Bucks County Opportunity Council' },
  'Montgomery County Food Bank': { lat: 40.2415, lng: -75.2838, name: 'Montgomery County Food Bank' },
  'Lancaster Farm Fresh Cooperative': { lat: 40.0379, lng: -76.3055, name: 'Lancaster Farm Fresh Cooperative' },
  'Delaware Valley Food Council': { lat: 39.9512, lng: -75.1660, name: 'Delaware Valley Food Council' },
  'ShopRite Partners': { lat: 41.0465, lng: -74.0538, name: 'ShopRite Partners' },
  'US Foods Philadelphia': { lat: 39.7476, lng: -75.3105, name: 'US Foods Philadelphia' },
  // Mock data aliases
  'Philly Protein Partners': { lat: 39.9750, lng: -75.1400, name: 'Philly Protein Partners' },
  'Dairy Farmers of SE Pennsylvania': { lat: 40.0100, lng: -75.3200, name: 'Dairy Farmers of SE Pennsylvania' },
  'Whole Grain Distributors NE': { lat: 40.0800, lng: -75.0100, name: 'Whole Grain Distributors NE' },
};

/** Look up supplier coordinates by name. Returns null if not found. */
export function getSupplierCoord(supplierName: string): SupplierCoord | null {
  return SUPPLIER_COORDS[supplierName] ?? null;
}
