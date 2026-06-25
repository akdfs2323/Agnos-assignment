'use client';

import Link from 'next/link';
import { User, ShieldAlert, ArrowRight, Activity, Database } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex-1 flex flex-col justify-center items-center px-4 py-16 relative">
      {/* Decorative Pastel Blue & Pink Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/12 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-400/12 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="max-w-4xl w-full text-center z-10">
        {/* Logo / Header */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-600 text-xs font-semibold mb-6 animate-pulse">
          <Activity size={14} className="text-blue-600" />
          <span>Live Patient Sync Active</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-800 mb-4">
          Agnos Care Portal
        </h1>
        
        <p className="text-slate-600 text-lg md:text-xl max-w-xl mx-auto mb-12 font-medium">
          Secure, responsive, and real-time medical check-in and staff monitoring system.
        </p>

        {/* Portal Cards */}
        <div className="grid md:grid-cols-2 gap-8 text-left">
          {/* Patient Card */}
          <Link href="/patient" className="group">
            <div className="glass-panel glass-panel-hover p-8 rounded-2xl h-full flex flex-col justify-between cursor-pointer border border-slate-200/60 relative overflow-hidden">
              <div className="card-accent-bar"></div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 group-hover:scale-105 transition-all duration-300 mb-6">
                  <User size={24} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Patient Intake Form</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">
                  Register or update your information. Fully responsive and synchronized in real-time with staff. Includes input validation.
                </p>
              </div>
              <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:text-blue-700 transition-colors">
                <span>Start Registering</span>
                <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform duration-300" />
              </div>
            </div>
          </Link>

          {/* Staff Card */}
          <Link href="/staff" className="group">
            <div className="glass-panel glass-panel-hover p-8 rounded-2xl h-full flex flex-col justify-between cursor-pointer border border-slate-200/60 relative overflow-hidden">
              <div className="card-accent-bar"></div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 group-hover:bg-pink-100 group-hover:scale-105 transition-all duration-300 mb-6">
                  <ShieldAlert size={24} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Staff Monitor View</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">
                  Real-time monitoring console for hospital administration. Track patient input characters live, with visual status and active user logs.
                </p>
              </div>
              <div className="flex items-center gap-2 text-pink-600 font-semibold group-hover:text-pink-700 transition-colors">
                <span>Open Dashboard</span>
                <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform duration-300" />
              </div>
            </div>
          </Link>
        </div>

        {/* Footer Info */}
        <div className="mt-16 flex items-center justify-center gap-6 text-slate-500 text-xs font-semibold">
          <span className="flex items-center gap-1">
            <Database size={12} /> Next.js 15+ & Tailwind CSS v4 & TypeScript
          </span>
          <span>•</span>
          <span>WebSockets & REST Fallback Sync</span>
        </div>
      </div>
    </main>
  );
}
