import React, { useState } from 'react';
import { ActivityEvent, MatrixItem } from '../types';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  CheckCircle,
  MoreVertical,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Plus,
  Edit,
  Trash2,
  Smartphone,
  Send,
  Radio,
  WifiOff,
  AlertTriangle,
  Zap,
  MapPin,
  Loader2,
  Volume2,
  XCircle,
  CheckCircle2,
  Sparkles,
  Accessibility
} from 'lucide-react';

import { Language, TRANSLATIONS, translateUI, translateEventContent } from '../utils/translations';
import { speakText } from '../utils/audio';

interface UpdatesViewProps {
  events: ActivityEvent[];
  onAddEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  onEditEvent: (event: ActivityEvent) => void;
  onDeleteEvent: (id: string) => void;
  onClearEvents: () => void;
  matrix: MatrixItem[];
  onEditMatrix: (editedItem: MatrixItem) => void;
  language: Language;
  isSimpleMode: boolean;
}

export default function UpdatesView({
  events,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onClearEvents,
  matrix,
  onEditMatrix,
  language,
  isSimpleMode
}: UpdatesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  // Form Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ActivityEvent | null>(null);

  const [phcIdField, setPhcIdField] = useState('PHC_002');
  const [typeField, setTypeField] = useState('inventory');
  const [contentField, setContentField] = useState('');
  const [sourceField, setSourceField] = useState('Manual Entry');

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setPhcIdField('PHC_002');
    setTypeField('inventory');
    setContentField('');
    setSourceField('Manual Entry');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (event: ActivityEvent) => {
    setEditingEvent(event);
    setPhcIdField(event.phcId || 'PHC_002');
    setTypeField(event.type);
    setContentField(event.content);
    setSourceField(event.source);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentField.trim() || !sourceField.trim()) return;

    if (editingEvent) {
      onEditEvent({
        ...editingEvent,
        phcId: phcIdField,
        type: typeField as any,
        content: contentField.trim(),
        source: sourceField.trim(),
      });
    } else {
      onAddEvent({
        phcId: phcIdField,
        type: typeField as any,
        content: contentField.trim(),
        source: sourceField.trim(),
      });
    }

    setIsFormOpen(false);
  };

  const filteredEvents = events.filter(e => {
    const translatedContent = translateEventContent(e.content, language);
    return translatedContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.phcId && e.phcId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      e.source.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const pendingAnomalies = events.filter(e => e.type === 'error').length;

  const handleLoadArchive = () => {
    setVisibleCount(prev => prev + 5);
  };

  // Map events to appropriate emojis or badges
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'inventory': return '📉';
      case 'attendance': return '👨‍⚕️';
      case 'error': return '⚠️';
      case 'alert': return '🚨';
      case 'system': return '🔌';
      default: return '📝';
    }
  };

  if (isSimpleMode) {
    const currentTrans = TRANSLATIONS[language] || TRANSLATIONS['en'];
    
    // Speak latest updates
    const handleSpeakAllUpdates = () => {
      if (events.length === 0) {
        const noUpdatesMsg = language === 'hi' ? "आज कोई नया अपडेट नहीं है।" : "No new updates today.";
        speakText(noUpdatesMsg, language);
        return;
      }
      const top3 = events.slice(0, 3).map((e, idx) => {
        const indexStr = language === 'hi' ? `अपडेट ${idx + 1}` : `Update ${idx + 1}`;
        return `${indexStr}: ${translateEventContent(e.content, language)}`;
      }).join(". ");
      const msg = language === 'hi' ? `आज की हालिया रिपोर्ट: ${top3}` : `Today's recent reports: ${top3}`;
      speakText(msg, language);
    };

    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Simple Mode Welcome / Speak Banner */}
        <section className="bg-gradient-to-r from-violet-600 to-fuchsia-700 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Accessibility className="w-7 h-7 text-fuchsia-300 animate-pulse" />
              {translateUI('updates', language)}
            </h2>
            <p className="text-sm text-violet-100 max-w-2xl font-medium">
              {translateUI('smsBlockDesc', language)}
            </p>
          </div>
          <button
            onClick={handleSpeakAllUpdates}
            className="self-start md:self-auto bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 border border-white/25 transition-all cursor-pointer"
          >
            <Volume2 className="w-5 h-5 animate-bounce" />
            {translateUI('listenUpdates', language)}
          </button>
        </section>



        {/* Live Timeline of updates */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-black text-slate-500 text-xs uppercase tracking-wider">
              {translateUI('recentClinicalHistory', language)} ({filteredEvents.length})
            </h3>
            <button
              onClick={() => {
                onClearEvents();
                speakText(language === 'hi' ? "लॉग हटा दिया गया" : "Log cleared", language);
              }}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg font-black cursor-pointer uppercase tracking-wider"
            >
              {translateUI('clearLog', language)}
            </button>
          </div>

          <div className="space-y-4">
            {filteredEvents.slice(0, visibleCount).map((ev) => {
              const emoji = getEventIcon(ev.type);
              return (
                <div 
                  key={ev.id} 
                  className="bg-white p-6 rounded-3xl border-3 border-slate-100 hover:border-fuchsia-100 shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl p-3 bg-slate-50 rounded-2xl border border-slate-100 flex-shrink-0">
                      {emoji}
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {ev.phcId && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            {translateUI('phcStationId', language)}: {ev.phcId}
                          </span>
                        )}
                        <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {translateUI('sourceAgentId', language)}: {ev.source}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold ml-1">{ev.timestamp}</span>
                      </div>
                      <p className="text-sm font-extrabold text-slate-800 max-w-2xl leading-relaxed">
                        {translateEventContent(ev.content, language)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => speakText(translateEventContent(ev.content, language), language)}
                    className="self-start md:self-auto bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 text-slate-500" />
                    <span>{translateUI('listen', language)}</span>
                  </button>
                </div>
              );
            })}

            {visibleCount < filteredEvents.length && (
              <button
                onClick={handleLoadArchive}
                className="w-full h-14 bg-slate-50 hover:bg-slate-100 text-slate-600 border-2 border-slate-200 border-dashed rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>{translateUI('loadMoreLogs', language)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Live Logs Main Column */}
      <div className="space-y-6">
        {/* Quick Stats Banner */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center gap-4 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{translateUI('totalUpdatesToday', language)}</p>
              <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">{events.length + 37}</h2>
            </div>
            <div className="ml-auto text-[10px] font-extrabold bg-slate-50 border border-slate-200 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {translateUI('vsYesterday', language)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center gap-4 shadow-sm hover:shadow-md transition-all duration-300">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${
              pendingAnomalies > 0 
                ? 'bg-rose-50 border-rose-100 text-rose-600' 
                : 'bg-emerald-50 border-emerald-100 text-emerald-600'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{translateUI('pendingAnomalies', language)}</p>
              <h2 className={`text-3xl font-extrabold tracking-tight ${pendingAnomalies > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{pendingAnomalies}</h2>
            </div>
            <div className="ml-auto flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider">
              <span className={`w-2.5 h-2.5 rounded-full ${pendingAnomalies > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className={pendingAnomalies > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-extrabold'}>
                {pendingAnomalies === 0 ? (language === 'hi' ? 'सामान्य' : 'Optimal') : translateUI('needsReview', language)}
              </span>
            </div>
          </div>
        </section>

        {/* Activity Feed */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-800">{translateUI('liveEventStream', language)}</h3>
              <p className="text-xs text-slate-500 font-medium">{translateUI('realTimeSyncLog', language)}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={handleOpenAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-blue-100"
              >
                <Plus className="w-3.5 h-3.5" /> {translateUI('addLogEntry', language)}
              </button>
              <button 
                onClick={onClearEvents}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-slate-200"
              >
                <Trash2 className="w-3.5 h-3.5" /> {translateUI('clearLogs', language)}
              </button>
              
              {/* Search filter */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={translateUI('searchLogs', language)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8.5 pr-3 h-8 text-xs bg-slate-50 border border-slate-200 rounded-full outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 w-36 text-slate-800 font-semibold transition-all duration-150"
                />
              </div>
            </div>
          </div>

          {/* Timeline Event Cards */}
          <div className="flex flex-col gap-4">
            {filteredEvents.slice(0, visibleCount).map((event) => {
              const isError = event.type === 'error';
              return (
                <div 
                  key={event.id}
                  className={`p-5 rounded-2xl border flex gap-4 items-start group transition-all duration-200 relative overflow-hidden ${
                    isError 
                      ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300 shadow-sm' 
                      : event.highlighted
                        ? 'bg-blue-50/50 border-blue-200 shadow-md ring-4 ring-blue-50/30 hover:border-blue-300'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm border ${
                    isError 
                      ? 'bg-rose-100 border-rose-200 text-rose-600' 
                      : 'bg-slate-50 border-slate-100 text-slate-600 group-hover:bg-slate-100 transition-all'
                  }`}>
                    {getEventIcon(event.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${isError ? 'text-rose-900 font-bold' : 'text-slate-800 font-semibold'}`}>
                      {translateEventContent(event.content, language)}
                    </p>
                    <p className={`text-[11px] mt-1.5 font-bold uppercase tracking-wider ${isError ? 'text-rose-500' : 'text-slate-400'}`}>
                      {event.timestamp} • {translateUI('sourceAgentId', language).split(' / ')[0].toUpperCase()}: <span className="underline underline-offset-2 font-black">{event.source}</span>
                    </p>
                  </div>

                  {/* Event Card CRUD Actions */}
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0 self-center">
                    <button
                      onClick={() => handleOpenEdit(event)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer bg-white shadow-xs"
                      title="Edit log content"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteEvent(event.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer bg-white shadow-xs"
                      title="Delete log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredEvents.length === 0 && (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-slate-400 font-medium text-sm shadow-sm">
                {translateUI('noLogsFound', language)}
              </div>
            )}
          </div>

          {filteredEvents.length > visibleCount && (
            <div className="mt-6 flex justify-center">
              <button 
                onClick={handleLoadArchive}
                className="text-[#00346f] font-bold text-xs uppercase tracking-widest hover:underline transition-all flex items-center gap-1 cursor-pointer"
              >
                {translateUI('loadArchiveRecords', language)}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Add / Edit Log Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                  <History className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  {editingEvent ? translateUI('editLogEntry', language) : translateUI('addManualLogEntry', language)}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('phcStationId', language)}</label>
                  <select 
                    value={phcIdField}
                    onChange={(e) => setPhcIdField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="PHC_001">PHC_001</option>
                    <option value="PHC_002">PHC_002</option>
                    <option value="PHC_003">PHC_003</option>
                    <option value="PHC_004">PHC_004</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('eventType', language)}</label>
                  <select 
                    value={typeField}
                    onChange={(e) => setTypeField(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="inventory">Inventory</option>
                    <option value="attendance">Attendance</option>
                    <option value="system">System</option>
                    <option value="alert">Alert</option>
                    <option value="error">Anomaly / Error</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('logContentMessage', language)}</label>
                <textarea 
                  value={contentField}
                  onChange={(e) => setContentField(e.target.value)}
                  className="w-full h-24 p-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 resize-none"
                  placeholder={translateUI('describeEvent', language)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateUI('sourceAgentId', language)}</label>
                <input 
                  type="text"
                  value={sourceField}
                  onChange={(e) => setSourceField(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                  placeholder="e.g. Manual Entry, Auto-Parser, Radio"
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
                  {editingEvent ? translateUI('saveUpdates', language) : translateUI('addLog', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
