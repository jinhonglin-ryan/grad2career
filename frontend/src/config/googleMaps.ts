// Shared Google Maps configuration
// This ensures the Google Maps API is loaded only once with consistent options

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Libraries to load - include all libraries needed across the app
export const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];

// Shared loader options - MUST be identical everywhere
export const googleMapsLoaderOptions = {
  id: 'google-map-script',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  libraries: GOOGLE_MAPS_LIBRARIES,
};

