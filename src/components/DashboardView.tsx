import React, { useState, useEffect } from 'react';
import { InventoryItem, CheckedInDoctor, ActivityEvent, MatrixItem } from '../types';
import { REPORT_EXAMPLES, INITIAL_MATRIX } from '../data';
import { 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  Activity, 
  HelpCircle, 
  Loader2, 
  Play, 
  RefreshCw,
  Search,
  Filter,
  Layers,
  Sparkles,
  ClipboardList,
  Plus,
  Edit,
  Trash2,
  Volume2,
  Mic,
  MicOff,
  Accessibility,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  MapPin,
  Compass,
  Globe,
  ChevronRight
} from 'lucide-react';
import { Language, TRANSLATIONS, translateMedicine, translateUnit, translateStatus, translateUI, translateDoctorName } from '../utils/translations';
import { startSpeechToText, speakText, stopSpeaking } from '../utils/audio';

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
function parseCoordinates(coordStr: string): { lat: number; lng: number } {
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

interface DashboardViewProps {
  inventory: InventoryItem[];
  doctors: CheckedInDoctor[];
  events: ActivityEvent[];
  onUpdateInventory: (itemId: string, consumedAmount: number) => void;
  onUpdateDoctorAttendance: (present: boolean) => void;
  onAddEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  onNavigateToTab: (tab: 'dashboard' | 'attendance' | 'matrix' | 'updates' | 'map') => void;
  onAddInventory: (item: Omit<InventoryItem, 'id' | 'status'>) => void;
  onEditInventory: (item: InventoryItem) => void;
  onDeleteInventory: (id: string) => void;
  language: Language;
  isSimpleMode: boolean;
  reportText: string;
  setReportText: (text: string) => void;
  matrix?: MatrixItem[];
  userLocation?: { lat: number; lng: number };
  onUpdateUserLocation?: (location: { lat: number; lng: number }) => void;
  onAutoLocate?: () => void;
  isDetectingLocation?: boolean;
  showToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
}

export default function DashboardView({
  inventory,
  doctors,
  events,
  onUpdateInventory,
  onUpdateDoctorAttendance,
  onAddEvent,
  onNavigateToTab,
  onAddInventory,
  onEditInventory,
  onDeleteInventory,
  language,
  isSimpleMode,
  reportText,
  setReportText,
  matrix = [],
  userLocation = { lat: 12.9141, lng: 74.8560 },
  onUpdateUserLocation,
  onAutoLocate,
  isDetectingLocation = false,
  showToast,
}: DashboardViewProps) {
  const currentTrans = TRANSLATIONS[language] || TRANSLATIONS['en'];
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(userLocation);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState<boolean>(false);

  const [localToast, setLocalToast] = useState<{ title: string; message: string; type: 'info' | 'success' | 'warning' } | null>(null);
  
  const triggerLocalToast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setLocalToast({ title, message, type });
    setTimeout(() => {
      setLocalToast(null);
    }, 5000);
  };

  const [manualQuery, setManualQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'success' | 'error'>('idle');
  const [searchMsg, setSearchMsg] = useState('');

  useEffect(() => {
    if (userLocation) {
      setDetectedCoords(userLocation);
    }
  }, [userLocation]);

  const handlePresetClick = (name: string, lat: number, lng: number) => {
    const newLoc = { lat, lng };
    setDetectedCoords(newLoc);
    setSearchStatus('success');
    setSearchMsg(name);
    setManualQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    
    if (onUpdateUserLocation) {
      onUpdateUserLocation(newLoc);
    }
    
    onAddEvent({
      phcId: null,
      type: 'system',
      content: `DASHBOARD GEOLOCATION: Manually corrected GPS base station to preset "${name}" at [${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E] to resolve ranges.`,
      source: 'Quick Preset Override'
    });
  };

  const runLocalNameFallback = (query: string) => {
    const q = query.toLowerCase().trim();
    const presets = [
      { names: ['mangaluru', 'mangalore', 'dakshina kannada', 'dk'], lat: 12.9141, lng: 74.8560, fullName: 'Mangaluru Center, Karnataka, India' },
      { names: ['udupi', 'manipal'], lat: 13.3408, lng: 74.7421, fullName: 'Udupi Town Plaza, Karnataka, India' },
      { names: ['bantwal', 'farangipete'], lat: 12.8985, lng: 75.0392, fullName: 'Bantwal Junction, Karnataka, India' },
      { names: ['puttur', 'kabaka'], lat: 12.7230, lng: 75.2030, fullName: 'Puttur City Center, Karnataka, India' },
      { names: ['sullia', 'gundia'], lat: 12.5562, lng: 75.3900, fullName: 'Sullia Region, Karnataka, India' },
      { names: ['suratkal', 'surathkal', 'nitk'], lat: 13.0083, lng: 74.7958, fullName: 'Surathkal Port, Karnataka, India' },
      { names: ['kinnigoli', 'kinnigoly'], lat: 13.0841, lng: 74.8560, fullName: 'Kinnigoli Suburb, Dakshina Kannada, India' },
      { names: ['kateel', 'temple'], lat: 13.0232, lng: 74.8465, fullName: 'Kateel Suburb, Dakshina Kannada, India' },
      { names: ['mulki', 'mulky'], lat: 13.0970, lng: 74.7960, fullName: 'Mulki Coastal Belt, Dakshina Kannada, India' },
      { names: ['bajpe', 'airport', 'ixe'], lat: 12.9644, lng: 74.8821, fullName: 'Bajpe Airport Sector, Karnataka, India' },
      { names: ['gurupura'], lat: 12.9490, lng: 74.9376, fullName: 'Gurupura, Dakshina Kannada, India' },
      { names: ['belthangady', 'dharmasthala'], lat: 13.0012, lng: 75.3015, fullName: 'Belthangady Forest Belt, Karnataka, India' }
    ];

    const match = presets.find(p => p.names.some(name => q.includes(name) || name.includes(q)));
    if (match) {
      const newLoc = { lat: match.lat, lng: match.lng };
      setDetectedCoords(newLoc);
      setSearchStatus('success');
      setSearchMsg(match.fullName);
      
      if (onUpdateUserLocation) {
        onUpdateUserLocation(newLoc);
      }
      
      onAddEvent({
        phcId: null,
        type: 'system',
        content: `DASHBOARD GEOLOCATION: Located local query match "${query}" mapped to preset "${match.fullName}" [${match.lat}° N, ${match.lng}° E].`,
        source: 'Local Dictionary Match'
      });
    } else {
      setSearchStatus('error');
      setSearchMsg(language === 'hi' ? 'स्थान नहीं मिला। "अक्षांश, देशांतर" दर्ज करें।' : 'Location not recognized. Try entering exact coordinates "lat, lng" or a Dakshina Kannada town.');
    }
  };

  const handleManualLocationSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualQuery.trim()) return;

    setSearchStatus('searching');
    setSearchMsg(language === 'hi' ? 'सक्रिय खोज...' : 'Searching location...');

    // 1. Check if it is coordinates: "12.914, 74.856"
    const coordRegex = /^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/;
    const match = manualQuery.trim().match(coordRegex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[3]);
      const newLoc = { lat, lng };
      setDetectedCoords(newLoc);
      setSearchStatus('success');
      setSearchMsg(language === 'hi' ? 'मैन्युअल निर्देशांक लागू!' : 'Manual coordinates updated!');
      
      if (onUpdateUserLocation) {
        onUpdateUserLocation(newLoc);
      }
      
      onAddEvent({
        phcId: null,
        type: 'system',
        content: `DASHBOARD GEOLOCATION: Manually adjusted GPS base position to precise input [${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E].`,
        source: 'Manual Coordinates Entry'
      });
      return;
    }

    // 2. Try Google Maps Geocoder if loaded
    if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: manualQuery }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            const lat = loc.lat();
            const lng = loc.lng();
            const newLoc = { lat, lng };
            setDetectedCoords(newLoc);
            setSearchStatus('success');
            setSearchMsg(results[0].formatted_address);
            
            if (onUpdateUserLocation) {
              onUpdateUserLocation(newLoc);
            }
            
            onAddEvent({
              phcId: null,
              type: 'system',
              content: `DASHBOARD GEOLOCATION: Resolved "${manualQuery}" via Google Geocoder to [${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E] (${results[0].formatted_address}).`,
              source: 'Google Geocoder Search'
            });
          } else {
            runLocalNameFallback(manualQuery);
          }
        });
      } catch (err) {
        console.warn("Geocoder search crash, trying local matching:", err);
        runLocalNameFallback(manualQuery);
      }
    } else {
      runLocalNameFallback(manualQuery);
    }
  };

  const handleAutoDetectLocation = () => {
    setGeoLoading(true);
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError(language === 'hi' ? 'आपका ब्राउज़र जियोलोकेशन का समर्थन नहीं करता है।' : 'Your browser does not support geolocation.');
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        let lat = position.coords.latitude;
        let lng = position.coords.longitude;
        
        // Bounding box of India: Latitude 8.0 N to 38.0 N, Longitude 68.0 E to 98.0 E
        const isOutsideIndia = lat < 8.0 || lat > 38.0 || lng < 68.0 || lng > 98.0;
        
        if (isOutsideIndia) {
          // Dev sandbox or foreign location - fall back to Dakshina Kannada Hub (Mangaluru)
          lat = 12.9141;
          lng = 74.8560;
          const warningTitle = language === 'hi' ? 'जीपीएस पुनः निर्देशित' : 'GPS Redirected';
          const warningMsg = language === 'hi' 
            ? 'डिवाइस जीपीएस स्थान मुख्य क्षेत्र से बाहर पाया गया। सुरक्षा के लिए मैंगलोर क्षेत्रीय हब पर पुनः निर्देशित किया गया।' 
            : 'Device GPS resolved outside Indian coverage zone (e.g. US Sandbox). Redirected to Mangaluru Regional Hub.';
          
          triggerLocalToast(warningTitle, warningMsg, 'info');
          showToastNative(warningTitle, warningMsg, 'info');
          if (showToast) {
            showToast(warningTitle, warningMsg, 'info');
          }
        }
        
        const newLoc = { lat, lng };
        setDetectedCoords(newLoc);
        setGeoLoading(false);
        
        // Sync with parent state so other views benefit too
        if (onUpdateUserLocation) {
          onUpdateUserLocation(newLoc);
        } else if (onAutoLocate) {
          onAutoLocate();
        }
        
        onAddEvent({
          phcId: null,
          type: 'system',
          content: `DASHBOARD GEOLOCATION: Successfully verified device GPS position at [${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E].`,
          source: 'Dashboard Overview Geolocation'
        });
      },
      (error) => {
        console.error("Dashboard Geolocation Error:", error);
        let errorMsg = language === 'hi' ? 'स्थान अनुमति अस्वीकृत या उपलब्ध नहीं है।' : 'Location access denied or unavailable.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = language === 'hi' ? 'स्थान अनुमति अस्वीकृत। कृपया ब्राउज़र सेटिंग्स में अनुमति दें।' : 'Location permission denied. Please allow location access in your browser settings.';
        }
        setGeoError(errorMsg);
        setGeoLoading(false);
        
        // Fallback to random preset town center to keep it functional and delightful
        const randomPreset = [
          { name: 'Mangalore Central Warehouse', lat: 12.9141, lng: 74.8560 },
          { name: 'Udupi Town Plaza', lat: 13.3408, lng: 74.7421 },
          { name: 'Bantwal Junction', lat: 12.8985, lng: 75.0392 },
          { name: 'Puttur City Center', lat: 12.7230, lng: 75.2030 }
        ][Math.floor(Math.random() * 4)];
        
        setDetectedCoords({ lat: randomPreset.lat, lng: randomPreset.lng });
        if (onUpdateUserLocation) {
          onUpdateUserLocation({ lat: randomPreset.lat, lng: randomPreset.lng });
        }
        
        onAddEvent({
          phcId: null,
          type: 'alert',
          content: `DASHBOARD GEOLOCATION: Permission denied. Activated fallback baseline hub ${randomPreset.name} (${randomPreset.lat.toFixed(4)}° N, ${randomPreset.lng.toFixed(4)}° E).`,
          source: 'Dashboard Overview'
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Speech recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionSession, setRecognitionSession] = useState<any>(null);

  const handleToggleRecord = () => {
    if (isRecording) {
      if (recognitionSession) {
        recognitionSession.stop();
      }
      setIsRecording(false);
    } else {
      setIsRecording(true);
      const session = startSpeechToText(
        language,
        (transcript) => {
          setReportText(transcript);
          // Auto process transcript with A.I. to save clicks!
          onAddEvent({
            phcId: 'PHC_002',
            type: 'system',
            content: `Voice report captured: "${transcript}"`,
            source: 'Voice Recognition Engine'
          });
        },
        () => {
          setIsRecording(false);
        },
        (errorMsg) => {
          showToastNative("Speech Error", `${TRANSLATIONS[language].micError}: ${errorMsg}`, "warning");
          setIsRecording(false);
        }
      );
      setRecognitionSession(session);
    }
  };

  const showToastNative = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    onAddEvent({
      phcId: 'PHC_002',
      type: type === 'warning' ? 'error' : 'system',
      content: `[${title}] ${message}`,
      source: 'System Dashboard'
    });
  };

  // Form states for Add / Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [batchId, setBatchId] = useState('');
  const [stockVal, setStockVal] = useState('');
  const [unitVal, setUnitVal] = useState('Units');

  const [sideItemName, setSideItemName] = useState('');
  const [sideBatchId, setSideBatchId] = useState(`BN-${Math.floor(1000 + Math.random() * 9000)}`);
  const [sideStockVal, setSideStockVal] = useState('');
  const [sideUnitVal, setSideUnitVal] = useState('Units');

  const handleSideFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sideItemName.trim() || !sideBatchId.trim() || !sideStockVal.trim()) return;

    const parsedStock = parseInt(sideStockVal) || 0;
    onAddInventory({
      name: sideItemName,
      batchId: sideBatchId,
      stock: parsedStock,
      unit: sideUnitVal,
    });

    // Reset sideForm states
    setSideItemName('');
    setSideBatchId(`BN-${Math.floor(1000 + Math.random() * 9000)}`);
    setSideStockVal('');
    setSideUnitVal('Units');

    showToastNative("Medicine Registered", `${sideItemName} successfully added to the health center inventory system.`, "success");
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setItemName('');
    setBatchId(`BN-${Math.floor(1000 + Math.random() * 9000)}`);
    setStockVal('');
    setUnitVal('Units');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setBatchId(item.batchId);
    setStockVal(item.stock.toString());
    setUnitVal(item.unit);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !batchId.trim() || !stockVal.trim()) return;

    const parsedStock = parseInt(stockVal) || 0;

    if (editingItem) {
      onEditInventory({
        ...editingItem,
        name: itemName,
        batchId: batchId,
        stock: parsedStock,
        unit: unitVal,
      });
      
      const successTitle = language === 'hi' ? 'विवरण अद्यतित' : 'Medicine Updated';
      const successMsg = language === 'hi' 
        ? `${itemName} के विवरण सफलतापूर्वक अपडेट किए गए हैं।` 
        : `Successfully updated details for ${itemName}.`;

      triggerLocalToast(successTitle, successMsg, "success");
      if (showToast) {
        showToast(successTitle, successMsg, "success");
      }
    } else {
      onAddInventory({
        name: itemName,
        batchId: batchId,
        stock: parsedStock,
        unit: unitVal,
      });

      const successTitle = language === 'hi' ? 'दवा जोड़ी गई' : 'Medicine Added';
      const successMsg = language === 'hi' 
        ? `${itemName} को सफलतापूर्वक स्वास्थ्य केंद्र इन्वेंटरी में जोड़ा गया।` 
        : `Successfully added ${itemName} to the health center inventory.`;

      triggerLocalToast(successTitle, successMsg, "success");
      if (showToast) {
        showToast(successTitle, successMsg, "success");
      }
    }

    // Reset/Clear all form fields as requested
    setItemName('');
    setBatchId(`BN-${Math.floor(1000 + Math.random() * 9000)}`);
    setStockVal('');
    setUnitVal('Units');
    setEditingItem(null);

    setIsFormOpen(false);
  };

  // Derive counts and stats
  const paracetamolItem = inventory.find(item => item.name.toLowerCase().includes('paracetamol'));
  const antiVenomItem = inventory.find(item => item.name.toLowerCase().includes('venom'));

  const paracetamolStock = paracetamolItem ? paracetamolItem.stock : 500;
  const antiVenomStock = antiVenomItem ? antiVenomItem.stock : 25;

  const activeDocs = doctors.filter(doc => doc.status === 'Active').length;
  const totalDocs = doctors.length;

  // Handle report submission to backend AI agent
  const handleProcessReport = async () => {
    if (!reportText.trim()) return;

    setIsProcessing(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setExtractedData(null);

    try {
      const response = await fetch('/api/extract-logistics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process report');
      }

      setExtractedData(data);

      const centerId = data.health_center_id;
      const updates = data.updates || {};
      const medicine = updates.medicine_name;
      const qtyUsed = Number(updates.quantity_used) || 0;
      const docPresent = updates.doctor_present;

      if (!centerId) {
        // Warning/Anomalous Case: No Health Center ID extracted
        const failMessage = `Failed Update: No Health Center ID provided in report. Data was ignored.`;
        onAddEvent({
          phcId: null,
          type: 'error',
          content: `Failed Update: Missing Health Center ID in report: "${reportText.slice(0, 45)}..."`,
          source: 'AI Text Parser'
        });
        setErrorMessage('Unrecognized or missing Health Center ID in the text report.');
      } else if (centerId !== 'PHC_002') {
        // Station is not PHC_002 (e.g., Regional Admin logs it, but local PHC_002 inventory stays unchanged)
        const successLog = `${centerId}: ${medicine ? medicine.replace('_', ' ') : 'General updates'} processed. Consumed: ${qtyUsed}. Doctor present: ${docPresent !== null ? (docPresent ? 'Yes' : 'No') : 'Unspecified'}`;
        
        onAddEvent({
          phcId: centerId,
          type: centerId === 'PHC_999' ? 'error' : 'inventory',
          content: centerId === 'PHC_999' 
            ? `Failed Update: Unrecognized Health Center ID 'PHC_999' submitted in text report.`
            : `${centerId}: ${medicine ? medicine.replace('_', ' ') : 'logistics'} updated. Used: ${qtyUsed}. Dr: ${docPresent !== null ? (docPresent ? 'On-duty' : 'Absent') : 'N/A'}.`,
          source: 'AI Text Parser'
        });

        if (centerId === 'PHC_999') {
          setErrorMessage("Failed Update: Unrecognized Health Center ID 'PHC_999' submitted.");
        } else {
          setSuccessMessage(`Successfully processed report for external health center: ${centerId}! Local inventory remains unchanged, regional records updated.`);
        }
      } else {
        // Local Update for PHC_002!
        let medUpdatedName = '';
        if (medicine === 'paracetamol_stock' && paracetamolItem) {
          onUpdateInventory(paracetamolItem.id, qtyUsed);
          medUpdatedName = 'Paracetamol';
        } else if (medicine === 'anti_venom_stock' && antiVenomItem) {
          onUpdateInventory(antiVenomItem.id, qtyUsed);
          medUpdatedName = 'Anti-Venom';
        }

        if (docPresent !== null) {
          onUpdateDoctorAttendance(docPresent);
        }

        // Add a successful parsing log
        let contentLog = `PHC_002: `;
        if (medicine && qtyUsed > 0) {
          contentLog += `${medUpdatedName} stock reduced by ${qtyUsed} units. Current Stock: ${
            medicine === 'paracetamol_stock' ? paracetamolStock - qtyUsed : antiVenomStock - qtyUsed
          }. `;
        }
        if (docPresent !== null) {
          contentLog += `Dr Attendance updated to: ${docPresent ? 'Active Duty' : 'Off Duty'}.`;
        }
        if (!medicine && docPresent === null) {
          contentLog += `General report received. No changes detected.`;
        }

        onAddEvent({
          phcId: 'PHC_002',
          type: 'inventory',
          content: contentLog,
          source: 'AI Text Parser'
        });

        setSuccessMessage('Successfully parsed and applied update to PHC_002 Local Inventory and Attendance!');
        setReportText('');
      }

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred during parsing.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectExample = (text: string) => {
    setReportText(text);
  };

  if (isSimpleMode) {
    const isDocPresent = doctors[0]?.status === 'Active';
    
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Simple Mode Layman Welcome Banner */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Accessibility className="w-7 h-7 text-emerald-400 animate-pulse" />
              {currentTrans.simpleMode} (आसान इंटरफ़ेस)
            </h2>
            <p className="text-sm text-blue-100 max-w-2xl font-medium">
              {currentTrans.laymanWelcome}
            </p>
          </div>
          <button
            onClick={() => {
              speakText(currentTrans.laymanWelcome, language);
            }}
            className="self-start md:self-auto bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 border border-white/25 transition-all cursor-pointer"
          >
            <Volume2 className="w-5 h-5" />
            {currentTrans.speakPage}
          </button>
        </section>

        {/* Simple Mode Add Medicine Option */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-5 rounded-3xl border-2 border-dashed border-slate-200/80 hover:border-emerald-500/50 transition-all duration-300 gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <Plus className="w-5 h-5 text-emerald-600 animate-pulse" />
            </span>
            <div>
              <h4 className="text-sm font-black text-slate-800">
                {language === 'hi' ? 'नई दवा जोड़ें' : 'Add New Medicine Stock'}
              </h4>
              <p className="text-xs text-slate-400 font-bold">
                {language === 'hi' ? 'नया चिकित्सा भंडार या दवाएं जोड़ने के लिए टैप करें' : 'Tap to register more medicine categories under tracking'}
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenAdd}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer border border-emerald-500"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'hi' ? 'दवा और जोड़ें (Add Medicine)' : 'Add More Medicine'}</span>
          </button>
        </div>

        {/* Big Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {inventory.map((item) => {
            const isLow = item.stock < (item.name.toLowerCase().includes('paracetamol') ? 450 : 10);
            const decAmount = item.unit === 'Vials' || item.unit === 'Boxes' ? 1 : 10;
            const incAmount = item.unit === 'Vials' || item.unit === 'Boxes' ? 5 : 50;

            const isVenom = item.name.toLowerCase().includes('venom');
            const borderStyle = isVenom ? 'border-emerald-100' : 'border-blue-100';
            const badgeStyle = isLow 
              ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' 
              : (isVenom ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200');

            const useLabel = language === 'hi' 
              ? `${decAmount} ${translateUnit(item.unit, language)} इस्तेमाल करें (Use ${decAmount})` 
              : `Use ${decAmount} ${translateUnit(item.unit, language)}`;

            const refillLabel = language === 'hi' 
              ? `${incAmount} ${translateUnit(item.unit, language)} जोड़ें (Refill ${incAmount})` 
              : `Refill ${incAmount} ${translateUnit(item.unit, language)}`;

            return (
              <div 
                key={item.id} 
                className={`bg-white p-8 rounded-3xl border-3 ${borderStyle} shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[250px]`}
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-extrabold text-slate-800">{translateMedicine(item.name, language)}</span>
                    <span className={`text-xs px-3.5 py-1 rounded-full font-bold tracking-wider border ${badgeStyle}`}>
                      {isLow ? currentTrans.lowStock : currentTrans.optimal}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-6xl font-black tracking-tight text-slate-950">{item.stock}</span>
                    <span className="text-lg text-slate-500 font-bold uppercase">{translateUnit(item.unit, language)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-semibold">
                    {item.name.toLowerCase().includes('paracetamol') ? (
                      language === 'hi' ? 'क्षमता सीमा: १००० इकाइयां' : 
                      'Capacity limit: 1000 Units'
                    ) : (
                      language === 'hi' 
                        ? `महत्वपूर्ण चेतावनी स्तर: ${decAmount * 2} ${translateUnit(item.unit, language)}` 
                        : `Critical minimum: ${decAmount * 2} ${translateUnit(item.unit, language)}`
                    )}
                  </p>
                </div>
                
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      onUpdateInventory(item.id, decAmount);
                      speakText(`${translateMedicine(item.name, language)} -${decAmount}. ${currentTrans.stockLevel}: ${item.stock - decAmount}`, language);
                    }}
                    disabled={item.stock < decAmount}
                    className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 py-3.5 rounded-2xl font-black text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {useLabel}
                  </button>
                  <button
                    onClick={() => {
                      onUpdateInventory(item.id, -incAmount);
                      speakText(`${translateMedicine(item.name, language)} +${incAmount}. ${currentTrans.stockLevel}: ${item.stock + incAmount}`, language);
                    }}
                    className={`flex-1 ${isVenom ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-emerald-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-200'} py-3.5 rounded-2xl font-black text-sm shadow-sm transition-all active:scale-95 cursor-pointer`}
                  >
                    {refillLabel}
                  </button>
                </div>

                {/* Custom quick refill and use action with numeric input for better UX */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-500 pl-1">
                      {language === 'hi' ? 'कस्टम संख्या:' : 'Custom amount:'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        id={`custom-amount-${item.id}`}
                        placeholder="10"
                        className="w-16 px-2 py-1 text-xs text-center border border-slate-200 focus:border-blue-500 focus:outline-none rounded-xl font-bold bg-white text-slate-800"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value) || 0;
                            if (val > 0) {
                              onUpdateInventory(item.id, -val);
                              speakText(`${translateMedicine(item.name, language)} +${val}. ${currentTrans.stockLevel}: ${item.stock + val}`, language);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const inputEl = document.getElementById(`custom-amount-${item.id}`) as HTMLInputElement;
                          const val = parseInt(inputEl?.value || '') || 0;
                          if (val > 0) {
                            if (item.stock < val) {
                              alert(language === 'hi' ? 'पर्याप्त स्टॉक नहीं है!' : 'Not enough stock!');
                              return;
                            }
                            onUpdateInventory(item.id, val);
                            speakText(`${translateMedicine(item.name, language)} -${val}. ${currentTrans.stockLevel}: ${item.stock - val}`, language);
                            if (inputEl) inputEl.value = '';
                          }
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        {language === 'hi' ? 'उपयोग' : 'Use'}
                      </button>
                      <button
                        onClick={() => {
                          const inputEl = document.getElementById(`custom-amount-${item.id}`) as HTMLInputElement;
                          const val = parseInt(inputEl?.value || '') || 0;
                          if (val > 0) {
                            onUpdateInventory(item.id, -val);
                            speakText(`${translateMedicine(item.name, language)} +${val}. ${currentTrans.stockLevel}: ${item.stock + val}`, language);
                            if (inputEl) inputEl.value = '';
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        {language === 'hi' ? 'जोड़ें' : 'Refill'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Big Doctor Status Section */}
        <div className="bg-white p-8 rounded-3xl border-3 border-indigo-50 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800">{currentTrans.doctorStatus}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {language === 'hi' ? 'उपस्थिति बदलने के लिए बड़े बटनों पर टैप करें' : 
                 language === 'ta' ? 'வருகையை மாற்ற பெரிய பொத்தான்களைத் தட்டவும்' :
                 language === 'te' ? 'హాజరును మార్చడానికి పెద్ద బటన్లపై నొక్కండి' :
                 language === 'kn' ? 'ಹಾಜರಾತಿಯನ್ನು ಬದಲಾಯಿಸಲು ದೊಡ್ಡ ಬಟನ್‌ಗಳನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ' :
                 language === 'ml' ? 'ഹാജർ നില മാറ്റാൻ വലിയ ബട്ടണുകളിൽ ടാപ്പ് ചെയ്യുക' :
                 language === 'bn' ? 'উপস্থিতি পরিবর্তন করতে বড় বোতামগুলিতে আলতো চাপুন' :
                 language === 'mr' ? 'हजेरी बदलण्यासाठी मोठ्या बटनांवर टॅप करा' :
                 language === 'gu' ? 'હાજરી બદલવા માટે મોટા બટનો પર ટેપ કરો' :
                 language === 'pa' ? 'ਹਾਜ਼ਰੀ ਬਦਲਣ ਲਈ ਵੱਡੇ ਬਟਨਾਂ \'ਤੇ ਟੈਪ ਕਰੋ' :
                 'Tap the big buttons to change attendance'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isDocPresent ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-2xl font-extrabold text-xs flex items-center gap-2 animate-bounce">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  {currentTrans.onDutyText}
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-2xl font-extrabold text-xs flex items-center gap-2 animate-pulse">
                  <XCircle className="w-5 h-5 text-rose-500" />
                  {currentTrans.offDutyText}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                onUpdateDoctorAttendance(true);
                speakText(currentTrans.doctorTTSActive, language);
              }}
              className={`flex-1 py-5 rounded-3xl font-black text-sm flex flex-col items-center justify-center gap-2 border-3 transition-all cursor-pointer ${
                isDocPresent 
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20 scale-102' 
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-8 h-8" />
              <span>
                {language === 'hi' ? 'डॉक्टर उपस्थित (Doctor Present)' : 
                 language === 'ta' ? 'மருத்துவர் இருக்கிறார் (Doctor Present)' :
                 language === 'te' ? 'వైద్యులు ఉన్నారు (Doctor Present)' :
                 language === 'kn' ? 'ವೈದ್ಯರು ಹಾಜರಿದ್ದಾರೆ (Doctor Present)' :
                 language === 'ml' ? 'ഡോക്ടർ ഉണ്ട് (Doctor Present)' :
                 language === 'bn' ? 'ডাক্তার উপস্থিত (Doctor Present)' :
                 language === 'mr' ? 'डॉक्टर उपस्थित (Doctor Present)' :
                 language === 'gu' ? 'ડોક્ટર હાજર (Doctor Present)' :
                 language === 'pa' ? 'ਡਾਕਟਰ ਹਾਜ਼ਰ (Doctor Present)' :
                 'Doctor Present'}
              </span>
            </button>
            <button
              onClick={() => {
                onUpdateDoctorAttendance(false);
                speakText(currentTrans.doctorTTSAbsent, language);
              }}
              className={`flex-1 py-5 rounded-3xl font-black text-sm flex flex-col items-center justify-center gap-2 border-3 transition-all cursor-pointer ${
                !isDocPresent 
                  ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20 scale-102' 
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <XCircle className="w-8 h-8" />
              <span>
                {language === 'hi' ? 'डॉक्टर अनुपस्थित (Doctor Absent)' : 
                 language === 'ta' ? 'மருத்துவர் வரவில்லை (Doctor Absent)' :
                 language === 'te' ? 'వైద్యులు లేరు (Doctor Absent)' :
                 language === 'kn' ? 'ವೈದ್ಯರು ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ (Doctor Absent)' :
                 language === 'ml' ? 'ഡോക്ടർ ഇല്ല (Doctor Absent)' :
                 language === 'bn' ? 'ডাক্তার অনুপস্থিত (Doctor Absent)' :
                 language === 'mr' ? 'डॉक्टर अनुपस्थित (Doctor Absent)' :
                 language === 'gu' ? 'ડોક્ટર ગેરહાજર (Doctor Absent)' :
                 language === 'pa' ? 'ਡਾਕਟਰ ਗੈਰ-ਹਾਜ਼ਰ (Doctor Absent)' :
                 'Doctor Absent'}
              </span>
            </button>
          </div>
        </div>

        {/* Big voice report section */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Mic className="w-40 h-40" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </span>
              <h3 className="text-xl font-extrabold">{currentTrans.voiceReport}</h3>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl font-semibold mb-6">
              {currentTrans.voiceReportDesc}
            </p>

            <div className="flex flex-col md:flex-row items-stretch gap-6">
              {/* Giant Record Button */}
              <button
                onClick={handleToggleRecord}
                className={`flex flex-col items-center justify-center p-6 rounded-3xl border-3 shadow-xl transition-all duration-300 cursor-pointer min-w-[200px] ${
                  isRecording 
                    ? 'bg-rose-600 text-white border-rose-500 animate-pulse scale-105' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 hover:scale-102'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-12 h-12 mb-3 text-white" />
                    <span className="font-extrabold text-sm">{currentTrans.micActive}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-12 h-12 mb-3 text-white animate-bounce" />
                    <span className="font-extrabold text-sm">{currentTrans.micIdle}</span>
                  </>
                )}
              </button>

              <div className="flex-1 flex flex-col justify-between">
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full bg-slate-800/80 border-2 border-slate-700 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none resize-none font-bold min-h-[100px]"
                  placeholder={currentTrans.textReportPlaceholder}
                />
                
                <div className="mt-3 flex gap-3 flex-wrap">
                  <button
                    onClick={handleProcessReport}
                    disabled={isProcessing || !reportText.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-extrabold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{currentTrans.processingAi}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>A.I. {currentTrans.submitReport}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setReportText('');
                      setSuccessMessage(null);
                      setErrorMessage(null);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-2xl font-bold text-sm transition-all cursor-pointer"
                  >
                    {currentTrans.clear}
                  </button>
                </div>
              </div>
            </div>

            {/* AI Status Response Message */}
            {successMessage && (
              <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center gap-3 animate-fade-in text-sm font-bold">
                <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                <span>{currentTrans.successParse} ({successMessage})</span>
              </div>
            )}

            {errorMessage && (
              <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3 animate-fade-in text-sm font-bold">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                <span>{currentTrans.failedParse} ({errorMessage})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats Header */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">{translateUI('inventoryOverview', language)}</h2>
            <p className="text-xs text-slate-500 font-medium">{translateUI('operationalStatus', language)}</p>
          </div>
          <div className="mt-2 md:mt-0 flex gap-2">
            <button
              onClick={handleOpenAdd}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl border border-emerald-500 shadow-sm transition-all flex items-center gap-1.5 font-bold cursor-pointer"
              id="add-medicine-standard-btn"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'hi' ? 'दवा और जोड़ें' : 'Add Medicine'}</span>
            </button>
            <button 
              onClick={() => onNavigateToTab('updates')} 
              className="text-xs bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 font-semibold cursor-pointer"
            >
              <ClipboardList className="w-4 h-4 text-slate-500" />
              {translateUI('viewAdminLogs', language)}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stat Card 1: Paracetamol */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between min-h-[175px]">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={`p-2.5 rounded-xl flex items-center justify-center shadow-sm ${paracetamolStock < 450 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wider ${paracetamolStock < 450 ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                  {translateStatus(paracetamolStock < 450 ? 'LOW STOCK' : 'OPTIMAL', language)}
                </span>
              </div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{currentTrans.paracetamol}</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-slate-800">{paracetamolStock}</span>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{translateUnit('Units', language)}</span>
              </div>
            </div>
            <div>
              <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                <div 
                  className={`h-full transition-all duration-500 ${paracetamolStock < 450 ? 'bg-rose-500' : 'bg-blue-600'}`} 
                  style={{ width: `${Math.min(100, (paracetamolStock / 1000) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-2">{translateUI('capacityLimit', language)}</p>
            </div>
          </div>

          {/* Stat Card 2: Anti-Venom */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between min-h-[175px]">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={`p-2.5 rounded-xl flex items-center justify-center shadow-sm ${antiVenomStock < 10 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                  <Activity className="w-5 h-5" />
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wider ${antiVenomStock < 10 ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                  {translateStatus(antiVenomStock < 10 ? 'LOW STOCK' : 'OPTIMAL', language)}
                </span>
              </div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{currentTrans.antiVenom}</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-slate-800">{antiVenomStock}</span>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{translateUnit('Vials', language)}</span>
              </div>
            </div>
            <div>
              <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                <div 
                  className={`h-full transition-all duration-500 ${antiVenomStock < 10 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                  style={{ width: `${Math.min(100, (antiVenomStock / 50) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-2">{translateUI('criticalMinimum', language)}</p>
            </div>
          </div>

          {/* Stat Card 3: Doctor Attendance */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between min-h-[175px]">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="p-2.5 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                  <HelpCircle className="w-5 h-5" />
                </span>
                <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full font-bold tracking-wider animate-pulse">
                  {translateStatus('active', language).toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{currentTrans.doctorStatus}</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-slate-800">{activeDocs} / {totalDocs}</span>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{translateStatus('active', language)}</span>
              </div>
            </div>
            <div>
              <div className="mt-4 flex gap-2">
                {doctors.map((doc) => (
                  <div 
                    key={doc.id}
                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                      doc.status === 'Active' ? 'bg-blue-600' : 'bg-slate-100 border border-slate-200'
                    }`}
                    title={`${translateDoctorName(doc.name, language)}: ${translateStatus(doc.status, language)}`}
                  ></div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-2">{translateUI('clickStaffAttendance', language)}</p>
            </div>
          </div>
        </div>
      </section>



      {/* Bento Layout Main Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Stock Table Section */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-800">{translateUI('liveTracking', language)}</h3>
              <p className="text-xs text-slate-500 font-medium">{translateUI('batchRecords', language)}</p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'hi' ? 'खोजें...' : 'Search...'}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-white outline-none transition-all w-28 sm:w-36 font-semibold text-slate-700"
                />
              </div>
              <button 
                onClick={handleOpenAdd}
                className="text-xs text-white bg-blue-600 hover:bg-blue-700 font-bold flex items-center gap-1.5 rounded-xl px-3.5 py-2 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {translateUI('addMedicine', language)}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{translateUI('itemName', language)}</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">{translateUI('batchId', language)}</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">{translateUI('stock', language)}</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">{translateUI('status', language)}</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-right">{translateUI('actions', language)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory
                  .filter((item) => 
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    item.batchId.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <span className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                            <Layers className="w-4 h-4" />
                          </span>
                          <span className="text-sm font-bold text-slate-800">{translateMedicine(item.name, language)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-center text-xs text-slate-500 font-mono font-medium">{item.batchId}</td>
                      <td className="px-6 py-4.5 text-center text-sm font-extrabold text-slate-800">{item.stock} {translateUnit(item.unit, language)}</td>
                      <td className="px-6 py-4.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          item.stock < (item.name.includes('Para') ? 450 : 10)
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.stock < (item.name.includes('Para') ? 450 : 10) ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                          }`}></span>
                          {translateStatus(item.stock < (item.name.includes('Para') ? 450 : 10) ? 'Low Stock' : 'Optimal', language)}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Quick stock adjustment actions for better UX */}
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl mr-2">
                            <button
                              onClick={() => {
                                const amount = item.unit === 'Vials' || item.unit === 'Boxes' ? 5 : 50;
                                onUpdateInventory(item.id, amount);
                                onAddEvent({
                                  phcId: 'PHC_002',
                                  type: 'inventory',
                                  content: `QUICK USE: Consumed ${amount} ${translateUnit(item.unit, language)} of ${item.name}.`,
                                  source: 'Quick Dashboard Action'
                                });
                              }}
                              disabled={item.stock < (item.unit === 'Vials' || item.unit === 'Boxes' ? 5 : 50)}
                              className="px-1.5 py-1 text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 rounded-md transition-all cursor-pointer"
                              title={`Use ${item.unit === 'Vials' || item.unit === 'Boxes' ? 5 : 50}`}
                            >
                              -{item.unit === 'Vials' || item.unit === 'Boxes' ? 5 : 50}
                            </button>
                            <button
                              onClick={() => {
                                const amount = item.unit === 'Vials' || item.unit === 'Boxes' ? 5 : 50;
                                onUpdateInventory(item.id, -amount);
                                onAddEvent({
                                  phcId: 'PHC_002',
                                  type: 'inventory',
                                  content: `QUICK REFILL: Added ${amount} ${translateUnit(item.unit, language)} of ${item.name}.`,
                                  source: 'Quick Dashboard Action'
                                });
                              }}
                              className="px-1.5 py-1 text-[10px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-all cursor-pointer"
                              title={`Refill ${item.unit === 'Vials' || item.unit === 'Boxes' ? 5 : 50}`}
                            >
                              +{item.unit === 'Vials' || item.unit === 'Boxes' ? 5 : 50}
                            </button>
                          </div>

                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        <button 
                          onClick={() => onDeleteInventory(item.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Updates Section */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 p-6 rounded-3xl text-slate-300 relative overflow-hidden group border border-slate-800 shadow-xl">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                {translateUI('emergencyAlert', language).toUpperCase()}
              </div>
              <h4 className="text-base font-bold text-white mb-1.5">{translateUI('weatherAdvisory', language)}</h4>
              <p className="text-xs leading-relaxed text-slate-400 mb-4">
                {translateUI('weatherAdvisoryDesc', language)}
              </p>
              <button 
                onClick={() => alert("Standard Protocol for Severe Weather Outbreak:\n1. Ensure Paracetamol stock is above 500 units.\n2. Put on alert extra guest general physician shifts.\n3. Prepare medical mask counts.")}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold underline underline-offset-4 cursor-pointer"
              >
                {translateUI('viewProtocols', language)}
              </button>
            </div>
            <Activity className="absolute -right-4 -bottom-4 w-28 h-28 opacity-5 group-hover:scale-110 transition-transform duration-500 text-white pointer-events-none" />
          </div>
        </aside>
      </div>

      {/* Add / Edit Inventory Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                  <Layers className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  {editingItem ? translateUI('editRecord', language) : translateUI('addMedicine', language)}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('itemName', language)}</label>
                <input 
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                  placeholder="e.g. Paracetamol 500mg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('batchId', language)}</label>
                  <input 
                    type="text"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 font-mono"
                    placeholder="e.g. BN-4482"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('unitTypology', language)}</label>
                  <select 
                    value={unitVal}
                    onChange={(e) => setUnitVal(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Units">{translateUnit('Units', language)}</option>
                    <option value="Vials">{translateUnit('Vials', language)}</option>
                    <option value="Pcs">{translateUnit('Pcs', language)}</option>
                    <option value="Tablets">{translateUnit('Tablets', language)}</option>
                    <option value="Boxes">{translateUnit('Boxes', language)}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('currentStockCount', language)}</label>
                <input 
                  type="number"
                  min="0"
                  value={stockVal}
                  onChange={(e) => setStockVal(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                  placeholder="e.g. 500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {translateUI('cancel', language)}
                </button>
                <button 
                  type="submit"
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-blue-100 cursor-pointer"
                >
                  {editingItem ? translateUI('saveUpdates', language) : translateUI('addItem', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Local Visual Toast Notification */}
      {localToast && (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-800 flex items-start gap-3 animate-in slide-in-from-bottom duration-300">
          <div className="flex-shrink-0 mt-0.5">
            {localToast.type === 'success' && <span className="text-emerald-400 text-base font-extrabold">✓</span>}
            {localToast.type === 'warning' && <span className="text-amber-400 text-base font-extrabold">⚠</span>}
            {localToast.type === 'info' && <span className="text-blue-400 text-base font-extrabold">ℹ</span>}
          </div>
          <div className="flex-1">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{localToast.title}</h4>
            <p className="text-xs font-semibold text-slate-200 mt-1">{localToast.message}</p>
          </div>
          <button 
            onClick={() => setLocalToast(null)}
            className="text-slate-400 hover:text-white font-extrabold text-sm ml-1 cursor-pointer outline-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
