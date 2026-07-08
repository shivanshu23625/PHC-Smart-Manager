import React, { useState, useEffect, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useMap, 
  useMapsLibrary,
  useAdvancedMarkerRef
} from '@vis.gl/react-google-maps';
import { 
  MapPin, 
  Phone, 
  Navigation, 
  Locate, 
  Activity, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  PhoneCall, 
  Map as MapIcon,
  Search,
  Plus,
  Compass,
  Info,
  Sparkles,
  Check
} from 'lucide-react';
import { MatrixItem } from '../types';

// API key resolution matching google-maps-platform guidelines
const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Helper: Haversine distance in KM
function getHaversineDistance(pt1: { lat: number; lng: number }, pt2: { lat: number; lng: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = (pt2.lat - pt1.lat) * Math.PI / 180;
  const dLng = (pt2.lng - pt1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pt1.lat * Math.PI / 180) * Math.cos(pt2.lat * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to parse coordinates from the format: '12.914° N, 74.856° E'
export function parseCoordinates(coordStr: string): { lat: number; lng: number } {
  try {
    const parts = coordStr.split(',');
    if (parts.length < 2) return { lat: 12.914, lng: 74.856 };
    const latPart = parts[0].replace('°', '').replace('N', '').replace('S', '').trim();
    const lngPart = parts[1].replace('°', '').replace('E', '').replace('W', '').trim();
    
    const latVal = parseFloat(latPart);
    const lngVal = parseFloat(lngPart);
    
    const latSign = parts[0].toUpperCase().includes('S') ? -1 : 1;
    const lngSign = parts[1].toUpperCase().includes('W') ? -1 : 1;
    
    return {
      lat: latVal * latSign,
      lng: lngVal * lngSign
    };
  } catch (e) {
    return { lat: 12.914, lng: 74.856 };
  }
}

// Realistic phone numbers mapping for PHCs
const PHC_CONTACTS: Record<string, string> = {
  'PHC_002': '+91 824 244 5112',
  'PHC_015': '+91 820 252 0415',
  'PHC_022': '+91 825 523 0222',
  'PHC_009': '+91 825 122 0009',
  'PHC_041': '+91 825 723 0141',
};

// Preset locations to make testing easy inside sandbox/iframe environments
const PRESETS = [
  { name: 'Mangalore Central Warehouse', lat: 12.9141, lng: 74.8560 },
  { name: 'Udupi Town Plaza', lat: 13.3408, lng: 74.7421 },
  { name: 'Bantwal Junction', lat: 12.8985, lng: 75.0392 },
  { name: 'Puttur City Center', lat: 12.7230, lng: 75.2030 },
  { name: 'Sullia Suburb', lat: 12.5562, lng: 75.3900 }
];

// Offline geocoding fallbacks for common Karnataka towns and Indian hubs to ensure instant resolution inside iframe
const LOCAL_GEOCODE_FALLBACKS: Record<string, { lat: number; lng: number }> = {
  'mangalore': { lat: 12.9141, lng: 74.8560 },
  'mangaluru': { lat: 12.9141, lng: 74.8560 },
  'udupi': { lat: 13.3408, lng: 74.7421 },
  'bantwal': { lat: 12.8985, lng: 75.0392 },
  'puttur': { lat: 12.7230, lng: 75.2030 },
  'sullia': { lat: 12.5562, lng: 75.3900 },
  'kinnigoli': { lat: 13.0841, lng: 74.8560 },
  'moodabidri': { lat: 13.0691, lng: 74.9961 },
  'moodbidri': { lat: 13.0691, lng: 74.9961 },
  'manipal': { lat: 13.3512, lng: 74.7865 },
  'karnataka': { lat: 12.9716, lng: 77.5946 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'surathkal': { lat: 13.0083, lng: 74.7958 },
  'mulki': { lat: 13.0970, lng: 74.7960 },
  'gurupura': { lat: 12.9490, lng: 74.9376 },
  'ganjimutt': { lat: 12.9713, lng: 74.9567 },
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
};

interface MapViewProps {
  matrix: MatrixItem[];
  onAddMatrix?: (newItem: MatrixItem) => void;
  onAddEvent?: (newEvent: any) => void;
  language: string;
  isSimpleMode: boolean;
  userLocation: { lat: number; lng: number };
  onUserLocationChange: (loc: { lat: number; lng: number }) => void;
}

// Subcomponent: Render routes on the map using GMP Routes API (computeRoutes)
function RouteDisplay({ origin, destination, onRouteComputed }: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  onRouteComputed?: (info: { distance: string; duration: string }) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;
    
    // Clean up previous route polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    }).then(({ routes }) => {
      if (routes?.[0]) {
        const newPolylines = routes[0].createPolylines();
        newPolylines.forEach(p => {
          // Style the polyline gorgeously with primary color & shadow
          p.setOptions({
            strokeColor: '#2563EB',
            strokeOpacity: 0.8,
            strokeWeight: 5,
          });
          p.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (routes[0].viewport) {
          map.fitBounds(routes[0].viewport);
        }

        if (onRouteComputed) {
          const distanceKm = (routes[0].distanceMeters ? routes[0].distanceMeters / 1000 : 0).toFixed(1);
          const durationMins = (routes[0].durationMillis ? routes[0].durationMillis / 1000 / 60 : 0).toFixed(0);
          onRouteComputed({
            distance: `${distanceKm} km`,
            duration: `${durationMins} mins`
          });
        }
      }
    }).catch(err => {
      console.warn("Routes computation failed (possibly API quota or invalid parameters):", err);
    });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [routesLib, map, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  return null;
}

export default function MapView({ 
  matrix, 
  onAddMatrix, 
  onAddEvent, 
  language, 
  isSimpleMode,
  userLocation,
  onUserLocationChange
}: MapViewProps) {
  // Setup synchronized location linked globally
  const myLocation = userLocation;
  const setMyLocation = onUserLocationChange;
  
  const [activePHC, setActivePHC] = useState<MatrixItem | null>(null);
  const [showRouteTo, setShowRouteTo] = useState<{ lat: number; lng: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [hoveredPHC, setHoveredPHC] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 12.9500, 
    lng: 74.9500
  });
  const [zoom, setZoom] = useState(10);
  const [authError, setAuthError] = useState<boolean>(() => (window as any).googleMapsAuthError || false);
  const [customAddress, setCustomAddress] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  // Scan & Register specific state
  const [activeSidebarTab, setActiveSidebarTab] = useState<'list' | 'scan'>('list');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<any[]>([]);
  const [autoRegister, setAutoRegister] = useState(true);

  // Find nearest known town to name scanned facilities realistically
  const getClosestTownName = (location: { lat: number; lng: number }): string => {
    let closestName = 'Regional';
    let minDistance = Infinity;
    for (const [name, coords] of Object.entries(LOCAL_GEOCODE_FALLBACKS)) {
      const dist = getHaversineDistance(location, coords);
      if (dist < minDistance) {
        minDistance = dist;
        closestName = name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
    return closestName;
  };

  // Generate scanned items based on current location and closest fallback name
  const handleScanRegion = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      
      const baseName = getClosestTownName(myLocation);
      const queryWords = customAddress.trim().split(/\s+/).filter(w => w.length > 2 && !['phc', 'shc', 'center', 'clinic', 'hospital', 'near', 'the', 'my', 'at', 'in'].includes(w.toLowerCase()));
      const searchTag = queryWords.length > 0 ? queryWords[0].charAt(0).toUpperCase() + queryWords[0].slice(1).toLowerCase() : baseName;

      // Deterministic but offset coordinates based on current myLocation to simulate a real GIS scan!
      const items = [
        {
          phcId: `PHC_S${Math.floor(100 + Math.random() * 899)}`,
          name: `${searchTag} Suburb PHC`,
          type: 'PHC' as const,
          lat: myLocation.lat + 0.015,
          lng: myLocation.lng + 0.025,
          itemNeeded: 'Paracetamol 500mg',
          qtyNeeded: 500,
          contact: `VHF Ch 18 (Local)`,
          roadStatus: 'Clear / Asphalt'
        },
        {
          phcId: `SHC_S${Math.floor(100 + Math.random() * 899)}`,
          name: `${searchTag} Sector SHC`,
          type: 'SHC' as const,
          lat: myLocation.lat - 0.025,
          lng: myLocation.lng + 0.035,
          itemNeeded: 'Polyvalent Anti-Venom',
          qtyNeeded: 25,
          contact: `Radio Channel 8`,
          roadStatus: 'Partially Muddy'
        },
        {
          phcId: `PHC_S${Math.floor(100 + Math.random() * 899)}`,
          name: `${searchTag} Junction PHC`,
          type: 'PHC' as const,
          lat: myLocation.lat + 0.035,
          lng: myLocation.lng - 0.015,
          itemNeeded: 'Amoxicillin',
          qtyNeeded: 150,
          contact: `Radio Channel 11`,
          roadStatus: 'Rough Mud Road'
        },
        {
          phcId: `SHC_S${Math.floor(100 + Math.random() * 899)}`,
          name: `${searchTag} Valley SHC`,
          type: 'SHC' as const,
          lat: myLocation.lat - 0.015,
          lng: myLocation.lng - 0.035,
          itemNeeded: 'Insulin Glargine',
          qtyNeeded: 40,
          contact: `HF Band Sec 4`,
          roadStatus: 'Flooded / Impassable'
        }
      ];
      setScannedItems(items);

      if (autoRegister) {
        items.forEach(item => {
          handleRegisterCandidate(item);
        });
        
        // Show confirmation
        alert(language === 'hi'
          ? `सफलतापूर्वक ${items.length} नए स्वास्थ्य केंद्रों को स्कैन करके पंजीकृत किया गया!`
          : `Successfully scanned and auto-registered ${items.length} new health centers as active clinics!`
        );

        // Switch to the Active Centers list tab after a brief delay
        setTimeout(() => {
          setActiveSidebarTab('list');
        }, 600);
      }
    }, 1200);
  };

  const handleRegisterCandidate = (item: any) => {
    if (!onAddMatrix) return;
    
    // Format coordinates back to string
    const coordsString = `${item.lat.toFixed(4)}° N, ${item.lng.toFixed(4)}° E`;
    
    const newMatrixItem: MatrixItem = {
      phcId: item.phcId,
      name: item.name,
      itemNeeded: item.itemNeeded,
      stockLevel: 0, // initially 0 stock to represent a new tracking entry that needs dispatching!
      unit: 'units',
      status: 'CRITICAL DEFICIT', // starts as critical deficit because stock is 0
      distance: `${getHaversineDistance(myLocation, { lat: item.lat, lng: item.lng }).toFixed(1)} km`,
      roadStatus: item.roadStatus,
      qtyNeeded: item.qtyNeeded,
      contact: item.contact,
      coordinates: coordsString,
      predictiveRisk: 'high_stock_out',
      riskProbability: 90,
      riskReason: `Newly registered regional clinic in ${item.name} with zero current tracked medicine stock.`
    };
    
    onAddMatrix(newMatrixItem);
    
    if (onAddEvent) {
      onAddEvent({
        phcId: item.phcId,
        type: 'system',
        content: `NEW CLINIC REGISTERED: ${item.name} (${item.type}) successfully scanned and added to the regional matrix from local coordinates.`,
        source: 'Regional Scanner Module'
      });
    }
  };
  
  // Custom API key pasting feature to play inside browser sandbox
  const [customKey, setCustomKey] = useState('');
  const [usedKey, setUsedKey] = useState(API_KEY);

  useEffect(() => {
    setUsedKey(API_KEY || customKey);
  }, [customKey]);

  // Capture Google Maps auth failure
  useEffect(() => {
    const handleAuthErr = () => {
      setAuthError(true);
    };

    // Listen to custom event dispatched by index.html script block
    window.addEventListener('google-maps-auth-error', handleAuthErr);

    // Also register local callback in case the script block was skipped or redefined
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps API authentication failed (gm_authFailure triggered). This is usually due to RefererNotAllowedMapError.");
      (window as any).googleMapsAuthError = true;
      setAuthError(true);
    };

    return () => {
      window.removeEventListener('google-maps-auth-error', handleAuthErr);
    };
  }, []);

  // Set up Geocoding service
  const geocodingLib = useMapsLibrary('geocoding');
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (!geocodingLib) return;
    setGeocoder(new geocodingLib.Geocoder());
  }, [geocodingLib]);

  const activeKey = usedKey || API_KEY;
  const isKeyReady = Boolean(activeKey) && activeKey !== 'YOUR_API_KEY';

  // Handle manual coordinate / address entry geocoding
  const handleGeocode = (address: string) => {
    if (!address.trim()) return;

    const lowerQuery = address.trim().toLowerCase();

    // 1. Check if it looks like latitude and longitude coordinates first: "12.900, 74.880"
    const coordMatch = lowerQuery.match(/^([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        const loc = { lat, lng };
        setMyLocation(loc);
        setMapCenter(loc);
        setZoom(13);
        setRouteInfo(null);
        return;
      }
    }

    // 2. Check Local Offline Geocoding Fallbacks (extremely robust fallback!)
    for (const [key, coords] of Object.entries(LOCAL_GEOCODE_FALLBACKS)) {
      if (lowerQuery.includes(key)) {
        setMyLocation(coords);
        setMapCenter(coords);
        setZoom(13);
        setRouteInfo(null);
        console.log(`Matched offline fallback for "${key}":`, coords);
        return;
      }
    }

    // 3. Check PHC Names/IDs inside the current medical matrix (so typing a PHC name snaps map to it!)
    const matchedPHC = matrix.find(item => 
      item.name.toLowerCase().includes(lowerQuery) || 
      item.phcId.toLowerCase().includes(lowerQuery)
    );
    if (matchedPHC) {
      const coords = parseCoordinates(matchedPHC.coordinates);
      setMyLocation(coords);
      setMapCenter(coords);
      setZoom(13);
      setRouteInfo(null);
      setActivePHC(matchedPHC);
      console.log(`Matched offline PHC for "${address}":`, coords);
      return;
    }

    // 4. Otherwise use the Google Maps Geocoder API
    if (!geocoder) {
      alert(language === 'hi' 
        ? 'भौगोलिक कोडिंग लोड हो रही है या उपलब्ध नहीं है। कृपया मैन्युअल रूप से lat,lng (जैसे 12.91, 74.85) टाइप करें या प्रीसेट चुनें।' 
        : 'Geocoding service is offline or loading. Please type direct coordinates (e.g., 12.91, 74.85) or select a preset dropdown!');
      return;
    }

    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = {
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng()
        };
        setMyLocation(loc);
        setMapCenter(loc);
        setZoom(13);
        setRouteInfo(null);
      } else {
        // Geocoder failed (e.g. REQUEST_DENIED because Geocoding API is not enabled in cloud console)
        console.warn("Google Maps Geocoder failed:", status);
        let errorHint = '';
        if (status === 'REQUEST_DENIED') {
          errorHint = language === 'hi'
            ? '\n\nसुझाव: आपकी API Key में "Geocoding API" सक्षम नहीं है। कृपया "12.914, 74.856" जैसी सटीक समन्वय दर्ज करें, "Moodabidri" खोजें, या प्रीसेट का उपयोग करें।'
            : '\n\nNote: This usually means "Geocoding API" is not enabled on your Google Maps API Key in Google Cloud Console. To fix, please enter raw coordinates like "12.914, 74.856", type a local preset name (like "Bantwal" or "Moodabidri"), or select from the presets list!';
        } else {
          errorHint = '\n\nStatus: ' + status;
        }
        alert((language === 'hi' ? 'स्थान नहीं मिल सका।' : 'Could not find location.') + errorHint);
      }
    });
  };

  // Handle auto geolocation
  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      alert(language === 'hi' 
        ? 'आपका ब्राउज़र जियोलोकेशन का समर्थन नहीं करता है।' 
        : 'Your browser does not support geolocation.');
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetecting(false);
        let lat = pos.coords.latitude;
        let lng = pos.coords.longitude;
        
        // Bounding box of India: Latitude 8.0 N to 38.0 N, Longitude 68.0 E to 98.0 E
        const isOutsideIndia = lat < 8.0 || lat > 38.0 || lng < 68.0 || lng > 98.0;
        
        if (isOutsideIndia) {
          lat = 12.9141;
          lng = 74.8560;
          alert(language === 'hi'
            ? "जीपीएस पुनः निर्देशित: आपका स्थान मुख्य क्षेत्र से बाहर पाया गया (डेवलपर सैंडबॉक्स)। सुरक्षा के लिए मैंगलोर क्षेत्रीय हब पर पुनः निर्देशित किया गया।"
            : "GPS Redirected: Device GPS resolved outside the coverage area (e.g. US Sandbox). Automatically centered on Mangaluru Regional Hub to show surrounding clinics."
          );
        }

        const loc = { lat, lng };
        setMyLocation(loc);
        setMapCenter(loc);
        setZoom(13);
        setRouteInfo(null);
        if (!isOutsideIndia) {
          alert(language === 'hi'
            ? `सफलतापूर्वक स्थान का पता लगाया गया: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
            : `Successfully detected location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          );
        }
      },
      (err) => {
        setIsDetecting(false);
        console.warn("Geolocation failed:", err);
        let msg = '';
        if (err.code === 1) { // PERMISSION_DENIED
          msg = language === 'hi'
            ? 'स्थान अनुमति अस्वीकार कर दी गई है। कृपया अपने ब्राउज़र में इस साइट के लिए स्थान अनुमति सक्षम करें।'
            : 'Location permission was denied. Please check your browser/system settings and allow location access for this preview app.';
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          msg = language === 'hi'
            ? 'स्थान अनुपलब्ध है। कृपया मैन्युअल रूप से दर्ज करें या प्रीसेट चुनें।'
            : 'Position unavailable. The device is unable to retrieve its location. Please enter coordinates or use presets.';
        } else if (err.code === 3) { // TIMEOUT
          msg = language === 'hi'
            ? 'स्थान का पता लगाने में समय समाप्त हो गया।'
            : 'Auto-detection timed out. Please try again or select from the presets.';
        } else {
          msg = err.message;
        }
        alert(msg + "\n\n" + (language === 'hi' ? 'सुझाव: नीचे दिए गए "प्रीसेट" में से एक चुनें या ऊपर दिए गए खोज बॉक्स में मैन्युअल रूप से दर्ज करें।' : 'Tip: You can choose a location from the dropdown, or enter your city/coordinates in the search box!'));
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Setup splash screen when API key is not ready
  if (!isKeyReady) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 max-w-2xl mx-auto my-12 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MapIcon className="w-8 h-8" />
        </div>
        
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
          Google Maps API Key Required
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 font-medium">
          The PHC Interactive Map requires a valid Google Maps Platform API key to load live map tiles, calculate dynamic routes, and fetch distances.
        </p>

        <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl mb-8 text-left">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">
            Option A: Add Key via AI Studio Secrets (Recommended)
          </h3>
          <ol className="text-xs text-slate-600 space-y-3 font-semibold list-decimal pl-5">
            <li>
              Get an API Key from the{' '}
              <a 
                href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Cloud Console
              </a>.
            </li>
            <li>
              Open <strong>Settings</strong> (⚙️ gear icon in the top-right corner of AI Studio).
            </li>
            <li>
              Select the <strong>Secrets</strong> panel.
            </li>
            <li>
              Click "Add Secret", type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the name, and press <strong>Enter</strong>.
            </li>
            <li>
              Paste your API key value into the field and click save/Enter. The app compiles automatically!
            </li>
          </ol>
        </div>

        <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl text-left">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
            Option B: Paste API Key Directly below (Session-Only Playground)
          </h3>
          <div className="flex gap-2">
            <input 
              type="password" 
              placeholder="Paste AIzaSy... API key here" 
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-white font-mono"
            />
            <button 
              onClick={() => {
                if (customKey.trim()) {
                  setUsedKey(customKey.trim());
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              Activate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-process PHC list with distances
  const phcList = matrix.map(item => {
    const coords = parseCoordinates(item.coordinates);
    const distanceKm = getHaversineDistance(myLocation, coords);
    const phone = PHC_CONTACTS[item.phcId] || '+91 800 555 0100';
    return {
      ...item,
      coords,
      distanceValue: distanceKm,
      phoneNumber: phone
    };
  }).filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.phcId.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.distanceValue - b.distanceValue);

  return (
    <APIProvider apiKey={activeKey} version="weekly">
      <div className="space-y-6">
        {/* Title and Top Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {language === 'hi' ? 'इंटरएक्टिव पी.एच.सी. मानचित्र' : 'Interactive PHC Map & Routes'}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === 'hi' 
                ? 'अपने स्थान से सभी प्राथमिक स्वास्थ्य केंद्रों की दूरी और संपर्क जानकारी देखें।' 
                : 'Track primary health centers, calculate real driving routes, and find emergency contacts.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400">
              {language === 'hi' ? 'मेरा स्थान:' : 'My Location:'}
            </span>

            {/* Custom Location Address/Coordinates Input */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-2.5 py-1 focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:border-blue-500 transition-all shadow-inner">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder={language === 'hi' ? 'स्थान या lat,lng लिखें...' : 'Enter address or lat,lng...'}
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleGeocode(customAddress);
                  }
                }}
                className="w-40 sm:w-48 bg-transparent py-1 text-xs outline-none text-slate-800 placeholder:font-medium placeholder:text-slate-400"
              />
              <button
                onClick={() => handleGeocode(customAddress)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1 uppercase tracking-wider shadow-sm"
                title="Relocate Map to this position"
              >
                <span>{language === 'hi' ? 'खोजें' : 'Go'}</span>
              </button>
            </div>
            
            {/* Presets dropdown */}
            <select
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                if (!isNaN(idx)) {
                  const preset = PRESETS[idx];
                  setMyLocation({ lat: preset.lat, lng: preset.lng });
                  setMapCenter({ lat: preset.lat, lng: preset.lng });
                  setZoom(12);
                  setRouteInfo(null);
                }
              }}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2 focus:ring-4 focus:ring-blue-500/5 focus:outline-none cursor-pointer shadow-sm"
            >
              <option value="">{language === 'hi' ? 'या प्रीसेट चुनें' : 'Or Select Preset'}</option>
              {PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.name}</option>
              ))}
            </select>

            {/* Auto Detect Location button */}
            <button
              onClick={handleAutoDetect}
              disabled={isDetecting}
              className={`p-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer hover:bg-slate-100 ${
                isDetecting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Detect current physical coordinates"
            >
              <Locate className={`w-4 h-4 ${isDetecting ? 'animate-spin' : ''}`} />
              <span>{isDetecting ? (language === 'hi' ? 'खोज रहा है...' : 'Detecting...') : (language === 'hi' ? 'ऑटो' : 'Auto Detect')}</span>
            </button>
          </div>
        </div>

        {/* Outer Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Interactive Map */}
          <div className="lg:col-span-8 bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
            {/* Map wrapper with explicit minimum CSS height to prevent "Map Height Collapse" (CF2) */}
            <div className="relative w-full h-[520px]">
              <Map
                center={mapCenter}
                zoom={zoom}
                onCenterChanged={(e) => setMapCenter(e.detail.center)}
                onZoomChanged={(e) => setZoom(e.detail.zoom)}
                mapId="PHC_TRACKER_MAP"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                className="w-full h-full"
                onClick={(e) => {
                  if (e.detail.latLng) {
                    setMyLocation(e.detail.latLng);
                    setRouteInfo(null);
                  }
                }}
              >
                {/* 1. Marker for "My Location" */}
                <AdvancedMarker 
                  position={myLocation} 
                  title="My Current Location"
                  onClick={() => {
                    setMapCenter(myLocation);
                    setZoom(13);
                  }}
                >
                  <Pin background="#10B981" glyphColor="#fff" borderColor="#047857" scale={1.2}>
                    <span className="text-[10px] font-black">ME</span>
                  </Pin>
                </AdvancedMarker>

                {/* 2. Markers for all PHCs */}
                {phcList.map((phc) => {
                  const isCritical = phc.status.toUpperCase().includes('CRITICAL');
                  const isLow = phc.status.toUpperCase().includes('LOW');
                  const markerColor = isCritical ? '#EF4444' : isLow ? '#F59E0B' : '#3B82F6';
                  const markerBorderColor = isCritical ? '#991B1B' : isLow ? '#92400E' : '#1E40AF';

                  return (
                    <AdvancedMarker
                      key={phc.phcId}
                      position={phc.coords}
                      title={phc.name}
                      onClick={() => {
                        setActivePHC(phc);
                        setMapCenter(phc.coords);
                        setZoom(12);
                      }}
                    >
                      <Pin background={markerColor} glyphColor="#fff" borderColor={markerBorderColor}>
                        <span className="text-[8px] font-bold text-white">PHC</span>
                      </Pin>
                    </AdvancedMarker>
                  );
                })}

                {/* 2.5 Markers for Scanned Items (not yet registered) */}
                {scannedItems
                  .filter(item => !matrix.some(m => m.phcId === item.phcId))
                  .map((item) => (
                    <AdvancedMarker
                      key={item.phcId}
                      position={{ lat: item.lat, lng: item.lng }}
                      title={`Scanned: ${item.name} (Click Register)`}
                      onClick={() => {
                        setActiveSidebarTab('scan');
                        setMapCenter({ lat: item.lat, lng: item.lng });
                        setZoom(13);
                      }}
                    >
                      <Pin background="#818CF8" glyphColor="#fff" borderColor="#4F46E5" scale={1.1}>
                        <span className="text-[7px] font-black text-white">SCAN</span>
                      </Pin>
                    </AdvancedMarker>
                  ))
                }

                {/* InfoWindow for the Active/Selected PHC */}
                {activePHC && (
                  <InfoWindow
                    position={parseCoordinates(activePHC.coordinates)}
                    onCloseClick={() => setActivePHC(null)}
                  >
                    <div className="p-1 max-w-[240px] text-slate-800">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                        <h4 className="text-xs font-black text-slate-900">{activePHC.name}</h4>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-500 mb-2">ID: {activePHC.phcId}</p>
                      
                      <div className="space-y-1.5 border-t border-slate-100 pt-1.5 text-[11px] font-medium">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Status:</span>
                          <span className={`font-bold ${
                            activePHC.status.includes('CRITICAL') ? 'text-red-600' : 'text-slate-700'
                          }`}>{activePHC.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Needs:</span>
                          <span className="font-bold text-slate-700">{activePHC.itemNeeded}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Contact:</span>
                          <span className="font-bold text-blue-600">{PHC_CONTACTS[activePHC.phcId] || '+91 800 555'}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-1">
                        <button
                          onClick={() => {
                            const coords = parseCoordinates(activePHC.coordinates);
                            setShowRouteTo(coords);
                          }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black py-1 rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Navigation className="w-2.5 h-2.5" />
                          <span>Show Route</span>
                        </button>
                        <a
                          href={`tel:${PHC_CONTACTS[activePHC.phcId] || '+918005550100'}`}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black py-1 px-2 rounded transition-all flex items-center justify-center cursor-pointer"
                        >
                          <Phone className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  </InfoWindow>
                )}

                {/* 3. Compute and show route polyline dynamically if route target selected */}
                {showRouteTo && (
                  <RouteDisplay 
                    origin={myLocation} 
                    destination={showRouteTo} 
                    onRouteComputed={(info) => setRouteInfo(info)}
                  />
                )}
              </Map>

              {/* RefererNotAllowedMapError Custom Diagnostic Overlay */}
              {authError && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-30 flex flex-col justify-center items-center p-6 text-center overflow-y-auto">
                  <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-4 border border-rose-500/20 animate-pulse">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-extrabold text-white mb-1">
                    {language === 'hi' ? 'मानचित्र कुंजी अनुमति त्रुटि' : 'Google Maps Restriction Error'}
                  </h3>
                  <p className="text-xs text-rose-300 font-bold mb-4 font-mono">
                    RefererNotAllowedMapError
                  </p>
                  
                  <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-4.5 text-left text-xs text-slate-300 space-y-3 shadow-2xl">
                    <p className="font-semibold text-slate-200">
                      Your Google Maps API Key has <span className="text-yellow-400">HTTP referrer restrictions</span> enabled, which is blocking requests from this preview sandbox URL:
                    </p>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[10px] text-blue-400 select-all break-all font-bold">
                      https://ais-dev-4hmopz5wmbtvcwm7zbf256-193462607620.asia-east1.run.app/
                    </div>
                    <div className="space-y-1 pt-1.5 border-t border-slate-800/80">
                      <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">How to resolve this in 2 minutes:</p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-300 font-semibold text-[11px]">
                        <li>Go to your <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">Google Cloud Console Credentials</a> page.</li>
                        <li>Click your Google Maps API Key (or the one you registered as <code>GOOGLE_MAPS_PLATFORM_KEY</code>).</li>
                        <li>Under <strong>Application restrictions</strong>, either change it to <strong>None</strong> (safest for fast sandboxing) OR add the authorized referrer pattern below to your existing list:</li>
                      </ol>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-[10px] text-emerald-400 font-bold select-all">
                      *.run.app/*
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 italic">
                      💡 Note: Google API restriction changes can take up to 5 minutes to take effect worldwide. After updating, refresh your page!
                    </p>
                  </div>
                  <button 
                    onClick={() => setAuthError(false)}
                    className="mt-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl border border-slate-700 transition-all active:scale-95 cursor-pointer"
                  >
                    Dismiss and Show Map Anyway
                  </button>
                </div>
              )}

              {/* Float helper: Click map to set location */}
              <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-lg border border-slate-800 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                <span>Tip: Click anywhere on the map to set "My Location"</span>
              </div>
            </div>

            {/* Displaying Live Computed Driving Route Metrics */}
            {routeInfo && (
              <div className="bg-blue-600 text-white p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-blue-700/80 rounded-2xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-emerald-400 animate-pulse" />
                  </span>
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-blue-200">
                      Live Driving Route Calculated
                    </h5>
                    <p className="text-sm font-extrabold mt-0.5">
                      Distance: <span className="text-yellow-300">{routeInfo.distance}</span> • Estimated Drive Time: <span className="text-yellow-300">{routeInfo.duration}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowRouteTo(null);
                    setRouteInfo(null);
                  }}
                  className="bg-blue-800 hover:bg-blue-900 text-white text-xs font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  Clear Route
                </button>
              </div>
            )}
          </div>

          {/* Right Column: List of PHCs sorted by distance or GIS Region Scanner */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col h-full max-h-[580px]">
            
            {/* Sidebar Tabs */}
            <div className="flex border-b border-slate-100 mb-4">
              <button
                onClick={() => setActiveSidebarTab('list')}
                className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
                  activeSidebarTab === 'list'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600 font-bold'
                }`}
              >
                {language === 'hi' ? `सक्रिय केंद्र (${phcList.length})` : `Active Centers (${phcList.length})`}
              </button>
              <button
                onClick={() => setActiveSidebarTab('scan')}
                className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeSidebarTab === 'scan'
                    ? 'border-indigo-600 text-indigo-600 font-extrabold'
                    : 'border-transparent text-slate-400 hover:text-slate-600 font-bold'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>{language === 'hi' ? 'खोजें और जोड़ें' : 'Scan & Register'}</span>
                {scannedItems.filter(item => !matrix.some(m => m.phcId === item.phcId)).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                )}
              </button>
            </div>

            {/* TAB CONTENT: ACTIVE CENTERS LIST */}
            {activeSidebarTab === 'list' && (
              <>
                {/* Search inputs */}
                <div className="mb-4 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder={language === 'hi' ? 'केंद्र या आईडी खोजें...' : 'Search centers or ID...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/50 font-semibold text-slate-700 transition-all"
                    />
                  </div>
                </div>

                {/* List with scroll */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {phcList.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-xs font-bold text-slate-400">No matching health centers found.</p>
                    </div>
                  ) : (
                    phcList.map((phc) => {
                      const isCritical = phc.status.toUpperCase().includes('CRITICAL');
                      const isLow = phc.status.toUpperCase().includes('LOW');
                      const isSelected = activePHC?.phcId === phc.phcId;

                      return (
                        <div
                          key={phc.phcId}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-50/50 border-blue-400 shadow-sm' 
                              : 'bg-white border-slate-100 hover:border-slate-300'
                          }`}
                          onClick={() => {
                            setActivePHC(phc);
                            setMapCenter(phc.coords);
                            setZoom(11);
                          }}
                          onMouseEnter={() => setHoveredPHC(phc.phcId)}
                          onMouseLeave={() => setHoveredPHC(null)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black text-slate-800">{phc.name}</h4>
                                <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {phc.phcId}
                                </span>
                              </div>
                              
                              <p className="text-[11px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                <span>Distance: </span>
                                <span className="text-slate-800 font-extrabold">{phc.distanceValue.toFixed(1)} km</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-slate-400 font-mono text-[9px]">{phc.coordinates}</span>
                              </p>
                            </div>

                            {/* Status badge */}
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black ${
                              isCritical 
                                ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                : isLow 
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {isCritical ? <AlertTriangle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                              {phc.status}
                            </span>
                          </div>

                          {/* Contact details and action buttons */}
                          <div className="mt-3 pt-3 border-t border-slate-100/70 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <a
                                href={`tel:${phc.phoneNumber}`}
                                onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center cursor-pointer border border-slate-200"
                                title="Call health center"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </a>
                              <div>
                                <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Direct Contact</p>
                                <p className="text-[11px] font-extrabold text-slate-700">{phc.phoneNumber}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePHC(phc);
                                  setMapCenter(phc.coords);
                                  setZoom(13);
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
                              >
                                Fly To
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRouteTo(phc.coords);
                                  setActivePHC(phc);
                                }}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl transition-all flex items-center gap-1 shadow-sm shadow-blue-500/10 cursor-pointer"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>Route</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* TAB CONTENT: GIS SCANNER & REGISTRATION */}
            {activeSidebarTab === 'scan' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 mb-4 shrink-0 text-xs">
                  <div className="flex items-center gap-2 font-black text-slate-700 mb-1">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    <span>{language === 'hi' ? 'चयनित स्कैन केंद्र:' : 'Target GIS Coordinates:'}</span>
                  </div>
                  <p className="font-mono text-[11px] font-bold text-slate-600 bg-white px-2 py-1.5 border border-slate-200 rounded-lg shadow-sm">
                    {myLocation.lat.toFixed(5)}° N, {myLocation.lng.toFixed(5)}° E
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1.5 italic">
                    {language === 'hi' 
                      ? '💡 आप इस स्थान को बदलने के लिए नक्शे पर कहीं भी क्लिक कर सकते हैं।' 
                      : '💡 You can click anywhere on the map to shift the scanning center point.'}
                  </p>
                </div>

                {/* Big scan button */}
                <button
                  onClick={handleScanRegion}
                  disabled={isScanning}
                  className={`w-full py-3 px-4 mb-3 text-xs font-black tracking-wider uppercase rounded-2xl text-white transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                    isScanning 
                      ? 'bg-indigo-400 cursor-not-allowed animate-pulse' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 active:scale-95'
                  }`}
                >
                  <Compass className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>
                    {isScanning 
                      ? (language === 'hi' ? 'स्कैन हो रहा है...' : 'Scanning GIS Network...') 
                      : (language === 'hi' ? 'आसपास के केंद्र खोजें' : 'Scan Surrounding Region')}
                  </span>
                </button>

                {/* Auto register checkbox option */}
                <div className="flex items-center gap-2 mb-4 px-1 shrink-0">
                  <input
                    type="checkbox"
                    id="auto-register-checkbox"
                    checked={autoRegister}
                    onChange={(e) => setAutoRegister(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="auto-register-checkbox" className="text-xs font-bold text-slate-600 select-none cursor-pointer">
                    {language === 'hi'
                      ? 'खोजे गए केंद्रों को तुरंत पंजीकृत करें'
                      : 'Auto-register discovered centers instantly'}
                  </label>
                </div>

                {/* Register All Discovered Button (Only when not auto-registering and there are candidates) */}
                {scannedItems.filter(item => !matrix.some(m => m.phcId === item.phcId)).length > 0 && !autoRegister && (
                  <button
                    onClick={() => {
                      scannedItems
                        .filter(item => !matrix.some(m => m.phcId === item.phcId))
                        .forEach(item => handleRegisterCandidate(item));
                      alert(language === 'hi' ? 'सभी केंद्रों को पंजीकृत किया गया!' : 'All discovered health centers registered!');
                      setTimeout(() => setActiveSidebarTab('list'), 600);
                    }}
                    className="w-full mb-3 py-2.5 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {language === 'hi' 
                        ? `सभी खोजे गए केंद्र पंजीकृत करें (${scannedItems.filter(item => !matrix.some(m => m.phcId === item.phcId)).length})` 
                        : `Register All Discovered (${scannedItems.filter(item => !matrix.some(m => m.phcId === item.phcId)).length})`
                      }
                    </span>
                  </button>
                )}

                {/* Scanned candidates results container */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {scannedItems.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl p-6">
                      <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-pulse" />
                      <h4 className="text-xs font-bold text-slate-700">
                        {language === 'hi' ? 'स्कैन करने के लिए तैयार' : 'Ready for Scanning'}
                      </h4>
                      <p className="text-[11px] font-semibold text-slate-400 mt-1 max-w-[180px] mx-auto leading-relaxed">
                        {language === 'hi' 
                          ? 'ऊपर दिए गए बटन पर क्लिक करके इस क्षेत्र के स्वास्थ्य केंद्रों को खोजें और मानचित्र पर देखें।' 
                          : 'Click the button above to discover local health facilities (PHCs & SHCs) around your target area.'}
                      </p>
                    </div>
                  ) : (
                    scannedItems.map((item) => {
                      const isRegistered = matrix.some(m => m.phcId === item.phcId);
                      const itemDist = getHaversineDistance(myLocation, { lat: item.lat, lng: item.lng });

                      return (
                        <div
                          key={item.phcId}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isRegistered 
                              ? 'bg-slate-50 border-slate-200 opacity-75' 
                              : 'bg-indigo-50/20 border-indigo-100/70 hover:border-indigo-300/80 shadow-inner'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black text-slate-800">{item.name}</h4>
                                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                                  {item.type}
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 font-mono">
                                <span>Dist: {itemDist.toFixed(1)} km</span>
                                <span>•</span>
                                <span>{item.lat.toFixed(3)}, {item.lng.toFixed(3)}</span>
                              </p>
                            </div>

                            {isRegistered ? (
                              <span className="shrink-0 flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full">
                                <Check className="w-2.5 h-2.5" />
                                <span>{language === 'hi' ? 'पंजीकृत' : 'Registered'}</span>
                              </span>
                            ) : (
                              <span className="shrink-0 bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full">
                                {language === 'hi' ? 'अप्रकाशित' : 'Scanned'}
                              </span>
                            )}
                          </div>

                          {!isRegistered && (
                            <div className="mt-3.5 pt-3 border-t border-indigo-100/50 flex items-center justify-between gap-2">
                              <div className="text-[10px]">
                                <p className="text-[8px] font-black uppercase text-indigo-400">{language === 'hi' ? 'आवश्यकता' : 'Deficit Demand'}</p>
                                <p className="font-extrabold text-slate-700">{item.itemNeeded} ({item.qtyNeeded})</p>
                              </div>

                              <button
                                onClick={() => handleRegisterCandidate(item)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{language === 'hi' ? 'पंजीकृत करें' : 'Register'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            
            {/* Quick overview metric */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Regional Coverage</p>
                <p className="text-xs font-bold text-slate-700">
                  {matrix.length} centers registered within a <span className="font-extrabold text-slate-900">100 km</span> operational radius.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </APIProvider>
  );
}
