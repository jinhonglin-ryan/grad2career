import { useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { MapPin, ExternalLink, DollarSign, Clock } from 'lucide-react';
import styles from './TrainingProgramMap.module.css';

interface TrainingProgram {
  program_name: string;
  provider: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  url?: string;
  cost?: string;
  duration?: string;
  description?: string;
  recommendation_level?: string;
}

interface TrainingProgramMapProps {
  programs: TrainingProgram[];
  center?: { lat: number; lng: number };
  userState?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '700px',
  borderRadius: '0.75rem'
};

// State centers for better initial view
const STATE_CENTERS: Record<string, { lat: number; lng: number }> = {
  'West Virginia': { lat: 38.5976, lng: -80.4549 },
  'Kentucky': { lat: 37.8393, lng: -84.2700 },
  'Pennsylvania': { lat: 40.2732, lng: -76.8867 },
};

const defaultCenter = {
  lat: 38.5976, // West Virginia center
  lng: -80.4549
};

const TrainingProgramMap = ({ programs, center, userState }: TrainingProgramMapProps) => {
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Filter programs with valid coordinates (must be before onLoad)
  const programsWithLocation = useMemo(() => 
    programs?.filter(p => p.latitude && p.longitude) || [],
    [programs]
  );

  // Replace with your Google Maps API key
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    try {
      setMap(map);
      
      // Fit bounds to show all markers
      if (programsWithLocation.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        programsWithLocation.forEach(program => {
          if (program.latitude && program.longitude) {
            bounds.extend({ lat: program.latitude, lng: program.longitude });
          }
        });
        map.fitBounds(bounds);
        
        // Don't zoom in too much if only one location
        setTimeout(() => {
          const zoom = map.getZoom();
          if (zoom && zoom > 12) {
            map.setZoom(12);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Map onLoad error:', error);
      setMapError('Error initializing map');
    }
  }, [programsWithLocation]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calculate center if not provided
  const stateCenter = userState ? STATE_CENTERS[userState] : undefined;
  const mapCenter = center || stateCenter || (programsWithLocation.length > 0 ? {
    lat: programsWithLocation.reduce((sum, p) => sum + (p.latitude || 0), 0) / programsWithLocation.length,
    lng: programsWithLocation.reduce((sum, p) => sum + (p.longitude || 0), 0) / programsWithLocation.length
  } : defaultCenter);

  // Function to center map on a specific program
  const centerOnProgram = (program: TrainingProgram) => {
    if (program.latitude && program.longitude) {
      setSelectedProgram(program);
      if (map) {
        map.panTo({ lat: program.latitude, lng: program.longitude });
        map.setZoom(13);
      }
    }
  };

  const handleMarkerClick = (program: TrainingProgram) => {
    setSelectedProgram(program);
  };

  // Memoize map options to prevent re-renders
  const mapOptions = useMemo(() => ({
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: true,
    fullscreenControl: true,
    clickableIcons: false,
    gestureHandling: 'cooperative',
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  }), []);

  // Safety check
  if (!programs || programs.length === 0) {
    return (
      <div className={styles.noLocationContainer}>
        <MapPin size={48} />
        <h3>No Programs Available</h3>
        <p>Please perform a search first.</p>
      </div>
    );
  }

  const getMarkerIcon = (level?: string) => {
    switch (level) {
      case 'highly_recommended':
        return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
      case 'recommended':
        return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      case 'alternative':
        return 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
      default:
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
    }
  };

  if (loadError || mapError) {
    return (
      <div className={styles.errorContainer}>
        <MapPin size={48} />
        <h3>Unable to Load Map</h3>
        <p>Please check your Google Maps API key configuration</p>
        <p className={styles.errorDetail}>
          Add VITE_GOOGLE_MAPS_API_KEY to your frontend/.env file
        </p>
        {mapError && <p className={styles.errorDetail}>Error: {mapError}</p>}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={styles.loadingContainer}>
        <MapPin size={48} className={styles.spinning} />
        <p>Loading map...</p>
      </div>
    );
  }

  if (programsWithLocation.length === 0) {
    return (
      <div className={styles.noLocationContainer}>
        <MapPin size={48} />
        <h3>No Location Data Available</h3>
        <p>Training programs found, but location coordinates are not available for mapping.</p>
        <p className={styles.hint}>
          This feature requires Google Maps API key and geocoding of program addresses.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.mapWrapper}>
      <div className={styles.mapHeader}>
        <div className={styles.mapLegend}>
          <h3>📍 Training Program Locations</h3>
          <div className={styles.legendItems}>
            <div className={styles.legendItem}>
              <img src="http://maps.google.com/mapfiles/ms/icons/green-dot.png" alt="Highly Recommended" />
              <span>Highly Recommended</span>
            </div>
            <div className={styles.legendItem}>
              <img src="http://maps.google.com/mapfiles/ms/icons/blue-dot.png" alt="Recommended" />
              <span>Recommended</span>
            </div>
            <div className={styles.legendItem}>
              <img src="http://maps.google.com/mapfiles/ms/icons/yellow-dot.png" alt="Alternative" />
              <span>Alternative</span>
            </div>
          </div>
        </div>
        <p className={styles.programCount}>
          📌 Showing {programsWithLocation.length} program{programsWithLocation.length !== 1 ? 's' : ''} on map
        </p>
      </div>

      <div className={styles.mapContainer}>
        {/* Sidebar with program list */}
        <div className={styles.mapSidebar}>
          <h4>Programs ({programsWithLocation.length})</h4>
          <div className={styles.programList}>
            {programsWithLocation.map((program, index) => (
              <div
                key={index}
                className={`${styles.programListItem} ${
                  selectedProgram === program ? styles.active : ''
                }`}
                onClick={() => centerOnProgram(program)}
              >
                <div className={styles.programMarker}>
                  <img 
                    src={getMarkerIcon(program.recommendation_level)} 
                    alt="marker"
                    style={{ width: '20px', height: '20px' }}
                  />
                </div>
                <div className={styles.programInfo}>
                  <strong>{program.program_name}</strong>
                  <span className={styles.provider}>{program.provider}</span>
                  <span className={styles.location}>{program.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className={styles.mapArea}>
          <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={mapCenter}
        zoom={9}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {programsWithLocation.map((program, index) => (
          <Marker
            key={`marker-${index}`}
            position={{
              lat: program.latitude!,
              lng: program.longitude!
            }}
            onClick={() => handleMarkerClick(program)}
            icon={{
              url: getMarkerIcon(program.recommendation_level),
              scaledSize: new window.google.maps.Size(32, 32)
            }}
            title={program.program_name}
          />
        ))}

        {selectedProgram && selectedProgram.latitude && selectedProgram.longitude && (
          <InfoWindow
            position={{
              lat: selectedProgram.latitude,
              lng: selectedProgram.longitude
            }}
            onCloseClick={() => setSelectedProgram(null)}
            options={{
              pixelOffset: new window.google.maps.Size(0, -30),
              maxWidth: 350,
              disableAutoPan: false,
            }}
          >
            <div className={styles.infoWindow}>
              <h3>{selectedProgram.program_name}</h3>
              <p className={styles.provider}>{selectedProgram.provider}</p>
              {selectedProgram.location && (
                <div className={styles.infoDetail}>
                  <MapPin size={14} />
                  <span>{selectedProgram.location}</span>
                </div>
              )}
              {selectedProgram.cost && (
                <div className={styles.infoDetail}>
                  <DollarSign size={14} />
                  <span>{selectedProgram.cost}</span>
                </div>
              )}
              {selectedProgram.duration && (
                <div className={styles.infoDetail}>
                  <Clock size={14} />
                  <span>{selectedProgram.duration}</span>
                </div>
              )}
              {selectedProgram.description && (
                <p className={styles.description}>{selectedProgram.description}</p>
              )}
              {selectedProgram.url && (
                <a
                  href={selectedProgram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.mapLink}
                >
                  View Program
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
        </div>
      </div>
    </div>
  );
};

export default TrainingProgramMap;

