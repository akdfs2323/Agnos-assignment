'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { 
  Users, Activity, CheckCircle, Clock, 
  ArrowLeft, Search, RefreshCw, Eye, User, FileText,
  Mail, Globe, Shield
} from 'lucide-react';
import { PatientSession, PatientData } from '../api/sync/route';

export default function StaffDashboard() {
  const [sessions, setSessions] = useState<PatientSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'rest' | 'connecting'>('connecting');
  const socketRef = useRef<Socket | null>(null);

  // Helper to fetch REST fallback updates
  const fetchRESTFallback = async () => {
    try {
      const res = await fetch('/api/sync');
      const json = await res.json();
      if (json.success) {
        setSessions(json.sessions);
      }
    } catch (err) {
      console.error('[REST Fetch Error]', err);
    }
  };

  // Socket Connection Setup
  useEffect(() => {
    const socket = io(window.location.origin, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Staff dashboard connected');
      setConnectionMode('websocket');
      socket.emit('staff:join');
    });

    socket.on('staff:session-list', (initialSessions: PatientSession[]) => {
      setSessions(initialSessions);
      if (initialSessions.length > 0 && !selectedSessionId) {
        setSelectedSessionId(initialSessions[0].id);
      }
    });

    socket.on('staff:update', (updatedSession: PatientSession) => {
      setSessions((prev) => {
        const index = prev.findIndex((s) => s.id === updatedSession.id);
        if (index !== -1) {
          const nextSessions = [...prev];
          nextSessions[index] = updatedSession;
          return nextSessions;
        } else {
          return [...prev, updatedSession];
        }
      });
    });

    socket.on('connect_error', () => {
      console.warn('[Socket] Connection failed, switching to REST polling mode');
      setConnectionMode('rest');
      fetchRESTFallback();
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Set up REST polling fallback if WebSocket is not connected
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (connectionMode === 'rest') {
      intervalId = setInterval(fetchRESTFallback, 2000); // Poll every 2 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [connectionMode]);

  // Statistics Computations
  const totalCount = sessions.length;
  const activeCount = sessions.filter(s => s.status === 'filling').length;
  const inactiveCount = sessions.filter(s => s.status === 'inactive').length;
  const submittedCount = sessions.filter(s => s.status === 'submitted').length;

  // Filter sessions based on search query
  const filteredSessions = sessions.filter(s => {
    const data = s.data || {};
    const fullName = `${data.firstName || ''} ${data.middleName || ''} ${data.lastName || ''}`.toLowerCase();
    const phone = (data.phone || '').toLowerCase();
    const email = (data.email || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return fullName.includes(q) || phone.includes(q) || email.includes(q) || s.id.toLowerCase().includes(q);
  });

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // Helper to format field name to readable text
  const formatFieldName = (field: string) => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
  };

  // Helper to check if field has value
  const hasValue = (val: any) => {
    return val !== undefined && val !== null && val !== '';
  };

  return (
    <main className="min-h-screen py-8 px-4 md:px-8 relative flex flex-col">
      {/* Decorative Orbs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/15 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-pink-500/15 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="max-w-7xl w-full mx-auto z-10 flex-1 flex flex-col">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8 pb-6 border-b border-slate-205">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors group text-sm mr-2 font-semibold">
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Lobby</span>
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 text-sm font-semibold">Staff Dashboard</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800">Admissions Monitor</h1>
          </div>

          {/* Sync Status Badge */}
          <div className="inline-flex items-center self-start md:self-auto gap-4 bg-white/80 border border-slate-200/80 shadow-sm rounded-full px-4 py-1.5 text-xs text-slate-700">
            <span className="text-slate-500 font-medium">Live Connection:</span>
            {connectionMode === 'websocket' && (
              <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-500 glow-dot-active animate-pulse"></span>
                WebSockets Connected
              </span>
            )}
            {connectionMode === 'rest' && (
              <span className="flex items-center gap-1.5 text-amber-600 font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500 glow-dot-inactive"></span>
                REST API Polling (Fallback)
              </span>
            )}
            {connectionMode === 'connecting' && (
              <span className="flex items-center gap-1.5 text-slate-500 font-semibold animate-pulse">
                <RefreshCw size={12} className="animate-spin" />
                Connecting WebSocket...
              </span>
            )}
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Total */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50/90 to-slate-100/50 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold text-slate-550 uppercase tracking-wider">Total Patients</span>
              <Users size={16} className="text-slate-500" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-800">{totalCount}</div>
            <div className="text-[10px] text-slate-500 font-medium mt-1">Check-ins in past 4h</div>
          </div>
          {/* Active */}
          <div className="glass-panel p-5 rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-sky-50/40 shadow-sm border-l-4 border-l-blue-500">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Active Filling</span>
              <Activity size={16} className="text-blue-600 animate-pulse" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-800">{activeCount}</div>
            <div className="text-[10px] text-blue-600/80 font-medium mt-1">Currently typing/active</div>
          </div>
          {/* Inactive */}
          <div className="glass-panel p-5 rounded-2xl border border-pink-200/60 bg-gradient-to-br from-pink-50/80 to-rose-50/40 shadow-sm border-l-4 border-l-pink-400">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold text-pink-600 uppercase tracking-wider">Inactive (Idle)</span>
              <Clock size={16} className="text-pink-600" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-800">{inactiveCount}</div>
            <div className="text-[10px] text-pink-600/80 font-medium mt-1">Left form / idle &gt; 10s</div>
          </div>
          {/* Submitted */}
          <div className="glass-panel p-5 rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 to-purple-50/40 shadow-sm border-l-4 border-l-indigo-500">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Submitted</span>
              <CheckCircle size={16} className="text-indigo-600" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-800">{submittedCount}</div>
            <div className="text-[10px] text-indigo-600/80 font-medium mt-1">Successfully completed</div>
          </div>
        </div>

        {/* MAIN BODY: Grid layout split list vs details */}
        <div className="grid lg:grid-cols-12 gap-8 flex-1">
          
          {/* LEFT SIDE: Patient Sessions List (5 cols) */}
          <div className="lg:col-span-5 flex flex-col max-h-[70vh]">
            <div className="mb-4 relative">
              <Search size={16} className="absolute left-4 top-3.5 text-slate-450" />
              <input
                type="text"
                placeholder="Search patient, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredSessions.length === 0 ? (
                <div className="glass-panel p-8 rounded-2xl text-center text-slate-500 text-sm border border-slate-200/60 bg-white/70 shadow-sm">
                  No active patient sessions found
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const data = session.data || {};
                  const patientName = data.firstName 
                    ? `${data.firstName} ${data.lastName || ''}`
                    : 'Unnamed Patient';
                  const isSelected = session.id === selectedSessionId;

                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`glass-panel p-4 rounded-xl cursor-pointer transition-all duration-200 border-l-4 ${
                        isSelected 
                          ? 'bg-gradient-to-r from-blue-50/90 to-sky-50/40 border-l-blue-500 border-blue-200/80 shadow-sm' 
                          : 'bg-white/75 hover:bg-slate-50/60 border-l-slate-300 border-slate-200/50 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-800 truncate">{patientName}</h3>
                          <span className="font-mono text-[10px] text-slate-500 block truncate mt-0.5">{session.id}</span>
                        </div>
                        
                        {/* Session Status badge */}
                        {session.status === 'filling' && (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 glow-dot-active animate-pulse"></span>
                            ACTIVE
                          </span>
                        )}
                        {session.status === 'inactive' && (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-pink-600 bg-pink-50 border border-pink-100 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 glow-dot-inactive"></span>
                            IDLE
                          </span>
                        )}
                        {session.status === 'submitted' && (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 glow-dot-submitted"></span>
                            DONE
                          </span>
                        )}
                      </div>

                      {/* Snippet details */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                        <div className="truncate">📞 {data.phone || '--'}</div>
                        <div className="truncate">✉️ {data.email || '--'}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Real-Time Field Inspector (7 cols) */}
          <div className="lg:col-span-7 flex flex-col">
            {selectedSession ? (
              <div className="glass-panel p-6 md:p-8 rounded-2xl flex-1 flex flex-col border border-slate-200/60 bg-white/85 shadow-sm relative overflow-hidden">
                <div className="card-accent-bar"></div>
                
                {/* Session Title details */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <User size={20} />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-lg text-slate-800">
                        {selectedSession.data.firstName 
                          ? `${selectedSession.data.firstName} ${selectedSession.data.middleName || ''} ${selectedSession.data.lastName || ''}`.replace(/\s+/g, ' ')
                          : 'Draft Form'}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">Inspect fields in real-time as patient types.</p>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono font-medium">
                    Last active: {new Date(selectedSession.lastActive).toLocaleTimeString()}
                  </span>
                </div>

                {/* FIELDS LIST */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-2 max-h-[50vh]">
                  
                  {/* Category: Identifications */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-l-2 border-l-blue-500 pl-2">
                      Personal Identification
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {['firstName', 'middleName', 'lastName', 'dob', 'gender', 'religion'].map((field) => {
                        const val = selectedSession.data[field as keyof PatientData];
                        return (
                          <div key={field} className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-slate-350 transition-colors">
                            <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider mb-1">
                              {formatFieldName(field)}
                            </span>
                            <span className={`text-sm ${hasValue(val) ? 'text-slate-800 font-semibold' : 'text-slate-400 italic'}`}>
                              {hasValue(val) ? val : 'Not filled yet'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category: Contacts */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-l-2 border-l-pink-500 pl-2">
                      Contact Coordinates
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {['phone', 'email'].map((field) => {
                        const val = selectedSession.data[field as keyof PatientData];
                        return (
                          <div key={field} className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-slate-350 transition-colors">
                            <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider mb-1">
                              {formatFieldName(field)}
                            </span>
                            <span className={`text-sm ${hasValue(val) ? 'text-slate-800 font-semibold' : 'text-slate-400 italic'}`}>
                              {hasValue(val) ? val : 'Not filled yet'}
                            </span>
                          </div>
                        );
                      })}
                      {/* Address takes full width */}
                      <div className="col-span-full bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-slate-350 transition-colors">
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider mb-1">
                          Residential Address
                        </span>
                        <span className={`text-sm ${hasValue(selectedSession.data.address) ? 'text-slate-800 font-semibold' : 'text-slate-400 italic'}`}>
                          {hasValue(selectedSession.data.address) ? selectedSession.data.address : 'Not filled yet'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Category: Demographics */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-l-2 border-l-purple-500 pl-2">
                      Language & Nationality
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {['preferredLanguage', 'nationality'].map((field) => {
                        const val = selectedSession.data[field as keyof PatientData];
                        return (
                          <div key={field} className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-slate-350 transition-colors">
                            <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider mb-1">
                              {formatFieldName(field)}
                            </span>
                            <span className={`text-sm ${hasValue(val) ? 'text-slate-800 font-semibold' : 'text-slate-400 italic'}`}>
                              {hasValue(val) ? val : 'Not filled yet'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category: Emergency */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-l-2 border-l-indigo-500 pl-2">
                      Emergency Contact
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {['emergencyName', 'emergencyRelationship'].map((field) => {
                        const val = selectedSession.data[field as keyof PatientData];
                        return (
                          <div key={field} className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm hover:border-slate-350 transition-colors">
                            <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider mb-1">
                              {formatFieldName(field)}
                            </span>
                            <span className={`text-sm ${hasValue(val) ? 'text-slate-800 font-semibold' : 'text-slate-400 italic'}`}>
                              {hasValue(val) ? val : 'Not filled yet'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="glass-panel p-12 rounded-2xl flex-1 flex flex-col justify-center items-center text-center text-slate-500 border border-slate-200/60 bg-white/85 shadow-sm">
                <Eye size={40} className="text-slate-400 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-2">No Session Selected</h3>
                <p className="text-sm max-w-xs leading-relaxed">Select a patient session on the left sidebar to monitor their registration fields in real-time.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
