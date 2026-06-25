'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { 
  User, Mail, Phone, MapPin, Globe, Shield, 
  CheckCircle, ArrowLeft, HeartPulse, RefreshCw, AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PatientData, PatientSession } from '../api/sync/route';

export default function PatientForm() {
  const [sessionId, setSessionId] = useState<string>('');
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'rest' | 'connecting' | 'failed'>('connecting');
  
  // Form Fields State
  const [form, setForm] = useState<PatientData>({
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    preferredLanguage: '',
    nationality: '',
    emergencyName: '',
    emergencyRelationship: '',
    religion: ''
  });

  // Validation States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track focus & typing to set status
  const [status, setStatus] = useState<PatientSession['status']>('filling');

  // Initialize Session ID on mount
  useEffect(() => {
    let sid = sessionStorage.getItem('agnos_session_id');
    if (!sid) {
      sid = 'pt_' + Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('agnos_session_id', sid);
    }
    setSessionId(sid);
  }, []);

  // Validation rule generator
  const validateField = (name: string, value: string): string => {
    const requiredFields = [
      'firstName', 'lastName', 'dob', 'gender', 'phone', 
      'email', 'address', 'preferredLanguage', 'nationality'
    ];
    
    // 1. Required Check
    if (requiredFields.includes(name) && !value.trim()) {
      return 'ข้อมูลฟิลด์นี้จำเป็นต้องกรอก (This field is required)';
    }

    // 2. Strict letters-only check for name/demographic/text fields (no numbers or special characters)
    const textOnlyFields = [
      'firstName', 'middleName', 'lastName', 'nationality', 
      'preferredLanguage', 'religion', 'emergencyName', 'emergencyRelationship'
    ];

    if (textOnlyFields.includes(name) && value.trim()) {
      const textOnlyRegex = /^[a-zA-Z\u0e01-\u0e2e\u0e30-\u0e3a\u0e40-\u0e4e\s'.\-]+$/;
      if (!textOnlyRegex.test(value)) {
        return 'ต้องกรอกเฉพาะตัวอักษรเท่านั้น และไม่มีตัวเลขหรือสัญลักษณ์พิเศษ (Must contain letters only, no numbers or special symbols)';
      }
    }

    // 3. Email Format check
    if (name === 'email' && value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'รูปแบบอีเมลไม่ถูกต้อง (Please enter a valid email address)';
      }
    }

    // 4. Phone Format check
    if (name === 'phone' && value.trim()) {
      const phoneRegex = /^[0-9+() \-]{8,15}$/;
      if (!phoneRegex.test(value)) {
        return 'เบอร์โทรศัพท์ต้องมีตัวเลข 8-15 หลัก (Please enter a valid phone number)';
      }
    }

    // 5. DOB Future Date check
    if (name === 'dob' && value.trim()) {
      const selectedDate = new Date(value);
      const today = new Date();
      if (selectedDate > today) {
        return 'วันเกิดต้องไม่ใช่วันที่ในอนาคต (Date of birth cannot be in the future)';
      }
    }

    return '';
  };

  // Sync state helper (WebSockets with REST API fallback)
  const syncWithBackend = (updatedData?: PatientData, updatedStatus?: PatientSession['status']) => {
    const currentStatus = updatedStatus || status;
    const currentData = updatedData || form;
    
    if (isSubmitted) return;

    // 1. Try WebSocket Sync
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('patient:update', {
        sessionId,
        data: currentData,
        status: currentStatus
      });
    } else {
      // 2. Fallback to REST API Sync
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          data: currentData,
          status: currentStatus
        })
      }).catch(err => console.error('[REST Sync Error]', err));
    }
  };

  // Socket Connection Setup
  useEffect(() => {
    if (!sessionId) return;

    // Connect to local custom socket server
    const socket = io(window.location.origin, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected to server');
      setConnectionMode('websocket');
      // Register patient session
      socket.emit('patient:join', { sessionId });
      syncWithBackend(form, 'filling');
    });

    socket.on('connect_error', () => {
      console.warn('[Socket] Connection failed, switching to REST polling mode');
      setConnectionMode('rest');
      syncWithBackend(form, 'filling');
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [sessionId]);

  // Handle Activity & Idle detection (10s threshold)
  const resetIdleTimer = () => {
    if (isSubmitted) return;
    
    // If we were inactive, set to filling
    if (status !== 'filling') {
      setStatus('filling');
      syncWithBackend(form, 'filling');
    }

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      setStatus('inactive');
      syncWithBackend(form, 'inactive');
    }, 10000); // 10 seconds of no typing
  };

  // Sync Form Updates
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newForm = { ...form, [name]: value };
    setForm(newForm);
    resetIdleTimer();
    
    // Validate live if the field was already touched
    if (touched[name]) {
      const errorMsg = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: errorMsg }));
    }

    syncWithBackend(newForm, 'filling');
  };

  // Handle Input Blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const errorMsg = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: errorMsg }));
  };

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate all fields
    const fieldsToValidate = [
      'firstName', 'middleName', 'lastName', 'dob', 'gender', 'phone', 
      'email', 'address', 'preferredLanguage', 'nationality',
      'emergencyName', 'emergencyRelationship', 'religion'
    ];
    
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    let hasErrors = false;

    fieldsToValidate.forEach(field => {
      newTouched[field] = true;
      const val = (form[field as keyof PatientData] || '') as string;
      const errorMsg = validateField(field, val);
      if (errorMsg) {
        newErrors[field] = errorMsg;
        hasErrors = true;
      }
    });

    setTouched(newTouched);
    setErrors(newErrors);

    if (hasErrors) {
      // Focus on first invalid element
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.getElementsByName(firstErrorField)[0];
      if (element) {
        element.focus();
      }
      return;
    }

    setIsSubmitted(true);
    setStatus('submitted');
    
    // Sync final status
    syncWithBackend(form, 'submitted');

    // Trigger Success Confetti
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  if (isSubmitted) {
    return (
      <main className="flex-1 flex flex-col justify-center items-center px-4 py-16 relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/8 rounded-full blur-[128px] pointer-events-none"></div>
        
        <div className="glass-panel max-w-lg w-full text-center p-8 md:p-12 rounded-3xl border border-pink-200 z-10 relative overflow-hidden">
          <div className="card-accent-bar"></div>
          <div className="w-20 h-20 bg-pink-50 border border-pink-200 rounded-full flex items-center justify-center text-pink-600 mx-auto mb-6">
            <CheckCircle size={44} />
          </div>
          
          <h2 className="text-3xl font-extrabold text-slate-800 mb-3">Registration Submitted!</h2>
          <p className="text-slate-600 mb-8 leading-relaxed font-medium">
            Thank you for checking in. Your details have been transmitted securely in real-time to the medical dashboard. A nurse will call you shortly.
          </p>

          <button
            onClick={() => {
              // Reset state for new form
              setIsSubmitted(false);
              setStatus('filling');
              setErrors({});
              setTouched({});
              setForm({
                firstName: '',
                middleName: '',
                lastName: '',
                dob: '',
                gender: '',
                phone: '',
                email: '',
                address: '',
                preferredLanguage: '',
                nationality: '',
                emergencyName: '',
                emergencyRelationship: '',
                religion: ''
              });
              // Regenerate session id
              const newSid = 'pt_' + Math.random().toString(36).substring(2, 11);
              sessionStorage.setItem('agnos_session_id', newSid);
              setSessionId(newSid);
            }}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-500 hover:to-pink-400 active:from-blue-700 active:to-pink-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/20 hover:scale-[1.02] cursor-pointer"
          >
            Submit Another Form
          </button>
          
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mt-6 transition-colors font-semibold">
            <ArrowLeft size={14} /> Back to Lobby
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12 px-4 md:px-8 relative flex items-center justify-center">
      {/* Decorative Orbs */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500/12 rounded-full blur-[96px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-pink-500/12 rounded-full blur-[96px] pointer-events-none"></div>

      <div className="max-w-3xl w-full z-10">
        {/* Navigation & Connection Status */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-550 hover:text-slate-750 transition-colors group text-sm font-semibold">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span>Return to Lobby</span>
          </Link>

          <div className="inline-flex items-center gap-4 bg-white/80 border border-slate-200/80 shadow-sm rounded-full px-4 py-1.5 text-xs text-slate-700">
            <span className="text-slate-500 font-medium">Sync Status:</span>
            {connectionMode === 'websocket' && (
              <span className="flex items-center gap-1.5 text-blue-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-500 glow-dot-active animate-pulse"></span>
                WebSockets Live
              </span>
            )}
            {connectionMode === 'rest' && (
              <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 glow-dot-inactive animate-pulse"></span>
                REST API Fallback
              </span>
            )}
            {connectionMode === 'connecting' && (
              <span className="flex items-center gap-1.5 text-slate-500 font-semibold animate-pulse">
                <RefreshCw size={12} className="animate-spin" />
                Connecting...
              </span>
            )}
            <span className="text-slate-450 font-mono text-[10px]">Session: {sessionId}</span>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <HeartPulse size={20} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800">Patient Intake Portal</h1>
            <p className="text-slate-600 text-sm font-medium">Please fill out your credentials. All data is synchronized live with the staff view.</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 rounded-2xl space-y-8 border border-slate-200/60 relative overflow-hidden" noValidate={true}>
          <div className="card-accent-bar"></div>
          
          {/* SECTION 1: Personal Details */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-l-4 border-l-blue-500 pl-3 pb-0.5">
              <span>Personal Identification</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {/* First Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">First Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  placeholder="e.g. John"
                  className={`w-full bg-white border ${errors.firstName ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                />
                {errors.firstName && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.firstName}
                  </div>
                )}
              </div>

              {/* Middle Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Middle Name <span className="text-slate-400">(Optional)</span></label>
                <input
                  type="text"
                  name="middleName"
                  value={form.middleName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Robert"
                  className={`w-full bg-white border ${errors.middleName ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                />
                {errors.middleName && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.middleName}
                  </div>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Last Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  placeholder="e.g. Doe"
                  className={`w-full bg-white border ${errors.lastName ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                />
                {errors.lastName && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.lastName}
                  </div>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Date of Birth <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  className={`w-full bg-white border ${errors.dob ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300 [color-scheme:light]`}
                />
                {errors.dob && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.dob}
                  </div>
                )}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Gender <span className="text-rose-500">*</span></label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  className={`w-full bg-white border ${errors.gender ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-850 transition-all duration-300 [color-scheme:light]`}
                >
                  <option value="" disabled className="text-slate-450 bg-white">Select Gender</option>
                  <option value="male" className="text-slate-800 bg-white">Male</option>
                  <option value="female" className="text-slate-800 bg-white">Female</option>
                  <option value="other" className="text-slate-800 bg-white">Other / Prefer not to say</option>
                </select>
                {errors.gender && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.gender}
                  </div>
                )}
              </div>

              {/* Religion */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Religion <span className="text-slate-400">(Optional)</span></label>
                <input
                  type="text"
                  name="religion"
                  value={form.religion}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Christian, Buddhist"
                  className={`w-full bg-white border ${errors.religion ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                />
                {errors.religion && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.religion}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: Contact Information */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-l-4 border-l-pink-500 pl-3 pb-0.5">
              <span>Contact Coordinates</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Phone Number <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Phone size={14} className="absolute left-4 top-3.5 text-slate-450" />
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    placeholder="e.g. 0812345678"
                    className={`w-full bg-white border ${errors.phone ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                  />
                </div>
                {errors.phone && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.phone}
                  </div>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email Address <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-3.5 text-slate-450" />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    placeholder="e.g. john.doe@example.com"
                    className={`w-full bg-white border ${errors.email ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                  />
                </div>
                {errors.email && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.email}
                  </div>
                )}
              </div>
            </div>

            {/* Home Address */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Residential Address <span className="text-rose-500">*</span></label>
              <div className="relative">
                <MapPin size={14} className="absolute left-4 top-3.5 text-slate-450" />
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  rows={2}
                  placeholder="e.g. 123 Main St, Apt 4B, Bangkok, 10110"
                  className={`w-full bg-white border ${errors.address ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300 resize-none`}
                ></textarea>
              </div>
              {errors.address && (
                <div className="text-red-655 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                  <AlertCircle size={12} /> {errors.address}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Preferences & Demographics */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-l-4 border-l-purple-500 pl-3 pb-0.5">
              <span>Language & Nationality</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Preferred Language */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Preferred Language <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="preferredLanguage"
                  value={form.preferredLanguage}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  placeholder="e.g. English, Thai, Spanish"
                  className={`w-full bg-white border ${errors.preferredLanguage ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                />
                {errors.preferredLanguage && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.preferredLanguage}
                  </div>
                )}
              </div>

              {/* Nationality */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Nationality <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="nationality"
                  value={form.nationality}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  placeholder="e.g. Thai, American"
                  className={`w-full bg-white border ${errors.nationality ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                />
                {errors.nationality && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.nationality}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: Emergency Contact */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2 border-l-4 border-l-indigo-500 pl-3 pb-0.5">
              <span>Emergency Contact <span className="text-slate-400 text-xs font-normal">(Optional)</span></span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Emergency Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Contact Person Name</label>
                <input
                  type="text"
                  name="emergencyName"
                  value={form.emergencyName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Jane Doe"
                  className={`w-full bg-white border ${errors.emergencyName ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                />
                {errors.emergencyName && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.emergencyName}
                  </div>
                )}
              </div>

              {/* Emergency Relationship */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Relationship to Patient</label>
                <input
                  type="text"
                  name="emergencyRelationship"
                  value={form.emergencyRelationship}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Mother, Spouse, Friend"
                  className={`w-full bg-white border ${errors.emergencyRelationship ? '!border-red-400 focus:!border-red-400 !bg-red-50/40 text-slate-800' : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'} rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-all duration-300`}
                />
                {errors.emergencyRelationship && (
                  <div className="text-red-650 text-xs mt-1.5 flex items-center gap-1 font-semibold">
                    <AlertCircle size={12} /> {errors.emergencyRelationship}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-pink-500 hover:from-blue-500 hover:to-pink-400 active:from-blue-700 active:to-pink-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/20 hover:scale-[1.01] cursor-pointer"
            >
              Submit Live Registration
            </button>
            <p className="text-center text-slate-500 text-xs mt-3 font-semibold">
              By submitting, you agree to transmit your health data securely.
            </p>
          </div>

        </form>
      </div>
    </main>
  );
}
