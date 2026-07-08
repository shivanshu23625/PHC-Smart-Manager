import React, { useState } from 'react';
import { MatrixItem, ActivityEvent } from '../types';
import { 
  Truck, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  ChevronRight, 
  Loader2, 
  Search, 
  SlidersHorizontal,
  Navigation,
  Check,
  Bike,
  Plus,
  Edit,
  Trash2,
  Brain,
  CloudLightning,
  ShieldAlert,
  Volume2,
  XCircle,
  CheckCircle2,
  Sparkles,
  Accessibility
} from 'lucide-react';

import { Language, TRANSLATIONS, translateMedicine, translateUnit, translateStatus, translateRoadStatus, translateUI } from '../utils/translations';
import { speakText } from '../utils/audio';

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

interface MatrixViewProps {
  matrix: MatrixItem[];
  onUpdateMatrixStock: (phcId: string, addedStock: number) => void;
  onAddEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  onAddMatrix: (newItem: MatrixItem) => void;
  onEditMatrix: (editedItem: MatrixItem) => void;
  onDeleteMatrix: (phcId: string) => void;
  language: Language;
  isSimpleMode: boolean;
  userLocation: { lat: number; lng: number };
}

export default function MatrixView({
  matrix,
  onUpdateMatrixStock,
  onAddEvent,
  onAddMatrix,
  onEditMatrix,
  onDeleteMatrix,
  language,
  isSimpleMode,
  userLocation
}: MatrixViewProps) {
  // Shared & Local Matrix States
  const [selectedPhc, setSelectedPhc] = useState<MatrixItem | null>(matrix[0] || null);
  const [sendQuantity, setSendQuantity] = useState<string>('250');
  const [priority, setPriority] = useState<string>('Normal - Routine Supply');
  const [courier, setCourier] = useState<'A' | 'B'>('A');

  // Dispatch processing feedback state
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  // Predictive insights and weather simulation state
  const [matrixSubTab, setMatrixSubTab] = useState<'matrix' | 'predictive'>('matrix');
  const [simulationActive, setSimulationActive] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Local metric states
  const [activeDispatchesCount, setActiveDispatchesCount] = useState(156);
  const [criticalAlertsCount, setCriticalAlertsCount] = useState(12);

  // Form Modal States for adding/editing a station
  const [isPhcModalOpen, setIsPhcModalOpen] = useState(false);
  const [editingPhc, setEditingPhc] = useState<MatrixItem | null>(null);

  const [phcIdField, setPhcIdField] = useState('');
  const [phcNameField, setPhcNameField] = useState('');
  const [distanceField, setDistanceField] = useState('');
  const [roadStatusField, setRoadStatusField] = useState('Clear / Asphalt');
  const [itemNeededField, setItemNeededField] = useState('');
  const [qtyNeededField, setQtyNeededField] = useState('');
  const [contactField, setContactField] = useState('');
  const [coordsField, setCoordsField] = useState('');

  const handleOpenPhcAdd = () => {
    setEditingPhc(null);
    setPhcIdField(`PHC_00${matrix.length + 1}`);
    setPhcNameField('');
    setDistanceField('30 km');
    setRoadStatusField('Clear / Asphalt');
    setItemNeededField('Paracetamol Stock');
    setQtyNeededField('200');
    setContactField('Radio channel 4');
    setCoordsField('24.78° N, 89.21° E');
    setIsPhcModalOpen(true);
  };

  const handleOpenPhcEdit = (phc: MatrixItem) => {
    setEditingPhc(phc);
    setPhcIdField(phc.phcId);
    setPhcNameField(phc.name);
    setDistanceField(phc.distance || '30 km');
    setRoadStatusField(phc.roadStatus || 'Clear / Asphalt');
    setItemNeededField(phc.itemNeeded);
    setQtyNeededField((phc.qtyNeeded || 200).toString());
    setContactField(phc.contact || 'Radio channel 4');
    setCoordsField(phc.coordinates || '24.78° N, 89.21° E');
    setIsPhcModalOpen(true);
  };

  const handlePhcFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phcIdField.trim() || !phcNameField.trim() || !itemNeededField.trim()) return;

    const parsedQty = parseInt(qtyNeededField) || 0;
    // Stock Level is initially half of qty needed for newly added, or we can compute stock status
    const itemData: MatrixItem = {
      id: editingPhc ? editingPhc.id : phcIdField.trim(),
      phcId: phcIdField.trim(),
      name: phcNameField.trim(),
      distance: distanceField.trim(),
      roadStatus: roadStatusField,
      itemNeeded: itemNeededField.trim(),
      qtyNeeded: parsedQty,
      stockLevel: editingPhc ? editingPhc.stockLevel : Math.floor(parsedQty * 0.4),
      unit: itemNeededField.toLowerCase().includes('venom') ? 'Vials' : 'Units',
      status: editingPhc ? editingPhc.status : 'Low Stock',
      contact: contactField.trim(),
      coordinates: coordsField.trim(),
    };

    if (editingPhc) {
      onEditMatrix(itemData);
      if (selectedPhc?.phcId === itemData.phcId) {
        setSelectedPhc(itemData);
      }
    } else {
      onAddMatrix(itemData);
      setSelectedPhc(itemData);
    }

    setIsPhcModalOpen(false);
  };

  const handleSetSendQuantity = (val: string) => {
    setSendQuantity(val);
    const qty = Number(val) || 0;
    if (qty > 0) {
      if (qty <= 150) {
        setCourier('B');
      } else {
        setCourier('A');
      }
    }
  };

  const handleSimulateWeatherSpike = () => {
    setSimulationActive(true);

    const targets = [
      { 
        phcId: 'PHC_015', 
        risk: 'high_stock_out' as const, 
        prob: 94, 
        reason: "94% probability of Paracetamol & Anti-Venom stock-out in 48 hours due to regional monsoon storm trend and highway flooding.",
        status: "CRITICAL DEFICIT" as const
      },
      { 
        phcId: 'PHC_041', 
        risk: 'epidemic_spike' as const, 
        prob: 88, 
        reason: "88% probability of sudden Amoxicillin & insulin storage surge due to heavy water stagnation in local agricultural sectors.",
        status: "Low Stock" as const
      }
    ];

    targets.forEach(t => {
      const station = matrix.find(m => m.phcId === t.phcId);
      if (station) {
        onEditMatrix({
          ...station,
          predictiveRisk: t.risk,
          riskProbability: t.prob,
          riskReason: t.reason,
          roadStatus: "Flooded / Impassable",
          status: t.status
        });
      }
    });

    onAddEvent({
      phcId: null,
      type: 'alert',
      content: "METEOROLOGICAL SPARK: Seasonal monsoon weather spike simulated. Flagged PHC_015 & PHC_041 under critical predictive risk alert. National highways marked IMPASSABLE.",
      source: 'PREDICTIVE ANOMALY ENGINE'
    });

    // Update selected PHC if active
    if (selectedPhc) {
      const match = targets.find(t => t.phcId === selectedPhc.phcId);
      if (match) {
        setSelectedPhc({
          ...selectedPhc,
          predictiveRisk: match.risk,
          riskProbability: match.prob,
          riskReason: match.reason,
          roadStatus: "Flooded / Impassable",
          status: match.status
        });
      }
    }

    setTimeout(() => {
      setSimulationActive(false);
    }, 4000);
  };

  const filteredMatrix = matrix.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.itemNeeded.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.phcId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectPHC = (item: MatrixItem) => {
    setSelectedPhc(item);
    setDispatchSuccess(false);
  };

  const handleCreateShippingOrder = () => {
    if (!selectedPhc) return;
    const qty = Number(sendQuantity) || 0;
    if (qty <= 0) return;

    setIsDispatching(true);
    setDispatchSuccess(false);

    setTimeout(() => {
      // Execute local update to the matrix stock row
      onUpdateMatrixStock(selectedPhc.phcId, qty);
      
      // Reduce critical alerts count if we're dispatching to a deficit item
      if (selectedPhc.status === 'CRITICAL DEFICIT') {
        setCriticalAlertsCount(prev => Math.max(0, prev - 1));
      }

      // Add 1 to active dispatches
      setActiveDispatchesCount(prev => prev + 1);

      // Append Activity Log
      onAddEvent({
        phcId: selectedPhc.phcId,
        type: 'inventory',
        content: `CENTRAL DISPATCH: Initiated ${priority.split(' - ')[0]} shipment of ${qty} units of ${selectedPhc.itemNeeded} to ${selectedPhc.name} via Courier ${courier}. Estimated arrival: Within 24 hours.`,
        source: `Regional Hub Logistics`
      });

      setIsDispatching(false);
      setDispatchSuccess(true);
      setSendQuantity('');

      setTimeout(() => {
        setDispatchSuccess(false);
        // Refresh selected item from updated matrix state
        const updated = matrix.find(m => m.phcId === selectedPhc.phcId);
        if (updated) setSelectedPhc(updated);
      }, 2500);

    }, 1500);
  };

  if (isSimpleMode) {
    const currentTrans = TRANSLATIONS[language] || TRANSLATIONS['en'];
    
    // Speak full matrix summary
    const handleSpeakMatrix = () => {
      let criticalCenters = matrix.filter(m => m.status === 'CRITICAL DEFICIT').length;
      let msg = `Regional matrix. You have ${matrix.length} centers in the network. ${criticalCenters} are in critical stock deficit.`;
      if (language === 'hi') {
        msg = `क्षेत्रीय आपूर्ति ग्रिड। आपके नेटवर्क में कुल ${matrix.length} स्वास्थ्य केंद्र हैं, जिनमें से ${criticalCenters} गंभीर कमी का सामना कर रहे हैं।`;
      } else if (language === 'ta') {
        msg = `பிராந்திய விநியோக கட்டம். உங்கள் நெட்வொர்க்கில் மொத்தம் ${matrix.length} சுகாதார நிலையங்கள் உள்ளன, அதில் ${criticalCenters} கடுமையான பற்றாக்குறையை எதிர்கொள்கின்றன.`;
      }
      speakText(msg, language);
    };

    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Simple Mode Welcome / Speak Banner */}
        <section className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Accessibility className="w-7 h-7 text-indigo-300 animate-pulse" />
              {currentTrans.matrix}
            </h2>
            <p className="text-sm text-blue-100 max-w-2xl font-medium">
              {translateUI('simpleMatrixDesc', language)}
            </p>
          </div>
          <button
            onClick={handleSpeakMatrix}
            className="self-start md:self-auto bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 border border-white/25 transition-all cursor-pointer"
          >
            <Volume2 className="w-5 h-5 animate-bounce" />
            {translateUI('listenReport', language)}
          </button>
        </section>

        {/* Mini stats cards & Weather simulation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-rose-50 border-2 border-rose-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-500 text-white rounded-xl">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black text-rose-500 uppercase tracking-wider">{translateUI('deficitAlerts', language)}</p>
              <h4 className="text-2xl font-black text-slate-800">{matrix.filter(m => m.status === 'CRITICAL DEFICIT' || m.stockLevel < 50).length} {translateUI('stations', language)}</h4>
            </div>
          </div>

          <div className="bg-emerald-50 border-2 border-emerald-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500 text-white rounded-xl">
              <Truck className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-600 uppercase tracking-wider">{translateUI('activeDispatches', language)}</p>
              <h4 className="text-2xl font-black text-slate-800">{activeDispatchesCount} {translateUI('deliveries', language)}</h4>
            </div>
          </div>

          <button
            onClick={handleSimulateWeatherSpike}
            disabled={simulationActive}
            className={`p-5 rounded-2xl shadow-sm flex items-center gap-4 border-2 transition-all cursor-pointer text-left ${
              simulationActive 
                ? 'bg-amber-500 text-white border-amber-400 animate-pulse' 
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
            }`}
          >
            <div className={`p-3 rounded-xl ${simulationActive ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'}`}>
              <CloudLightning className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-wider ${simulationActive ? 'text-white' : 'text-amber-700'}`}>
                {simulationActive ? translateUI('simulating', language) : translateUI('monsoonRainSpike', language)}
              </p>
              <span className="text-[11px] font-bold">{translateUI('tapToTriggerFlood', language)}</span>
            </div>
          </button>
        </div>

        {/* Search Bar for Simple Mode */}
        <div className="bg-white p-4 rounded-3xl border-3 border-indigo-50 shadow-md flex items-center gap-3">
          <Search className="w-6 h-6 text-slate-400 ml-1 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-base font-extrabold text-slate-800 placeholder-slate-400 outline-none bg-transparent"
            placeholder={translateUI('searchStationPlaceholder', language)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-lg font-bold text-xs"
            >
              {translateUI('clear', language)}
            </button>
          )}
        </div>

        {/* Stations Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMatrix.map((item) => {
            const isCritical = item.status === 'CRITICAL DEFICIT' || item.stockLevel < 50;
            const isFlooded = item.roadStatus?.toLowerCase().includes('flood') || item.roadStatus?.toLowerCase().includes('passable');
            
            return (
              <div 
                key={item.phcId} 
                className={`bg-white rounded-3xl p-6 border-3 shadow-lg flex flex-col justify-between transition-all duration-300 hover:shadow-xl min-h-[280px] ${
                  isCritical ? 'border-rose-100 bg-rose-50/10' : 'border-slate-100'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="text-lg font-black text-slate-800">{item.name}</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex flex-wrap items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        <span>{`${getHaversineDistance(userLocation, parseCoordinates(item.coordinates || '')).toFixed(1)} km`} {translateUI('away', language)}</span>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const pt = parseCoordinates(item.coordinates || '');
                            window.open(`https://www.google.com/maps/search/?api=1&query=${pt.lat},${pt.lng}`, '_blank');
                          }}
                          className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 underline flex items-center gap-1 cursor-pointer"
                        >
                          <Navigation className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Google Maps</span>
                        </button>
                      </p>
                    </div>
                    <span className={`text-[10px] px-3 py-1 rounded-full font-black tracking-wider border uppercase ${
                      isCritical 
                        ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' 
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                      {isCritical ? translateStatus('CRITICAL DEFICIT', language).toUpperCase() : translateStatus('OPTIMAL', language).toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{translateUI('deficitMedicine', language)}</p>
                      <h5 className="text-base font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        {translateMedicine(item.itemNeeded, language)} ({translateUI('requires', language)} {item.qtyNeeded} {translateUnit(item.unit, language)})
                      </h5>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{translateUI('currentStock', language)}</p>
                        <span className="text-2xl font-black text-slate-800">{item.stockLevel} {translateUnit(item.unit, language)}</span>
                      </div>
                      
                      {/* Custom progress bar */}
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCritical ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, (item.stockLevel / (item.qtyNeeded || 200)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Road accessibility status */}
                    <div className={`p-3 rounded-2xl text-xs font-extrabold flex items-center gap-2 ${
                      isFlooded 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      {isFlooded ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
                          <span>{translateRoadStatus('Flooded / Impassable', language).toUpperCase()}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>{translateUI('roadsClear', language)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => {
                      onUpdateMatrixStock(item.phcId, 50);
                      speakText(`50 units of supply sent to ${item.name}`, language);
                      // Add 1 to active dispatches
                      setActiveDispatchesCount(prev => prev + 1);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-500 py-3.5 rounded-2xl font-black text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Truck className="w-4.5 h-4.5 text-white" />
                    <span>{translateUI('quickRefill50', language)}</span>
                  </button>
                  <button
                    onClick={() => {
                      handleOpenPhcEdit(item);
                    }}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 border-2 border-slate-200 px-4 py-3.5 rounded-2xl font-black text-sm transition-all cursor-pointer"
                  >
                    {translateUI('edit', language)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden animate-in fade-in duration-300">
      {/* Matrix Table Left Section */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {simulationActive && (
          <div className="bg-amber-500 text-white px-5 py-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pulse shadow-md">
            <CloudLightning className="w-4 h-4 animate-bounce" />
            <span>{translateUI('monsoonActiveAlert', language)}</span>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-800">{translateUI('regionalMatrixTitle', language)}</h3>
              <p className="text-xs text-slate-500 font-medium">{translateUI('regionalMatrixDesc', language)}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Simulate Seasonal Weather Spike Button */}
              <button
                onClick={handleSimulateWeatherSpike}
                disabled={simulationActive}
                className="text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-extrabold flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 shadow-sm transition-all cursor-pointer whitespace-nowrap h-10 uppercase tracking-widest disabled:opacity-50"
              >
                <CloudLightning className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                {simulationActive ? translateUI('simulatingAnomaly', language) : translateUI('simulateWeatherSpike', language)}
              </button>

              <button
                onClick={handleOpenPhcAdd}
                className="text-xs text-white bg-blue-600 hover:bg-blue-700 font-bold flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 shadow-sm transition-all cursor-pointer whitespace-nowrap h-10"
              >
                <Plus className="w-4 h-4" />
                {translateUI('addStation', language)}
              </button>
              
              {/* Search Bar */}
              <div className="relative w-full max-w-[180px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder={translateUI('searchStationsPlaceholder', language)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 h-10 text-xs bg-slate-50 border border-slate-200 rounded-full focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-slate-800 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Sub-tab Pill Controls */}
          <div className="flex border-b border-slate-200/80 mb-5">
            <button 
              onClick={() => setMatrixSubTab('matrix')}
              className={`pb-3 text-[10px] font-extrabold uppercase tracking-widest px-4 transition-all border-b-2 cursor-pointer ${
                matrixSubTab === 'matrix' 
                  ? 'border-b-blue-600 text-blue-600' 
                  : 'border-b-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {translateUI('realtimeSupplyGrid', language)}
            </button>
            <button 
              onClick={() => setMatrixSubTab('predictive')}
              className={`pb-3 text-[10px] font-extrabold uppercase tracking-widest px-4 transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                matrixSubTab === 'predictive' 
                  ? 'border-b-blue-600 text-blue-600' 
                  : 'border-b-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Brain className="w-4 h-4 text-purple-500 animate-pulse" />
              {translateUI('predictiveHealthInsights', language)}
            </button>
          </div>

          {matrixSubTab === 'matrix' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{translateUI('phcIdName', language)}</th>
                    <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{translateUI('itemNeeded', language)}</th>
                    <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">{translateUI('stockLevel', language)}</th>
                    <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">{language === 'hi' ? 'दूरी' : 'Distance'}</th>
                    <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-right">{translateUI('status', language)}</th>
                    <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-right">{language === 'hi' ? 'गूगल मैप्स' : 'Google Maps'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMatrix.map((item) => {
                    const itemCoords = parseCoordinates(item.coordinates || '');
                    const distanceKm = getHaversineDistance(userLocation, itemCoords);
                    const distanceString = `${distanceKm.toFixed(1)} km`;

                    return (
                      <tr 
                        key={item.phcId} 
                        onClick={() => handleSelectPHC(item)}
                        className={`hover:bg-slate-50/50 transition-all cursor-pointer ${
                          selectedPhc?.phcId === item.phcId ? 'bg-blue-50/50 font-semibold border-l-4 border-l-blue-600' : ''
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <MapPin className={`w-4 h-4 flex-shrink-0 ${selectedPhc?.phcId === item.phcId ? 'text-blue-600' : 'text-slate-400'}`} />
                            <div>
                              <span className="text-sm text-slate-800 font-bold block">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold font-mono">
                                {item.coordinates || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-slate-500">{translateMedicine(item.itemNeeded, language)}</td>
                        <td className="px-5 py-4 text-center text-sm font-bold text-slate-800">{item.stockLevel} {translateUnit(item.unit, language)}</td>
                        <td className="px-5 py-4 text-center text-xs font-mono font-bold text-slate-600">{distanceString}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            item.status === 'Healthy' 
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                              : item.status === 'Low Stock' 
                                ? 'bg-amber-50 border-amber-100 text-amber-700' 
                                : 'bg-rose-50 border-rose-100 text-rose-700 animate-pulse'
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${
                              item.status === 'Healthy' ? 'bg-emerald-500' : item.status === 'Low Stock' ? 'bg-amber-500' : 'bg-rose-500'
                            }`}></span>
                            {translateStatus(item.status, language)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              const url = `https://www.google.com/maps/search/?api=1&query=${itemCoords.lat},${itemCoords.lng}`;
                              window.open(url, '_blank');
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 ml-auto cursor-pointer shadow-2xs"
                            title="Open location directly in official Google Maps"
                          >
                            <Navigation className="w-3 h-3 text-emerald-600" />
                            <span>{language === 'hi' ? 'मैप्स' : 'Maps'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
            </table>
          </div>
          ) : (
            /* Predictive Health Insights Sub-Tab Panel */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
              {matrix.map((item) => {
                const isHighRisk = item.predictiveRisk === 'high_stock_out';
                const isEpidemicSpike = item.predictiveRisk === 'epidemic_spike';
                
                return (
                  <div 
                    key={item.phcId}
                    onClick={() => handleSelectPHC(item)}
                    className={`p-5 rounded-2xl border transition-all duration-200 hover:shadow-md relative overflow-hidden cursor-pointer ${
                      selectedPhc?.phcId === item.phcId 
                        ? 'ring-4 ring-blue-600/10 shadow-sm border-blue-500 bg-blue-50/5' 
                        : ''
                    } ${
                      isHighRisk 
                        ? 'border-orange-200 bg-orange-50/10 shadow-2xs' 
                        : isEpidemicSpike 
                          ? 'border-rose-200 bg-rose-50/10 shadow-2xs' 
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Floating blink borders / accent bars for high priority risk assessments */}
                    {isHighRisk && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-amber-400 animate-pulse"></div>
                    )}
                    {isEpidemicSpike && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-rose-600"></div>
                    )}

                    {/* Urgency Border/Badge */}
                    <div className="flex justify-between items-start mb-2.5">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider font-mono">{item.phcId}</p>
                      </div>
                      {isHighRisk && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-orange-100 text-orange-700 uppercase tracking-widest border border-orange-200 animate-pulse">
                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span>
                          {translateUI('highRisk', language)} ({item.riskProbability || 85}%)
                        </span>
                      )}
                      {isEpidemicSpike && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-700 uppercase tracking-widest border border-rose-200">
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce"></span>
                          {translateUI('epidemicSpike', language)} ({item.riskProbability || 90}%)
                        </span>
                      )}
                      {!isHighRisk && !isEpidemicSpike && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-slate-50 text-slate-500 uppercase tracking-widest border border-slate-200">
                          {translateUI('stableBuffer', language)}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-[11px] font-medium text-slate-500">
                        <span>{translateUI('deficitItemModeled', language)}</span>
                        <span className="font-bold text-slate-800">{translateMedicine(item.itemNeeded, language)}</span>
                      </div>
                      
                      {/* Interactive explanation style assessment tooltip block */}
                      <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl mt-2 text-[11px] leading-relaxed text-slate-600 font-medium">
                        💡 <span className="font-bold text-slate-700">{translateUI('predictiveIntelligence', language)}:</span> {item.riskReason || "Clinic inventory consumption matches current seasonal baseline averages. Outages low probability."}
                      </div>

                      {/* Probability Progress Bar */}
                      <div className="space-y-1 mt-3">
                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <span>{translateUI('anomalousProbability', language)}</span>
                          <span>{item.riskProbability || 10}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isHighRisk ? 'bg-orange-500' : isEpidemicSpike ? 'bg-rose-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${item.riskProbability || 10}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dynamic Metric displays at the bottom */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-end min-h-24 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
            <span className="text-3xl font-extrabold text-blue-600 tracking-tight">82%</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{translateUI('averageStockHealth', language)}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-end min-h-24 relative overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all duration-200">
            <span className="text-3xl font-extrabold text-rose-600 tracking-tight">{criticalAlertsCount}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{translateUI('criticalStockAlerts', language)}</span>
            {criticalAlertsCount > 0 && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></div>}
          </div>
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-end min-h-24 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
            <span className="text-3xl font-extrabold text-slate-700 tracking-tight">{activeDispatchesCount}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{translateUI('activeDispatches', language)}</span>
          </div>
        </div>
      </div>

      {/* Right Supply dispatch drawer */}
      <div className="w-full lg:w-[350px] border border-slate-200 bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800">{translateUI('supplyDispatch', language)}</h3>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Truck className="w-4 h-4" />
            </span>
          </div>

          <div className="space-y-5">
            {/* Selected PHC details box */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl relative">
              {selectedPhc && (
                <div className="absolute top-3.5 right-3.5 flex gap-1.5 z-10">
                  <button 
                    onClick={() => handleOpenPhcEdit(selectedPhc)}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200/40 hover:border-slate-200 shadow-sm transition-all cursor-pointer bg-slate-50"
                    title="Edit Station Details"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(translateUI('areYouSureDelete', language))) {
                        onDeleteMatrix(selectedPhc.phcId);
                        setSelectedPhc(matrix.find(m => m.phcId !== selectedPhc.phcId) || null);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg border border-slate-200/40 hover:border-slate-200 shadow-sm transition-all cursor-pointer bg-slate-50"
                    title="Remove Station"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">{translateUI('destinationPhc', language)}</p>
              <p className="font-bold text-sm text-blue-600 truncate max-w-[180px]">
                {selectedPhc ? selectedPhc.name : translateUI('selectHealthCenter', language)}
              </p>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mt-3.5 mb-1">{translateUI('medicinesNeeded', language)}</p>
              <p className="font-bold text-sm text-slate-800">
                {selectedPhc ? translateMedicine(selectedPhc.itemNeeded, language) : '--'}
              </p>
              {selectedPhc && (
                <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex flex-col gap-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">GIS Coordinates & Range</p>
                  <div className="flex items-center justify-between text-xs text-slate-700 font-bold">
                    <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">{selectedPhc.coordinates || 'N/A'}</span>
                    <span className="text-emerald-600 font-mono">{(getHaversineDistance(userLocation, parseCoordinates(selectedPhc.coordinates || ''))).toFixed(1)} km</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const pt = parseCoordinates(selectedPhc.coordinates || '');
                      window.open(`https://www.google.com/maps/search/?api=1&query=${pt.lat},${pt.lng}`, '_blank');
                    }}
                    className="w-full mt-1.5 py-2 px-3 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{language === 'hi' ? 'गूगल मैप्स पर खोलें' : 'Open in Google Maps'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Form parameters */}
            {selectedPhc && (() => {
              const deficit = Math.max(0, (selectedPhc.qtyNeeded || 0) - (selectedPhc.stockLevel || 0));
              const currentLimit = courier === 'A' ? 1000 : 150;
              const isOverLimit = (Number(sendQuantity) || 0) > currentLimit;

              return (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('batchQtyToSend', language)}</label>
                      {deficit > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetSendQuantity(String(deficit))}
                          className="text-[9px] font-extrabold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-100 transition-all cursor-pointer"
                          title="Auto-fills exactly what is needed to reach target stock"
                        >
                          {translateUI('fillDeficit', language)} ({deficit})
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input 
                        type="number"
                        value={sendQuantity}
                        onChange={(e) => handleSetSendQuantity(e.target.value)}
                        className="w-full h-11 bg-slate-50 border border-slate-200 text-sm text-slate-800 font-bold rounded-xl pl-4 pr-16 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                        placeholder={translateUI('enterAmount', language)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400 uppercase font-mono">
                        {translateUnit(selectedPhc.unit, language)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('priorityLevel', language)}</label>
                    <select 
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="Normal - Routine Supply">
                        {language === 'hi' ? 'सामान्य - नियमित आपूर्ति' : 
                         language === 'ta' ? 'சாதாரண - வழக்கமான விநியோகம்' :
                         language === 'te' ? 'సాధారణం - సాధారణ సరఫరా' :
                         language === 'kn' ? 'ಸಾಮಾನ್ಯ - ನಿಯಮಿತ ಪೂರೈಕೆ' :
                         language === 'ml' ? 'സാധാരണ - പതിവ് വിതരണം' :
                         language === 'bn' ? 'স্বাভাবিক - নিয়মিত সরবরাহ' :
                         language === 'mr' ? 'सामान्य - नियमित पुरवठा' :
                         language === 'gu' ? 'સામાન્ય - નિયમિત પુરવઠો' :
                         language === 'pa' ? 'ਸਧਾਰਨ - ਨਿਯਮਤ ਸਪਲਾਈ' :
                         'Normal - Routine Supply'}
                      </option>
                      <option value="Urgent - Low Stock Re-fill">
                        {language === 'hi' ? 'त्वरित - कम स्टॉक पुनः भरें' : 
                         language === 'ta' ? 'அவசரம் - குறைந்த பங்கு நிரப்புதல்' :
                         language === 'te' ? 'అత్యవసరం - తక్కువ స్టాక్ రీ-ఫిల్' :
                         language === 'kn' ? 'ತುರ್ತು - ಕಡಿಮೆ ಸ್ಟಾಕ್ ಮರುಪೂರಣ' :
                         language === 'ml' ? 'അടിയന്തിരം - കുറഞ്ഞ സ്റ്റോക്ക് വീണ്ടും നിറയ്ക്കൽ' :
                         language === 'bn' ? 'জরুরি - কম স্টক রি-ফিল' :
                         language === 'mr' ? 'तातडीचे - कमी स्टॉक पुनर्भरण' :
                         language === 'gu' ? 'તાત્કાલિક - ઓછો સ્ટોક ફરી ભરો' :
                         language === 'pa' ? 'ਜ਼ਰੂਰੀ - ਘੱਟ ਸਟਾਕ ਰੀ-ਫਿਲ' :
                         'Urgent - Low Stock Re-fill'}
                      </option>
                      <option value="Emergency - Out of Stock Response">
                        {language === 'hi' ? 'आपातकालीन - स्टॉक समाप्त प्रतिक्रिया' : 
                         language === 'ta' ? 'அவசரகாலம் - இருப்பு இல்லாத பதில்' :
                         language === 'te' ? 'అत्यవసర పరిస్థితి - ఖాళీ స్టాక్ ప్రతిస్పందన' :
                         language === 'kn' ? 'ತುರ್ತು ಪರಿಸ್ಥಿತಿ - ಖಾಲಿ ಸ್ಟಾಕ್ ಪ್ರತಿಕ್ರಿಯೆ' :
                         language === 'ml' ? 'അടിയന്തിര ഘട്ടം - സ്റ്റോക്ക് തീർന്ന പ്രതികരണം' :
                         language === 'bn' ? 'জরুরি অবস্থা - স্টক শেষ প্রতিক্রিয়া' :
                         language === 'mr' ? 'आणीबाणी - स्टॉक संपला प्रतिसाद' :
                         language === 'gu' ? 'કટોકटी - સ્ટોક બહાર પ્રતિભાવ' :
                         language === 'pa' ? 'ਐਮਰਜੈਂਸੀ - ਸਟਾਕ ਖਤਮ ਪ੍ਰਤੀਕਿਰਿਆ' :
                         'Emergency - Out of Stock Response'}
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('assignedCourier', language)}</label>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                        {translateUI('capacityMonitor', language)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => setCourier('A')}
                        className={`p-3 border rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 relative overflow-hidden ${
                          courier === 'A' 
                            ? 'border-blue-500 bg-blue-50/50 text-blue-600 font-semibold' 
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-500'
                        }`}
                      >
                        <Truck className="w-5 h-5 mb-1.5 text-blue-600" />
                        <span className="text-[10px] font-bold">
                          {language === 'hi' ? 'लॉजिस्टिक्स ए' : 
                           language === 'ta' ? 'தளவாடங்கள் ஏ' :
                           language === 'te' ? 'లాజిస్టిక్స్ ఎ' :
                           language === 'kn' ? 'ಲಾಜಿಸ್ಟಿಕ್ಸ್ ಎ' :
                           language === 'ml' ? 'ലോജിസ്റ്റിക്സ് എ' :
                           language === 'bn' ? 'লজিস্টিকস এ' :
                           language === 'mr' ? 'लॉजिस्टिक ए' :
                           language === 'gu' ? 'લોજિস্টિક્સ એ' :
                           language === 'pa' ? 'ਲੌਜਿਸਟਿਕਸ ਏ' :
                           'Logistics A'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                          {language === 'hi' ? `अधिकतम: 1000 ${translateUnit('units', language)}` : `Max: 1000 ${translateUnit('units', language)}`}
                        </span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setCourier('B')}
                        className={`p-3 border rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 relative overflow-hidden ${
                          courier === 'B' 
                            ? 'border-blue-500 bg-blue-50/50 text-blue-600 font-semibold' 
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-500'
                        }`}
                      >
                        <Bike className="w-5 h-5 mb-1.5 text-blue-600" />
                        <span className="text-[10px] font-bold">
                          {language === 'hi' ? 'कूरियर बी' : 
                           language === 'ta' ? 'கூரியர் பி' :
                           language === 'te' ? 'కొరియర్ బి' :
                           language === 'kn' ? 'ಕೊರಿಯರ್ ಬಿ' :
                           language === 'ml' ? 'കൊറിയർ ബി' :
                           language === 'bn' ? 'কুরিয়ার বি' :
                           language === 'mr' ? 'कुरिअर बी' :
                           language === 'gu' ? 'કુરિયર બી' :
                           language === 'pa' ? 'ਕੂਰੀਅਰ ਬੀ' :
                           'Courier B'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                          {language === 'hi' ? `अधिकतम: 150 ${translateUnit('units', language)}` : `Max: 150 ${translateUnit('units', language)}`}
                        </span>
                      </button>
                    </div>

                    {isOverLimit && (
                      <div className="mt-2.5 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-semibold text-rose-700 flex flex-col gap-1.5 shadow-sm">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                          <span>{translateUI('dispatchLimitExceeded', language)}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-relaxed">
                          {(() => {
                            if (courier === 'B' && Number(sendQuantity) <= 1000) {
                              switch (language) {
                                case 'hi': return <span>मात्रा <b>{sendQuantity}</b> कूरियर बी की सीमा (150) से अधिक है। आप लॉजिस्टिक्स ए में अपग्रेड कर सकते हैं।</span>;
                                case 'bn': return <span>পরিমাণ <b>{sendQuantity}</b> কুরিয়ার বি-এর সীমা (১৫০) অতিক্রম করেছে। আপনি লজিস্টিকস এ-তে আপগ্রেড করতে পারেন।</span>;
                                case 'mr': return <span>प्रमाण <b>{sendQuantity}</b> कुरिअर बी च्या मर्यादेपेक्षा (१५०) जास्त आहे. आपण लॉजिस्टिक ए वर अपग्रेड करू शकता.</span>;
                                case 'te': return <span>పరిమాణం <b>{sendQuantity}</b> కొరియర్ బి పరిమితి (150) మించిపోయింది. మీరు లాజిస్టిక్స్ ఎ కు అప్‌గ్రేడ్ చేయవచ్చు.</span>;
                                case 'ta': return <span>அளவு <b>{sendQuantity}</b> கூரியர் பி-இன் வரம்பை (150) விட அதிகமாக உள்ளது. நீங்கள் தளவாடங்கள் ஏ-க்கு மேம்படுத்தலாம்.</span>;
                                case 'gu': return <span>માત્રા <b>{sendQuantity}</b> કુરિયર બી ની મર્યાદા (૧૫૦) થી વધુ છે. તમે લોજિસ્ટિક્સ એ પર અપગ્રેડ કરી શકો છો.</span>;
                                case 'kn': return <span>ಪ್ರಮಾಣ <b>{sendQuantity}</b> ಕೊರಿಯರ್ ಬಿ ಮಿತಿ (150) ಗಿಂತ ಹೆಚ್ಚಾಗಿದೆ. ನೀವು ಲಾಜಿಸ್ಟಿಕ್ಸ್ ಎ ಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಬಹುದು.</span>;
                                case 'ml': return <span>അളവ് <b>{sendQuantity}</b> കൊറിയർ ബി പരിധി (150) കവിയുന്നു. നിങ്ങൾക്ക് ലോജിസ്റ്റിക്സ് എ ലേക്ക് മാറാം.</span>;
                                case 'pa': return <span>ਮਾਤਰਾ <b>{sendQuantity}</b> ਕੂਰੀਅਰ ਬੀ ਦੀ ਸੀਮਾ (150) ਤੋਂ ਵੱਧ ਹੈ। ਤੁਸੀਂ ਲੌਜਿਸਟਿਕਸ ਏ ਵਿੱਚ ਅਪਗ੍ਰੇਡ ਕਰ ਸਕਦੇ ਹੋ।</span>;
                                default: return <span>Quantity <b>{sendQuantity}</b> exceeds Courier B limit (150). You can upgrade to Logistics A.</span>;
                              }
                            } else {
                              const courName = courier === 'A' ? (language === 'hi' ? 'ए' : 'A') : (language === 'hi' ? 'बी' : 'B');
                              switch (language) {
                                case 'hi': return <span>मात्रा <b>{sendQuantity}</b> कूरियर {courName} की सुरक्षित सीमा से अधिक है। अधिकतम क्षमता {currentLimit} {translateUnit(selectedPhc.unit, language)} है।</span>;
                                case 'bn': return <span>পরিমাণ <b>{sendQuantity}</b> কুরিয়ার {courName}-এর নিরাপদ সীমা অতিক্রম করেছে। সর্বাধিক ক্ষমতা {currentLimit} {translateUnit(selectedPhc.unit, language)}।</span>;
                                case 'mr': return <span>प्रमाण <b>{sendQuantity}</b> कुरिअर {courName} च्या सुरक्षित मर्यादेपेक्षा जास्त आहे. कमाल क्षमता {currentLimit} {translateUnit(selectedPhc.unit, language)} आहे.</span>;
                                case 'te': return <span>పరిమాణం <b>{sendQuantity}</b> కొరియర్ {courName} సురక్షిత పరిమితి మించిపోయింది. గరిష్ట సామర్థ్యం {currentLimit} {translateUnit(selectedPhc.unit, language)}.</span>;
                                case 'ta': return <span>அளவு <b>{sendQuantity}</b> கூரியர் {courName}-இன் பாதுகாப்பான வரம்பை விட அதிகமாக உள்ளது. அதிகபட்ச திறன் {currentLimit} {translateUnit(selectedPhc.unit, language)}.</span>;
                                case 'gu': return <span>માત્રા <b>{sendQuantity}</b> કુરિયર {courName} ની સુરક્ષિત મર્યાદાથી વધુ છે. મહત્તમ ક્ષમતા {currentLimit} {translateUnit(selectedPhc.unit, language)} છે.</span>;
                                case 'kn': return <span>ಪ್ರಮಾಣ <b>{sendQuantity}</b> ಕೊರಿಯರ್ {courName} ನ ಸುರಕ್ಷಿತ ಮಿತಿಯನ್ನು ಮೀರಿದೆ. ಗರಿಷ್ಠ ಸಾಮರ್ಥ್ಯ {currentLimit} {translateUnit(selectedPhc.unit, language)} ಆಗಿದೆ.</span>;
                                case 'ml': return <span>അളവ് <b>{sendQuantity}</b> കൊറിയർ {courName}-ന്റെ പരിധി കവിയുന്നു. പരമാവധി ശേഷി {currentLimit} {translateUnit(selectedPhc.unit, language)} ആണ്.</span>;
                                case 'pa': return <span>ਮਾਤਰਾ <b>{sendQuantity}</b> ਕੂਰੀਅਰ {courName} ਦੀ ਸੁਰੱਖਿਅਤ ਸੀਮਾ ਤੋਂ ਵੱਧ ਹੈ। ਅਧਿਕਤਮ ਸਮਰੱਥਾ {currentLimit} {translateUnit(selectedPhc.unit, language)} ਹੈ।</span>;
                                default: return <span>Quantity <b>{sendQuantity}</b> exceeds the safe payload limits of Courier {courier}. Max capacity is {currentLimit} {translateUnit(selectedPhc.unit, language)}.</span>;
                              }
                            }
                          })()}
                        </p>
                        {courier === 'B' && Number(sendQuantity) <= 1000 && (
                          <button
                            type="button"
                            onClick={() => setCourier('A')}
                            className="mt-1 w-full py-1.5 bg-white border border-rose-200 text-blue-600 rounded-lg text-[10px] font-extrabold hover:bg-blue-50 transition-colors cursor-pointer uppercase tracking-wider"
                          >
                            {language === 'hi' ? 'लॉजिस्टिक्स ए पर स्विच करें' : 
                             language === 'ta' ? 'தளவாடங்கள் ஏ-க்கு மாறவும்' :
                             language === 'te' ? 'లాజిస్టిక్స్ ఎ కు మారండి' :
                             language === 'kn' ? 'ಲಾಜಿಸ್ಟಿಕ್ಸ್ ಎ ಗೆ ಬದಲಾಯಿಸಿ' :
                             language === 'ml' ? 'ലോജിസ്റ്റിക്സ് എ ലേക്ക് മാറാം' :
                             language === 'bn' ? 'লজিস্টিকস এ-তে পরিবর্তন করুন' :
                             language === 'mr' ? 'लॉजिस्टिक ए वर स्विच करा' :
                             language === 'gu' ? 'લોજિસ્ટિક્સ એ પર સ્વિચ કરો' :
                             language === 'pa' ? 'ਲੌਜਿਸਟਿਕਸ ਏ ਵਿੱਚ ਬਦਲੋ' :
                             'Switch to Logistics A (Heavy Duty)'}
                          </button>
                        )}
                      </div>
                    )}

                    {!isOverLimit && Number(sendQuantity) > 0 && (
                      <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200/40 rounded-xl text-[10px] text-slate-600 flex items-center gap-1.5 shadow-xs">
                        <span className="font-extrabold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wider">
                          {translateUI('suggested', language)}
                        </span>
                        <span>
                          {Number(sendQuantity) <= 150 
                            ? (language === 'hi' ? "कूरियर बी चयनित है (तेज मोटरसाइकिल/ड्रोन बेड़ा)।" : 
                               language === 'ta' ? "கூரியர் பி தேர்ந்தெடுக்கப்பட்டது (வேகமான மோட்டார் சைக்கிள்/ட்ரோன் கடற்படை)." :
                               language === 'te' ? "కొరియర్ బి ఎంపిక చేయబడింది (వేగవంతమైన మోటార్ సైకిల్/డ్రోన్ విమానాలు)." :
                               language === 'kn' ? "ಕೊರಿಯರ್ ಬಿ ಆಯ್ಕೆಯಾಗಿದೆ (ವೇಗದ ಮೋಟಾರ್ ಸೈಕಲ್/ಡ್ರೋನ್ ಸಮೂಹ)." :
                               language === 'ml' ? "കൊറിയർ ബി തിരഞ്ഞെടുത്തു (ദ്രുത മോട്ടോർസൈക്കിൾ/ഡ്രോൺ ഫ്ലീറ്റ്)." :
                               language === 'bn' ? "কুরিয়ার বি নির্বাচিত হয়েছে (দ্রুত মোটরসাইকেল/ড্রোন বহর)।" :
                               language === 'mr' ? "कुरिअर बी निवडले आहे (वेगवान मोटरसायकल/ड्रोन ताफा)." :
                               language === 'gu' ? "કુરિયર બી પસંદ કરેલ છે (ઝડપી મોટરસાઇકલ/ડ્રોન કાફલો)." :
                               language === 'pa' ? "ਕੂਰੀਅਰ ਬੀ ਚੁਣਿਆ ਗਿਆ ਹੈ (ਤੇਜ਼ ਮੋਟਰਸਾਈਕਲ/ਡ੍ਰੋਨ ਫਲੀਟ)।" :
                               "Courier B is selected (rapid motorcycle/drone fleet).")
                            : (language === 'hi' ? "लॉजिस्टिक्स ए चयनित है (भारी सुरक्षित कार्गो ट्रक)।" : 
                               language === 'ta' ? "தளவாடங்கள் ஏ தேர்ந்தெடுக்கப்பட்டது (கனரக பாதுகாப்பான சரக்கு லாரி)." :
                               language === 'te' ? "లాజిస్టిక్స్ ఎ ఎంపిక చేయబడింది (భారీ సురక్షిత కార్గో ట్రక్)." :
                               language === 'kn' ? "ಲಾಜಿಸ್ಟಿಕ್ಸ್ ಎ ಆಯ್ಕೆಯಾಗಿದೆ (ಭಾರೀ ಸುರಕ್ಷಿತ ಸರಕು ಟ್ರಕ್)." :
                               language === 'ml' ? "ലോജിസ്റ്റിക്സ് എ തിരഞ്ഞെടുത്തു (ഭാരമേറിയ സുരക്ഷിത കാർഗോ ട്രക്ക്)." :
                               language === 'bn' ? "লজিস্টিকস এ নির্বাচিত হয়েছে (ভারী নিরাপদ কার্গো ট্রাক)।" :
                               language === 'mr' ? "लॉजिस्टिक ए निवडले आहे (जड सुरक्षित कार्गो ट्रक)." :
                               language === 'gu' ? "લોજિસ્ટિક્સ એ પસંદ કરેલ છે (ભારે સુરક્ષિત કાર્ગો ટ્રક)." :
                               language === 'pa' ? "ਲੌਜਿਸটਿਕਸ ਏ ਚੁਣਿਆ ਗਿਆ ਹੈ (ਭਾਰੀ ਸੁਰੱਖਿਅਤ ਕਾਰਗੋ ਟਰੱਕ)।" :
                               "Logistics A is selected (heavy secure cargo truck).")
                          }
                        </span>
                      </div>
                    )}

                    {/* Route Optimizer Map */}
                    {selectedPhc && (
                      <div className="space-y-2 mt-4 bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl shadow-2xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-1">
                            <Navigation className="w-3.5 h-3.5 text-blue-600 animate-pulse" /> 
                            {translateUI('routeOptimizerMap', language)}
                          </span>
                          <span className="text-[8px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase">
                            {courier === 'B' ? translateUI('agileAerial', language) : translateUI('standardLand', language)}
                          </span>
                        </div>

                        {/* SVG Visualization Map */}
                        <div className="relative">
                          <svg className="w-full h-24 bg-slate-900 rounded-xl border border-slate-800 p-1 overflow-hidden" viewBox="0 0 200 100">
                            {/* Background Grid Lines */}
                            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
                            </pattern>
                            <rect width="200" height="100" fill="url(#grid)" />

                            {/* Start Node: Regional Hub */}
                            <circle cx="30" cy="50" r="4" fill="#3b82f6" />
                            <circle cx="30" cy="50" r="8" fill="none" stroke="#3b82f6" strokeWidth="1" className="animate-ping" style={{ transformOrigin: '30px 50px' }} />
                            <text x="36" y="53" fill="#94a3b8" fontSize="6.5" fontWeight="bold">HUB</text>

                            {/* End Node: Target PHC */}
                            <circle cx="170" cy="50" r="4" fill="#ef4444" />
                            <circle cx="170" cy="50" r="8" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-ping" style={{ transformOrigin: '170px 50px' }} />
                            <text x="175" y="53" fill="#94a3b8" fontSize="6.5" fontWeight="bold">{selectedPhc.phcId}</text>

                             {/* Road status & route mapping */}
                             {(() => {
                               const isRoadImpassable = selectedPhc.roadStatus?.toLowerCase().includes("impassable") || 
                                                        selectedPhc.roadStatus?.toLowerCase().includes("flood");
                               
                               if (courier === 'A') {
                                 // Courier A (Truck/Land Route)
                                 if (isRoadImpassable) {
                                   return (
                                     <>
                                       {/* Damaged / Impassable Land Highway Route */}
                                       <path d="M 30 50 Q 100 50 170 50" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3,3" />
                                       
                                       {/* Impassable Obstruction Marker */}
                                       <g transform="translate(100, 50)">
                                         <circle cx="0" cy="0" r="6" fill="#ef4444" />
                                         <text x="-3.5" y="2.5" fill="white" fontSize="8" fontWeight="black">×</text>
                                       </g>
                                       <text x="70" y="38" fill="#f43f5e" fontSize="6" fontWeight="extrabold">
                                         {language === 'hi' ? 'सड़क अवरुद्ध' : 
                                          language === 'ta' ? 'பாதை தடைபட்டுள்ளது' :
                                          language === 'te' ? 'రోడ్డు నిరోధించబడింది' :
                                          language === 'kn' ? 'ರಸ್ತೆ ಬಂದ್ ಆಗಿದೆ' :
                                          language === 'ml' ? 'വഴി തടസ്സപ്പെട്ടു' :
                                          language === 'bn' ? 'রাস্তা অবরুদ্ধ' :
                                          language === 'mr' ? 'रस्ता बंद आहे' :
                                          language === 'gu' ? 'રસ્તો બંધ છે' :
                                          language === 'pa' ? 'ਸੜਕ ਬੰਦ ਹੈ' :
                                          'ROAD IMPASSABLE'}
                                       </text>
                                     </>
                                   );
                                 } else {
                                   return (
                                     <>
                                       {/* Clean highway path */}
                                       <path d="M 30 50 Q 100 50 170 50" fill="none" stroke="#10b981" strokeWidth="1.5" />
                                       <path d="M 30 50 Q 100 50 170 50" fill="none" stroke="#a7f3d0" strokeWidth="1.5" strokeDasharray="4,4" className="animate-[dash_2s_linear_infinite]" />
                                     </>
                                   );
                                 }
                               } else {
                                 // Courier B (Rapid Drone/Agile flight path)
                                 // It explicitly draws a safe arced flight path that Bypasses/Avoids the impassable land path!
                                 return (
                                   <>
                                     {/* Visual impassable indicator on the ground highway if road is blocked */}
                                     {isRoadImpassable && (
                                       <>
                                         <path d="M 30 50 L 170 50" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.3" />
                                         <circle cx="100" cy="50" r="4" fill="#f43f5e" opacity="0.4" />
                                         <text x="-4" y="2" transform="translate(100, 50)" fill="#fda4af" fontSize="5" fontWeight="bold">
                                           {language === 'hi' ? 'अवरुद्ध' : 
                                            language === 'ta' ? 'தடுக்கப்பட்டது' :
                                            language === 'te' ? 'బ్లాక్ చేయబడింది' :
                                            language === 'kn' ? 'ಬ್ಲಾಕ್ ಆಗಿದೆ' :
                                            language === 'ml' ? 'തടഞ്ഞു' :
                                            language === 'bn' ? 'অবরুদ্ধ' :
                                            language === 'mr' ? 'बंद' :
                                            language === 'gu' ? 'બ્લોક' :
                                            language === 'pa' ? 'ਬੰਦ' :
                                            'BLOCKED'}
                                         </text>
                                       </>
                                     )}
 
                                     {/* Secure Arced Drone Path bypassing the ground obstacle */}
                                     <path id="drone-path" d="M 30 50 Q 100 20 170 50" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="4,4" />
                                     
                                     {/* Flying Drone Icon moving along path */}
                                     <circle r="3" fill="#60a5fa">
                                       <animateMotion dur="3s" repeatCount="indefinite" path="M 30 50 Q 100 20 170 50" />
                                     </circle>
                                     
                                     <text x="75" y="15" fill="#60a5fa" fontSize="6.5" fontWeight="black" className="animate-pulse">
                                       {language === 'hi' ? 'ड्रोन बाईपास मार्ग (सक्रिय)' : 
                                        language === 'ta' ? 'ட்ரோன் மாற்று வழி (செயலில்)' :
                                        language === 'te' ? 'డ్రోన్ బైపాస్ రూట్ (క్రియాశీలం)' :
                                        language === 'kn' ? 'ಡ್ರೋನ್ ಬೈಪಾಸ್ ಮಾರ್ಗ (ಸಕ್ರಿಯ)' :
                                        language === 'ml' ? 'ഡ്രോൺ ബൈപാസ് റൂട്ട് (സജീവം)' :
                                        language === 'bn' ? 'ড্রোন বাইপাস রুট (সক্রিয়)' :
                                        language === 'mr' ? 'ड्रोन बायपास मार्ग (सक्रिय)' :
                                        language === 'gu' ? 'ડ્રોન બાયપાસ માર્ગ (સક્રિય)' :
                                        language === 'pa' ? 'ਡ੍ਰੋਨ ਬਾਈਪਾਸ ਰੂਟ (ਸਰਗਰਮ)' :
                                        'DRONE BYPASS ROUTE (ACTIVE)'}
                                     </text>
                                   </>
                                 );
                               }
                             })()}
                           </svg>
                         </div>
 
                         {/* Dynamic Flight time / travel time text */}
                         <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mt-1.5">
                           {(() => {
                             const isRoadImpassable = selectedPhc.roadStatus?.toLowerCase().includes("impassable") || 
                                                      selectedPhc.roadStatus?.toLowerCase().includes("flood");
                             const distNum = parseFloat(selectedPhc.distance || '24') || 24;
                             
                             if (courier === 'A') {
                               if (isRoadImpassable) {
                                 return (
                                   <span className="text-rose-600 font-extrabold flex items-center gap-1">
                                     <AlertTriangle className="w-3.5 h-3.5" /> 
                                     {language === 'hi' ? 'मार्ग अवरुद्ध: कूरियर बी चुनें' : 
                                      language === 'ta' ? 'பாதை அடைக்கப்பட்டுள்ளது: கூரியர் பி தேர்ந்தெடுக்கவும்' :
                                      language === 'te' ? 'ట్రాక్ నిరోధించబడింది: కొరియర్ బి ఎంచుకోండి' :
                                      language === 'kn' ? 'ರಸ್ತೆ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ: ಕೊರಿಯರ್ ಬಿ ಆಯ್ಕೆ ಮಾಡಿ' :
                                      language === 'ml' ? 'വഴി തടസ്സപ്പെട്ടു: കൊറിയர் ബി തിരഞ്ഞെടുക്കുക' :
                                      language === 'bn' ? 'পথ অবরুদ্ধ: কুরিয়ার বি নির্বাচন করুন' :
                                      language === 'mr' ? 'रस्ता बंद आहे: कुरिअर बी निवडा' :
                                      language === 'gu' ? 'રસ્તો બંધ છે: કુરિયર બી પસંદ કરો' :
                                      language === 'pa' ? 'ਰਾਹ ਬੰਦ ਹੈ: ਕੂਰੀਅਰ ਬੀ ਚੁਣੋ' :
                                      'Track Blocked: Select Courier B'}
                                   </span>
                                 );
                               } else {
                                const transitHrs = Math.max(1, Math.round(distNum / 40));
                                return (
                                  <span className="text-slate-500 font-bold">
                                    {language === 'hi' ? `🚚 भूमि माल ढुलाई: ~${transitHrs} घंटे में वितरण` :
                                     language === 'ta' ? `🚚 நிலக் சரக்கு: ~${transitHrs} மணிநேர விநியோகம்` :
                                     language === 'te' ? `🚚 ల్యాండ్ కార్గో: ~${transitHrs} గం డెలివరీ` :
                                     language === 'kn' ? `🚚 ಭೂ ಸರಕು: ~${transitHrs} ಗಂಟೆ ವಿತರಣೆ` :
                                     language === 'ml' ? `🚚 കര വഴियുള്ള ചരക്ക്: ~${transitHrs} മണിക്കൂർ ഡെലിവറി` :
                                     language === 'bn' ? `🚚 ল্যান্ড কার্গো: ~${transitHrs} ঘণ্টা ডেলিভারি` :
                                     language === 'mr' ? `🚚 जमीन मालवाहतूक: ~${transitHrs} तास वितरण` :
                                     language === 'gu' ? `🚚 જમીન માર્ગે કાર્ગો: ~${transitHrs} કલાક વિતરણ` :
                                     language === 'pa' ? `🚚 ਜ਼ਮੀਨੀ ਮਾਲ: ~${transitHrs} ਘੰਟੇ ਡਿਲੀਵరీ` :
                                     `🚚 Land Cargo: ~${transitHrs} hr delivery`}
                                  </span>
                                );
                              }
                            } else {
                              // Drone route optimized time
                              const droneMins = Math.max(5, Math.round((distNum * 0.8) + 3));
                              return (
                                <span className="text-blue-600 font-extrabold flex items-center gap-1">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                  </span>
                                  {language === 'hi' ? `🛸 ड्रोन उड़ान: ${droneMins} मिनट में आगमन (${selectedPhc.distance} दूरी)` :
                                   language === 'ta' ? `🛸 ட்ரோன் விமானம்: ${droneMins} நிமிடங்களில் வருகை (${selectedPhc.distance} தூரம்)` :
                                   language === 'te' ? `🛸 డ్రోన్ ఫ్లైట్: ${droneMins} నిమిషాల్లో రాక (${selectedPhc.distance} దూరం)` :
                                   language === 'kn' ? `🛸 ಡ್ರೋನ್ ಹಾರಾಟ: ${droneMins} ನಿಮಿಷಗಳಲ್ಲಿ ಆಗಮನ (${selectedPhc.distance} ದೂರ)` :
                                   language === 'ml' ? `🛸 ഡ്രോൺ വിമാനം: ${droneMins} മിനിറ്റിൽ എത്തും (${selectedPhc.distance} ദൂരം)` :
                                   language === 'bn' ? `🛸 ড্রোন ফ্লাইট: ${droneMins} মিনিটে আগমন (${selectedPhc.distance} দূরত্ব)` :
                                   language === 'mr' ? `🛸 ड्रोन उड्डाण: ${droneMins} मिनिटात आगमन (${selectedPhc.distance} अंतर)` :
                                   language === 'gu' ? `🛸 ડ્રોन ફ્લાઇટ: ${droneMins} મિનિટમાં આગમન (${selectedPhc.distance} અંતર)` :
                                   language === 'pa' ? `🛸 ਡ੍ਰੋਨ ਉਡਾਣ: ${droneMins} ਮਿੰਟਾਂ ਵਿੱਚ ਪਹੁੰਚ (${selectedPhc.distance} ਦੂਰੀ)` :
                                   `🛸 Drone Flight: ${droneMins} mins arrival (${selectedPhc.distance} dist)`}
                                </span>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Create Shipping button */}
        {selectedPhc && (
          <div className="pt-4 border-t border-slate-100 mt-4">
            {dispatchSuccess && (
              <div className="mb-3.5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2 shadow-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-semibold">{translateUI('shippingOrderCreated', language)}</span>
              </div>
            )}

            <button 
              disabled={isDispatching || !sendQuantity || (Number(sendQuantity) || 0) > (courier === 'A' ? 1000 : 150)}
              onClick={handleCreateShippingOrder}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-150 shadow-lg shadow-blue-100 cursor-pointer disabled:opacity-50"
            >
              {isDispatching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>
                    {language === 'hi' ? 'प्रेषण बना रहा है...' : 
                     language === 'ta' ? 'அனுப்பீடு உருவாக்கப்படுகிறது...' :
                     language === 'te' ? 'డిస్పాచ్ సృష్టించబడుతోంది...' :
                     language === 'kn' ? 'ರವಾನೆ ಸೃಷ್ಟಿಸಲಾಗುತ್ತಿದೆ...' :
                     language === 'ml' ? 'ഡിസ്പാച്ച് സൃഷ്ടിക്കുന്നു...' :
                     language === 'bn' ? 'প্রেরণ তৈরি করা হচ্ছে...' :
                     language === 'mr' ? 'डिसपॅच तयार करत आहे...' :
                     language === 'gu' ? 'ડિસ્પેચ બનાવી રહ્યાં છે...' :
                     language === 'pa' ? 'ਡਿਸਪੈਚ ਬਣਾਇਆ ਜਾ ਰਿਹਾ ਹੈ...' :
                     'Creating Dispatch...'}
                  </span>
                </>
              ) : (
                <>
                  <span>{translateUI('createShippingOrder', language)}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center mt-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              {language === 'hi' ? 'अनुमानित वितरण: २४ घंटे के भीतर' : 
               language === 'ta' ? 'மதிப்பிடப்பட்ட விநியோகம்: 24 மணி நேரத்திற்குள்' :
               language === 'te' ? 'అంచనా డెలివరీ: 24 గంటలలోపు' :
               language === 'kn' ? 'ಅಂದಾಜು ವಿತರಣೆ: 24 ಗಂಟೆಗಳ ಒಳಗೆ' :
               language === 'ml' ? 'പ്രതീക്ഷിക്കുന്ന ഡെലിവറി: 24 മണിക്കൂറിനുള്ളിൽ' :
               language === 'bn' ? 'আনুমানিক ডেলিভারি: ২৪ ঘণ্টার মধ্যে' :
               language === 'mr' ? 'अंदाजे वितरण: २४ तासांच्या आत' :
               language === 'gu' ? 'અંદાજિત વિતરણ: ૨૪ કલાકની અંદર' :
               language === 'pa' ? 'ਅਨੁਮานਿਤ ਡਿਲੀਵਰੀ: 24 ਘੰਟਿਆਂ ਦੇ ਅੰਦਰ' :
               'Estimated delivery: Within 24 hours'}
            </p>
          </div>
        )}
      </div>

      {/* PHC Station Add/Edit Modal */}
      {isPhcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                  <MapPin className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  {editingPhc ? translateUI('editSupplyMatrixEntry', language) : translateUI('addNewSupplyStation', language)}
                </h3>
              </div>
              <button 
                onClick={() => setIsPhcModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold animate-pulse"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePhcFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {language === 'hi' ? 'पीएचसी स्टेशन आईडी' : 
                     language === 'ta' ? 'பிஎச்சி நிலைய ஐடி' :
                     language === 'te' ? 'పిహెచ్‌సి స్టేషన్ ఐడి' :
                     language === 'kn' ? 'ಪಿಎಚ್‌ಸಿ ಸ್ಟೇಷನ್ ಐಡಿ' :
                     language === 'ml' ? 'പിഎച്ച്സി സ്റ്റേഷൻ ഐഡി' :
                     language === 'bn' ? 'পিএইচসি স্টেশন আইডি' :
                     language === 'mr' ? 'पीएचसी स्टेशन आयडी' :
                     language === 'gu' ? 'પીએચસી સ્ટેશન આઈડી' :
                     language === 'pa' ? 'ਪੀਐਚਸੀ ਸਟੇਸ਼ਨ ਆਈਡੀ' :
                     'PHC Station ID'}
                  </label>
                  <input 
                    type="text"
                    value={phcIdField}
                    onChange={(e) => setPhcIdField(e.target.value)}
                    disabled={!!editingPhc}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 font-mono disabled:opacity-50"
                    placeholder="e.g. PHC_004"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {language === 'hi' ? 'स्टेशन का नाम' : 
                     language === 'ta' ? 'நிலையத்தின் பெயர்' :
                     language === 'te' ? 'స్టేషన్ పేరు' :
                     language === 'kn' ? 'ಸ್ಟೇಷನ್ ಹೆಸರು' :
                     language === 'ml' ? 'സ്റ്റേഷന്റെ പേര്' :
                     language === 'bn' ? 'স্টেশনের নাম' :
                     language === 'mr' ? 'स्टेशनचे नाव' :
                     language === 'gu' ? 'સ્ટેશનનું નામ' :
                     language === 'pa' ? 'ਸਟੇਸ਼ਨ ਦਾ ਨਾਮ' :
                     'Station Name'}
                  </label>
                  <input 
                    type="text"
                    value={phcNameField}
                    onChange={(e) => setPhcNameField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                    placeholder="e.g. Green Hill Clinic"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {language === 'hi' ? 'दूरी (किमी)' : 
                     language === 'ta' ? 'தூரம் (கிமீ)' :
                     language === 'te' ? 'దూరం (కిమీ)' :
                     language === 'kn' ? 'ದೂರ (ಕಿಮೀ)' :
                     language === 'ml' ? 'ദൂരം (കിമീ)' :
                     language === 'bn' ? 'দূরত্ব (কিমি)' :
                     language === 'mr' ? 'अंतर (किमी)' :
                     language === 'gu' ? 'અંતર (કિમી)' :
                     language === 'pa' ? 'ਦੂਰੀ (ਕਿਮੀ)' :
                     'Distance (km)'}
                  </label>
                  <input 
                    type="text"
                    value={distanceField}
                    onChange={(e) => setDistanceField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                    placeholder="e.g. 45 km"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {language === 'hi' ? 'सड़क की स्थिति' : 
                     language === 'ta' ? 'பாதை நிலை' :
                     language === 'te' ? 'రోడ్డు పరిస్థితి' :
                     language === 'kn' ? 'ರಸ್ತೆ ಪರಿಸ್ಥಿತಿ' :
                     language === 'ml' ? 'വഴിയുടെ അവസ്ഥ' :
                     language === 'bn' ? 'রাস্তার অবস্থা' :
                     language === 'mr' ? 'रस्त्याची स्थिती' :
                     language === 'gu' ? 'રસ્તાની સ્થિતિ' :
                     language === 'pa' ? 'ਸੜਕ ਦੀ ਸਥਿਤੀ' :
                     'Road status'}
                  </label>
                  <select 
                    value={roadStatusField}
                    onChange={(e) => setRoadStatusField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Clear / Asphalt">
                      {language === 'hi' ? 'साफ / डामर सड़क' : 
                       language === 'ta' ? 'தெளிவானது / நிலக்கீடு' :
                       language === 'te' ? 'స్పష్టం / తారు రోడ్డు' :
                       language === 'kn' ? 'ಸ್ಪಷ್ಟ / ಡಾಂಬರು ರಸ್ತೆ' :
                       language === 'ml' ? 'വ്യക്തമായത് / ടാർ റോഡ്' :
                       language === 'bn' ? 'পরিষ্কার / অ্যাসফল্ট' :
                       language === 'mr' ? 'स्वच्छ / डांबरी रस्ता' :
                       language === 'gu' ? 'સ્પષ્ટ / ડામર રસ્તો' :
                       language === 'pa' ? 'ਸਾਫ਼ / ਡਾਮਰ ਸੜਕ' :
                       'Clear / Asphalt'}
                    </option>
                    <option value="Partially Muddy">
                      {language === 'hi' ? 'आंशिक रूप से कीचड़दार' : 
                       language === 'ta' ? 'பகுதி சேறு' :
                       language === 'te' ? 'పాక్షికంగా బురద' :
                       language === 'kn' ? 'ಭಾಗಶಃ ಕೆಸರು' :
                       language === 'ml' ? 'ഭാഗികമായി ചെളി നിറഞ്ഞത്' :
                       language === 'bn' ? 'আংশিক কাদা' :
                       language === 'mr' ? 'अंशत: चिखलमय' :
                       language === 'gu' ? 'અંશતઃ કાદવવાળો' :
                       language === 'pa' ? 'ਅੰਸ਼ਕ ਤੌਰ \'ਤੇ ਚਿੱਕੜ ਵਾਲਾ' :
                       'Partially Muddy'}
                    </option>
                    <option value="Flooded / Impassable">
                      {language === 'hi' ? 'बाढ़ग्रस्त / अवरुद्ध' : 
                       language === 'ta' ? 'வெள்ளம் / கடக்க முடியாதது' :
                       language === 'te' ? 'వరదలు / దాటలేనిది' :
                       language === 'kn' ? 'ನೆರೆ ಬಂದಿದೆ / ಹಾದುಹೋಗಲು ಅಸಾಧ್ಯ' :
                       language === 'ml' ? 'വെള്ളപ്പൊക്കം / കടന്നുപോകാൻ കഴിയാത്തത്' :
                       language === 'bn' ? 'বন্যা কবলিত / দুর্গম' :
                       language === 'mr' ? 'पूर आलेला / जाण्यायोग्य नसलेला' :
                       language === 'gu' ? 'પૂરગ્રસ્ત / અગમ્ય' :
                       language === 'pa' ? 'ਹੜ੍ਹ ਪ੍ਰਭਾਵਿਤ / ਲੰਘਣ ਤੋਂ ਅਸਮਰਥ' :
                       'Flooded / Impassable'}
                    </option>
                    <option value="Rough Mud Road">
                      {language === 'hi' ? 'कच्ची मिट्टी की सड़क' : 
                       language === 'ta' ? 'கரடுமுரடான மண் பாதை' :
                       language === 'te' ? 'కఠినమైన బురద రోడ్డు' :
                       language === 'kn' ? 'ರಫ್ ಕೆಸರು ರಸ್ತೆ' :
                       language === 'ml' ? 'പരുക്കൻ ചെളി റോഡ്' :
                       language === 'bn' ? 'অমসৃণ কাদার রাস্তা' :
                       language === 'mr' ? 'खराब चिखलाचा रस्ता' :
                       language === 'gu' ? 'ખરબચડો કાદવ માર્ગ' :
                       language === 'pa' ? 'ਕੱਚਾ ਚਿੱਕੜ ਵਾਲਾ ਰਾਹ' :
                       'Rough Mud Road'}
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {language === 'hi' ? 'आवश्यक दवा/वस्तु' : 
                     language === 'ta' ? 'தேவைப்படும் முக்கியமான மருந்து' :
                     language === 'te' ? 'అత్యవసర వస్తువు' :
                     language === 'kn' ? 'ಅಗತ್ಯವಿರುವ ಔಷಧ' :
                     language === 'ml' ? 'ആവശ്യമായ നിർണായക മരുന്ന്' :
                     language === 'bn' ? 'প্রয়োজনীয় জরুরি ওষুধ' :
                     language === 'mr' ? 'आवश्यक औषध' :
                     language === 'gu' ? 'જરૂરી મહત્વની દવા' :
                     language === 'pa' ? 'ਜ਼ਰੂਰੀ ਦਵਾਈ/ਵਸਤੂ' :
                     'Critical Item Needed'}
                  </label>
                  <input 
                    type="text"
                    value={itemNeededField}
                    onChange={(e) => setItemNeededField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                    placeholder="e.g. Anti-Venom Stock"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {language === 'hi' ? 'कमी मात्रा' : 
                     language === 'ta' ? 'பற்றாக்குறை அளவு' :
                     language === 'te' ? 'కొరత పరిమాణం' :
                     language === 'kn' ? 'ಕೊರತೆಯ ಪ್ರಮಾಣ' :
                     language === 'ml' ? 'കുറവുള്ള അളവ്' :
                     language === 'bn' ? 'ঘাটতি পরিমাণ' :
                     language === 'mr' ? 'तुटवडा प्रमाण' :
                     language === 'gu' ? 'અછત માત્રા' :
                     language === 'pa' ? 'ਘਾਟ ਮਾਤਰਾ' :
                     'Deficit Quantity'}
                  </label>
                  <input 
                    type="number"
                    min="0"
                    value={qtyNeededField}
                    onChange={(e) => setQtyNeededField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                    placeholder="e.g. 50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {language === 'hi' ? 'संपर्क विवरण' : 
                     language === 'ta' ? 'தொடர்பு விவரங்கள்' :
                     language === 'te' ? 'సంప్రదింపు వివరాలు' :
                     language === 'kn' ? 'ಸಂಪರ್ಕ ಮಾಹಿತಿ' :
                     language === 'ml' ? 'ബന്ധപ്പെടേണ്ട വിവരങ്ങൾ' :
                     language === 'bn' ? 'যোগাযোগের তথ্য' :
                     language === 'mr' ? 'संपर्क तपशील' :
                     language === 'gu' ? 'સંપર્ક વિગતો' :
                     language === 'pa' ? 'ਸੰਪਰक ਵੇਰਵਾ' :
                     'Contact Details'}
                  </label>
                  <input 
                    type="text"
                    value={contactField}
                    onChange={(e) => setContactField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                    placeholder="e.g. Radio Channel 5, Dr. Alvi"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">
                    {language === 'hi' ? 'जीपीएस निर्देशांक' : 
                     language === 'ta' ? 'ஜிபிஎஸ் ஒருங்கிணைப்புகள்' :
                     language === 'te' ? 'GPS కోఆర్డినేట్లు' :
                     language === 'kn' ? 'ಜಿಪಿಎಸ್ ನಿರ್ದೇಶಾಂಕಗಳು' :
                     language === 'ml' ? 'ജിപിഎസ് കോർഡിനേറ്റുകൾ' :
                     language === 'bn' ? 'জিপিএস স্থানাঙ্ক' :
                     language === 'mr' ? 'जीपीएस को-ऑर्डिनेट्स' :
                     language === 'gu' ? 'જીપીએસ કો-ઓર્ડિનેટ્સ' :
                     language === 'pa' ? 'ਜੀਪੀਐਸ ਕੋਆਰਡੀਨੇਟਸ' :
                     'GPS Coordinates'}
                  </label>
                  <input 
                    type="text"
                    value={coordsField}
                    onChange={(e) => setCoordsField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                    placeholder="e.g. 24.81° N, 89.37° E"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsPhcModalOpen(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {translateUI('cancel', language)}
                </button>
                <button 
                  type="submit"
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-blue-100 cursor-pointer"
                >
                  {editingPhc ? 
                   (language === 'hi' ? 'विवरण सुरक्षित करें' : 
                    language === 'ta' ? 'விவரங்களைச் சேமிக்கவும்' :
                    language === 'te' ? 'వివరాలను సేవ్ చేయండి' :
                    language === 'kn' ? 'ಮಾಹಿತಿ ಉಳಿಸಿ' :
                    language === 'ml' ? 'വിവരങ്ങൾ സംരക്ഷിക്കുക' :
                    language === 'bn' ? 'তথ্য সংরক্ষণ করুন' :
                    language === 'mr' ? 'तपशील जतन करा' :
                    language === 'gu' ? 'વિગતો સાચવો' :
                    language === 'pa' ? 'ਵੇਰਵਾ ਸੰਭਾਲੋ' :
                    'Save Station Details') :
                   (language === 'hi' ? 'स्टेशन जोड़ें' : 
                    language === 'ta' ? 'நிலையம் சேர்க்கவும்' :
                    language === 'te' ? 'స్టేషన్ జోడించండి' :
                    language === 'kn' ? 'ಸ್ಟೇಷನ್ ಸೇರಿಸಿ' :
                    language === 'ml' ? 'സ്റ്റേഷൻ ചേർക്കുക' :
                    language === 'bn' ? 'স্টেশন যুক্ত করুন' :
                    language === 'mr' ? 'स्टेशन जोडा' :
                    language === 'gu' ? 'સ્ટેશન ઉમેરો' :
                    language === 'pa' ? 'ਸਟੇਸ਼ਨ ਜੋੜੋ' :
                    'Add Station')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
