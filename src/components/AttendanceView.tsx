import React, { useState } from 'react';
import { CheckedInDoctor, ActivityEvent } from '../types';
import { 
  UserPlus, 
  CheckCircle, 
  Clock, 
  Search, 
  ChevronRight, 
  History, 
  Loader2,
  CalendarDays,
  User,
  Activity,
  Edit,
  Trash2,
  Volume2,
  XCircle,
  CheckCircle2,
  Sparkles,
  Plus,
  Accessibility
} from 'lucide-react';

import { Language, TRANSLATIONS, translateDoctorName } from '../utils/translations';
import { speakText } from '../utils/audio';
import {
  translateAttendanceUI,
  translateAttendanceStatus,
  translateSpecialization,
  translateShift,
  getSpeakRosterText,
  translateSarahMarkedText,
  translateDoctorStatusChangeText,
  translateShiftSelectedText
} from '../utils/attendanceTranslations';

interface AttendanceViewProps {
  doctors: CheckedInDoctor[];
  onAddDoctor: (doctor: Omit<CheckedInDoctor, 'id' | 'avatar'>) => void;
  onUpdateDoctorStatus: (docId: string, status: 'Active' | 'Off-Duty') => void;
  onAddEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  onEditDoctor: (doctor: CheckedInDoctor) => void;
  onDeleteDoctor: (id: string) => void;
  language: Language;
  isSimpleMode: boolean;
}

export default function AttendanceView({
  doctors,
  onAddDoctor,
  onUpdateDoctorStatus,
  onAddEvent,
  onEditDoctor,
  onDeleteDoctor,
  language,
  isSimpleMode
}: AttendanceViewProps) {
  // Dr Sarah Smith local active duty state
  const [sarahActive, setSarahActive] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [docName, setDocName] = useState('');
  const [specialization, setSpecialization] = useState('General Physician');
  const [shift, setShift] = useState<'Day' | 'Night'>('Day');

  // Modal State for managing a doctor's full details (Edit/Delete)
  const [editingDoctor, setEditingDoctor] = useState<CheckedInDoctor | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  
  // Fields for editing doctor
  const [editDocName, setEditDocName] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('General Physician');
  const [editShift, setEditShift] = useState<'Day' | 'Night'>('Day');
  const [editStatus, setEditStatus] = useState<'Active' | 'Off-Duty'>('Active');

  const handleOpenDocEdit = (doc: CheckedInDoctor) => {
    setEditingDoctor(doc);
    setEditDocName(doc.name);
    setEditSpecialization(doc.specialization);
    setEditShift(doc.shift);
    setEditStatus(doc.status);
    setIsDocModalOpen(true);
  };

  const handleSaveDocEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor || !editDocName.trim()) return;

    onEditDoctor({
      ...editingDoctor,
      name: editDocName,
      specialization: editSpecialization,
      shift: editShift,
      status: editStatus
    });

    setIsDocModalOpen(false);
  };

  const handleDeleteDoc = () => {
    if (!editingDoctor) return;
    onDeleteDoctor(editingDoctor.id);
    setIsDocModalOpen(false);
  };

  // Handle registering guest doctor
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;

    setRegistering(true);
    setSuccess(false);

    setTimeout(() => {
      onAddDoctor({
        name: docName,
        specialization,
        shift,
        status: 'Active'
      });

      onAddEvent({
        phcId: 'PHC_002',
        type: 'attendance',
        content: `Dr. Sarah Smith registered guest practitioner ${docName} (${translateSpecialization(specialization, language)}) for ${translateShift(shift, language)} shift. Status: Checked-in.`,
        source: 'Manual Check-in'
      });

      setDocName('');
      setRegistering(false);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    }, 1200);
  };

  const handleSarahToggle = (checked: boolean) => {
    setSarahActive(checked);
    onAddEvent({
      phcId: 'PHC_002',
      type: 'attendance',
      content: `Dr. Sarah Smith changed her personal on-duty status to ${checked ? 'Active Duty' : 'Off Duty'}.`,
      source: 'Manual Check-in'
    });
  };

  if (isSimpleMode) {
    const activeD = doctors.filter(d => d.status === 'Active').length;
    
    // Speak full roster summary
    const handleSpeakRoster = () => {
      const speakTextMsg = getSpeakRosterText(sarahActive, activeD, language);
      speakText(speakTextMsg, language);
    };

    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Simple Mode Welcome / Speak Banner */}
        <section className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Accessibility className="w-7 h-7 text-emerald-300 animate-pulse" />
              {translateAttendanceUI('attendanceTitle', language)}
            </h2>
            <p className="text-sm text-emerald-100 max-w-2xl font-medium">
              {translateAttendanceUI('attendanceDesc', language)}
            </p>
          </div>
          <button
            onClick={handleSpeakRoster}
            className="self-start md:self-auto bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 border border-white/25 transition-all cursor-pointer"
          >
            <Volume2 className="w-5 h-5 animate-bounce" />
            {translateAttendanceUI('listenSummary', language)}
          </button>
        </section>

        {/* Lead Doctor Sarah Smith Attendance (Gigantic and Highly tactile) */}
        <div className="bg-white p-8 rounded-3xl border-3 border-emerald-100 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-teal-500/20 shadow-md">
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAwM2x1L94u-hBCJT8fcZbiOJ-n8ir-T024PTRD3FLx29muYnp5akAXyrGR9ophBjETO-jRKZDcUN4qLtrWk8GVK94X8FjwGtAe2FiKxy8wFn_jSTLPMC3zEqxF-dsT1UK8v3IqVIvOwImdNtUf7A52JIGSysLDBVYC0zMJ8eCv4c89v7aJ6XOSe-St_BKnUDD-DGP344gpQ8oK_3u_ikjAH9HD8yvXrzPGdRVhfAJXZEbxzksSH2YIg" 
                  alt={translateDoctorName("Dr. Sarah Smith", language)}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-800">{translateDoctorName("Dr. Sarah Smith", language)}</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{translateAttendanceUI('leadTitle', language)}</p>
              </div>
            </div>
            <div>
              {sarahActive ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-2xl font-extrabold text-xs flex items-center gap-2 animate-bounce">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  {translateAttendanceUI('present', language)}
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-2xl font-extrabold text-xs flex items-center gap-2 animate-pulse">
                  <XCircle className="w-5 h-5 text-rose-500" />
                  {translateAttendanceUI('absent', language)}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                handleSarahToggle(true);
                speakText(translateSarahMarkedText(true, language), language);
              }}
              className={`flex-1 py-5 rounded-3xl font-black text-sm flex flex-col items-center justify-center gap-2 border-3 transition-all cursor-pointer ${
                sarahActive 
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20 scale-102' 
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-8 h-8" />
              <span>{translateAttendanceUI('markPresent', language)}</span>
            </button>
            <button
              onClick={() => {
                handleSarahToggle(false);
                speakText(translateSarahMarkedText(false, language), language);
              }}
              className={`flex-1 py-5 rounded-3xl font-black text-sm flex flex-col items-center justify-center gap-2 border-3 transition-all cursor-pointer ${
                !sarahActive 
                  ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20 scale-102' 
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <XCircle className="w-8 h-8" />
              <span>{translateAttendanceUI('markAbsent', language)}</span>
            </button>
          </div>
        </div>

        {/* Add Guest Practitioner - Simplified Form */}
        <div className="bg-white p-8 rounded-3xl border-3 border-teal-50 shadow-lg">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <span className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <UserPlus className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-lg font-extrabold text-slate-800">{translateAttendanceUI('registerGuest', language)}</h3>
              <p className="text-xs text-slate-400 font-semibold">{translateAttendanceUI('registerGuestDesc', language)}</p>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">{translateAttendanceUI('docNameLabel', language)}</label>
              <input 
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full h-14 px-5 rounded-2xl border-3 border-slate-100 focus:border-teal-500 bg-slate-50 outline-none transition-all text-base font-extrabold text-slate-800 placeholder-slate-400"
                placeholder={translateAttendanceUI('docNamePlaceholder', language)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">{translateAttendanceUI('specializationLabel', language)}</label>
                <select 
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full h-14 px-5 rounded-2xl border-3 border-slate-100 focus:border-teal-500 bg-slate-50 outline-none transition-all text-sm font-extrabold text-slate-800 cursor-pointer"
                >
                  <option value="General Physician">{translateSpecialization("General Physician", language)}</option>
                  <option value="Pediatrician">{translateSpecialization("Pediatrician", language)}</option>
                  <option value="Snakebite Specialist">{translateSpecialization("Snakebite Specialist", language)}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">{translateAttendanceUI('dutyShiftLabel', language)}</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShift('Day');
                      speakText(translateShiftSelectedText('Day', language), language);
                    }}
                    className={`flex-1 h-14 rounded-2xl border-3 font-extrabold text-sm transition-all flex items-center justify-center cursor-pointer ${
                      shift === 'Day' 
                        ? 'bg-teal-600 text-white border-teal-500 shadow-md shadow-teal-100' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {translateAttendanceUI('dayShift', language)}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShift('Night');
                      speakText(translateShiftSelectedText('Night', language), language);
                    }}
                    className={`flex-1 h-14 rounded-2xl border-3 font-extrabold text-sm transition-all flex items-center justify-center cursor-pointer ${
                      shift === 'Night' 
                        ? 'bg-teal-600 text-white border-teal-500 shadow-md shadow-teal-100' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {translateAttendanceUI('nightShift', language)}
                  </button>
                </div>
              </div>
            </div>

            {success && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center gap-3 animate-bounce">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span className="font-extrabold text-sm">{translateAttendanceUI('successRegisteredLabel', language)}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={registering || !docName.trim()}
              className="w-full h-14 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              {registering ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>{translateAttendanceUI('registering', language)}</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-white" />
                  <span>{translateAttendanceUI('submitRegister', language)}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Currently Checked In Staff List - Big Tactile Row Cards */}
        <div className="space-y-4">
          <h3 className="font-black text-slate-500 text-xs uppercase tracking-wider px-1">
            {translateAttendanceUI('currentlyCheckedIn', language)} ({doctors.length + (sarahActive ? 1 : 0)})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sarah Smith Row */}
            {sarahActive && (
              <div className="bg-white p-5 rounded-3xl border-3 border-teal-100 shadow-md flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-50 border-2 border-teal-200">
                    <img 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAwM2x1L94u-hBCJT8fcZbiOJ-n8ir-T024PTRD3FLx29muYnp5akAXyrGR9ophBjETO-jRKZDcUN4qLtrWk8GVK94X8FjwGtAe2FiKxy8wFn_jSTLPMC3zEqxF-dsT1UK8v3IqVIvOwImdNtUf7A52JIGSysLDBVYC0zMJ8eCv4c89v7aJ6XOSe-St_BKnUDD-DGP344gpQ8oK_3u_ikjAH9HD8yvXrzPGdRVhfAJXZEbxzksSH2YIg" 
                      alt={translateDoctorName("Dr. Sarah Smith", language)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-base">{translateDoctorName("Dr. Sarah Smith", language)}</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{translateAttendanceUI('leadPractitioner', language)} • {translateAttendanceUI('dutyShiftLabel', language)}: {translateShift('Day', language)}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleSarahToggle(false);
                    speakText(translateSarahMarkedText(false, language), language);
                  }}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-100 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  {translateAttendanceUI('checkOut', language)}
                </button>
              </div>
            )}

            {/* Other Registered Doctors */}
            {doctors.map((doc) => (
              <div key={doc.id} className="bg-white p-5 rounded-3xl border-3 border-slate-100 hover:border-teal-200 shadow-md flex items-center justify-between gap-4 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex-shrink-0 flex items-center justify-center">
                    {doc.avatar ? (
                      <img src={doc.avatar} alt={translateDoctorName(doc.name, language)} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-teal-700 font-black text-sm">{doc.name.replace('Dr. ', '').substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-base">{translateDoctorName(doc.name, language)}</h4>
                    <p className="text-xs text-slate-400 font-semibold">{translateSpecialization(doc.specialization, language)} • {translateAttendanceUI('dutyShiftLabel', language)}: {translateShift(doc.shift, language)}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const nextStatus = doc.status === 'Active' ? 'Off-Duty' : 'Active';
                      onUpdateDoctorStatus(doc.id, nextStatus);
                      speakText(translateDoctorStatusChangeText(doc.name, nextStatus, language), language);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                      doc.status === 'Active' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {translateAttendanceStatus(doc.status, language)}
                  </button>
                  <button
                    onClick={() => handleOpenDocEdit(doc)}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-[10px] cursor-pointer text-center"
                  >
                    {translateAttendanceUI('edit', language)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Dr. Sarah Smith Lead Practitioner Card */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 transition-all duration-300 hover:shadow-md hover:border-slate-300">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-100 flex-shrink-0 shadow-sm">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAwM2x1L94u-hBCJT8fcZbiOJ-n8ir-T024PTRD3FLx29muYnp5akAXyrGR9ophBjETO-jRKZDcUN4qLtrWk8GVK94X8FjwGtAe2FiKxy8wFn_jSTLPMC3zEqxF-dsT1UK8v3IqVIvOwImdNtUf7A52JIGSysLDBVYC0zMJ8eCv4c89v7aJ6XOSe-St_BKnUDD-DGP344gpQ8oK_3u_ikjAH9HD8yvXrzPGdRVhfAJXZEbxzksSH2YIg" 
                alt={translateDoctorName("Dr. Sarah Smith", language)}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{translateAttendanceUI('leadPractitioner', language)}</p>
              <h2 className="text-base font-bold text-slate-800">{translateDoctorName("Dr. Sarah Smith", language)}</h2>
              <p className="text-xs text-slate-500 font-medium">{translateAttendanceUI('chiefOfficer', language)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={sarahActive}
                onChange={(e) => handleSarahToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
            <span className={`text-[10px] font-extrabold tracking-wider uppercase mt-1.5 ${sarahActive ? 'text-emerald-600' : 'text-slate-400'}`}>
              {sarahActive ? translateAttendanceUI('active', language) : translateAttendanceUI('offDuty', language)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
          <History className="w-3.5 h-3.5" />
          <span>{translateAttendanceUI('lastModified', language)}</span>
        </div>
      </section>

      {/* Substitute Doctor Form */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition-all duration-300">
        <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
          <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <UserPlus className="w-4 h-4" />
          </span>
          <h3 className="text-base font-bold text-slate-800">{translateAttendanceUI('registerGuest', language)}</h3>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateAttendanceUI('docNameLabel', language)}</label>
            <input 
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
              placeholder={translateAttendanceUI('docNamePlaceholder', language)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateAttendanceUI('specializationLabel', language)}</label>
            <select 
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 cursor-pointer"
            >
              <option value="General Physician">{translateSpecialization("General Physician", language)}</option>
              <option value="Pediatrician">{translateSpecialization("Pediatrician", language)}</option>
              <option value="Snakebite Specialist">{translateSpecialization("Snakebite Specialist", language)}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateAttendanceUI('dutyShiftLabel', language)}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShift('Day')}
                className={`flex-1 h-11 rounded-xl border font-bold text-xs transition-all duration-150 flex items-center justify-center cursor-pointer ${
                  shift === 'Day' 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {translateAttendanceUI('dayShift', language)}
              </button>
              <button
                type="button"
                onClick={() => setShift('Night')}
                className={`flex-1 h-11 rounded-xl border font-bold text-xs transition-all duration-150 flex items-center justify-center cursor-pointer ${
                  shift === 'Night' 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {translateAttendanceUI('nightShift', language)}
              </button>
            </div>
          </div>

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2.5 shadow-sm">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="font-medium">{translateAttendanceUI('registerSuccess', language)}</span>
            </div>
          )}

          <button 
            type="submit"
            disabled={registering || !docName.trim()}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-150 shadow-md cursor-pointer mt-3"
          >
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{translateAttendanceUI('registering', language)}</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 text-white" />
                <span>{translateAttendanceUI('submitRegister', language)}</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Currently Checked-In Staff list */}
      <section className="space-y-3">
        <div className="flex justify-between items-end px-1">
          <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">{translateAttendanceUI('currentlyCheckedIn', language)}</h3>
          <span className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">
            {translateAttendanceUI('viewAll', language)} ({doctors.length + (sarahActive ? 1 : 0)})
          </span>
        </div>

        <div className="space-y-3">
          {/* Dr. Sarah Smith if active */}
          {sarahActive && (
            <div className="flex items-center gap-3.5 bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-sm transition-all duration-200 hover:border-blue-200">
              <div className="relative">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-blue-200 shadow-sm flex-shrink-0">
                  <img 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAwM2x1L94u-hBCJT8fcZbiOJ-n8ir-T024PTRD3FLx29muYnp5akAXyrGR9ophBjETO-jRKZDcUN4qLtrWk8GVK94X8FjwGtAe2FiKxy8wFn_jSTLPMC3zEqxF-dsT1UK8v3IqVIvOwImdNtUf7A52JIGSysLDBVYC0zMJ8eCv4c89v7aJ6XOSe-St_BKnUDD-DGP344gpQ8oK_3u_ikjAH9HD8yvXrzPGdRVhfAJXZEbxzksSH2YIg" 
                    alt={translateDoctorName("Dr. Sarah Smith", language)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-800 truncate">{translateDoctorName("Dr. Sarah Smith", language)}</h4>
                <p className="text-xs text-slate-500 font-medium truncate">{translateAttendanceUI('leadPractitioner', language)} • {translateAttendanceUI('dutyShiftLabel', language)}: {translateShift('Day', language)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                  {translateAttendanceUI('localChief', language)}
                </span>
              </div>
            </div>
          )}


          {doctors.map((doc) => (
            <div 
              key={doc.id} 
              className="flex items-center gap-3.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
              onClick={() => handleOpenDocEdit(doc)}
              title="Click to manage practitioner details"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 border border-slate-200 shadow-sm flex-shrink-0">
                  {doc.avatar ? (
                    <img 
                      src={doc.avatar} 
                      alt={translateDoctorName(doc.name, language)} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600 font-extrabold text-xs">
                      {doc.name.replace('Dr. ', '').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full ${
                  doc.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}></div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{translateDoctorName(doc.name, language)}</h4>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {translateSpecialization(doc.specialization, language)} • {translateAttendanceUI('dutyShiftLabel', language)}: {translateShift(doc.shift, language)}
                </p>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  doc.status === 'Active' 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                    : 'bg-slate-50 border-slate-100 text-slate-400'
                }`}>
                  {translateAttendanceStatus(doc.status, language)}
                </span>
                <span className="p-1.5 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Doctor Management Modal */}
      {isDocModalOpen && editingDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                  <User className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  {translateAttendanceUI('manageGuest', language)}
                </h3>
              </div>
              <button 
                onClick={() => setIsDocModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveDocEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateAttendanceUI('practitionerName', language)}</label>
                <input 
                  type="text"
                  value={editDocName}
                  onChange={(e) => setEditDocName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800"
                  placeholder="e.g. Dr. Jane Doe"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateAttendanceUI('specializationLabel', language)}</label>
                <select 
                  value={editSpecialization}
                  onChange={(e) => setEditSpecialization(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 cursor-pointer"
                >
                  <option value="General Physician">{translateSpecialization("General Physician", language)}</option>
                  <option value="Pediatrician">{translateSpecialization("Pediatrician", language)}</option>
                  <option value="Snakebite Specialist">{translateSpecialization("Snakebite Specialist", language)}</option>
                  <option value="Emergency Surgeon">{translateSpecialization("Emergency Surgeon", language)}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateAttendanceUI('dutyShiftLabel', language)}</label>
                  <select 
                    value={editShift}
                    onChange={(e) => setEditShift(e.target.value as 'Day' | 'Night')}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Day">{translateShift("Day", language)}</option>
                    <option value="Night">{translateShift("Night", language)}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">{translateAttendanceUI('attendanceStatus', language)}</label>
                  <select 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'Active' | 'Off-Duty')}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-slate-50 outline-none transition-all duration-150 text-sm font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Active">{translateAttendanceStatus("Active", language)}</option>
                    <option value="Off-Duty">{translateAttendanceStatus("Off-Duty", language)}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={handleDeleteDoc}
                  className="px-4 h-11 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Remove from logistics roster"
                >
                  <Trash2 className="w-4 h-4" />
                  {translateAttendanceUI('remove', language)}
                </button>
                <div className="flex-1 flex gap-2 justify-end">
                  <button 
                    type="button"
                    onClick={() => setIsDocModalOpen(false)}
                    className="px-4 h-11 rounded-xl border border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {translateAttendanceUI('cancel', language)}
                  </button>
                  <button 
                    type="submit"
                    className="px-5 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-blue-100 cursor-pointer"
                  >
                    {translateAttendanceUI('saveChanges', language)}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
