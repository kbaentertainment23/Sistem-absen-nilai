import React from 'react';
import { 
  FileSpreadsheet, 
  Loader2, 
  Database,
  ArrowRight,
  ShieldCheck,
  Lock,
  Globe
} from 'lucide-react';

interface LoginPageProps {
  onGoogleSignIn: () => Promise<void>;
  onOfflineDemoSignIn?: () => Promise<void>;
  isLoggingIn?: boolean;
  isSyncingData?: boolean;
  syncingMessage?: string;
  errorMsg?: string;
}

export default function LoginPage({
  onGoogleSignIn,
  onOfflineDemoSignIn,
  isLoggingIn = false,
  isSyncingData = false,
  syncingMessage = '',
  errorMsg = ''
}: LoginPageProps) {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-slate-100 to-slate-200 flex flex-col justify-center py-16 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="mx-auto h-20 w-20 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-2xl mb-5 hover:scale-105 transition duration-300">
          <FileSpreadsheet className="w-10 h-10 drop-shadow-sm" />
        </div>
        <h2 className="text-3.5xl font-black text-slate-900 tracking-tight sm:text-4xl">
          Portal Akademik &amp; Extra TIK
        </h2>
        <div className="mt-2.5 flex items-center justify-center gap-2">
          <span className="h-px w-8 bg-slate-300" />
          <p className="text-xs text-slate-500 font-extrabold uppercase tracking-widest">
            SMP Negeri Terintegrasi
          </p>
          <span className="h-px w-8 bg-slate-300" />
        </div>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-md py-10 px-8 shadow-2xl rounded-3xl border border-white/60 space-y-8">
          
          <div className="text-center space-y-2.5">
            <h3 className="text-sm font-black text-slate-800 tracking-wide uppercase flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
              Database &amp; Autentikasi Google
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hubungkan akun Google Anda untuk mengakses data murid, daftar presensi, rekap nilai kelas, dan presensi Extra TIK secara real-time langsung dari Spreadsheet.
            </p>
          </div>

          {isSyncingData && (
            <div className="rounded-2xl bg-indigo-50/80 p-4 border border-indigo-100 flex gap-3 text-xs text-indigo-800 font-bold leading-relaxed items-center shadow-xs">
              <Loader2 className="w-5 h-5 shrink-0 text-indigo-600 animate-spin" />
              <span>{syncingMessage || "Menghubungkan dengan Google Sheets... Mohon tunggu sebentar."}</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-2xl bg-rose-50/80 p-4 border border-rose-100 flex flex-col gap-1.5 text-xs text-rose-700 font-bold leading-relaxed shadow-xs">
              <span className="flex items-center gap-1.5 text-rose-800">
                <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                Gagal Menyambungkan:
              </span>
              <span className="font-medium text-[11px] text-rose-600 pl-3.5 bg-white/50 p-2 rounded-lg border border-rose-100/40">{errorMsg}</span>
              {(errorMsg.includes('network-request-failed') || errorMsg.includes('auth/network-request-failed') || errorMsg.includes('pop-up') || errorMsg.includes('Gagal masuk')) && onOfflineDemoSignIn && (
                <div className="mt-2.5 pt-2.5 border-t border-rose-100 text-[11px] text-slate-600 font-medium space-y-2">
                  <p>
                    <strong>💡 Tips Sandbox AI Studio:</strong> Error jaringan/pop-up ini biasa terjadi karena batasan keamanan iframe pratinjau. Anda dapat melewati login dan langsung membuka sistem dalam Mode Demo Offline.
                  </p>
                  <button
                    onClick={onOfflineDemoSignIn}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Buka Mode Demo Offline Sekarang
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={onGoogleSignIn}
              disabled={isLoggingIn || isSyncingData}
              className="w-full flex justify-center items-center gap-3 py-3.5 px-4 border border-transparent rounded-2xl shadow-md hover:shadow-lg text-xs font-extrabold text-white bg-linear-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 cursor-pointer disabled:from-indigo-400 disabled:to-indigo-500 disabled:shadow-none"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Membuka Autentikasi Google...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                    <g transform="matrix(1, 0, 0, 1, 0, 0)">
                      <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.6h3.29c1.92,-1.78 3.02,-4.4 3.02,-7.4C21.65,11.85 21.55,11.45 21.35,11.1z" fill="#4285F4" />
                      <path d="M12,20.5c2.56,0 4.71,-0.85 6.29,-2.3l-3.29,-2.6c-0.91,0.61 -2.08,0.97 -3,0.97 -2.31,0 -4.27,-1.56 -4.97,-3.66H3.61v2.53C5.18,17.21 8.35,20.5 12,20.5z" fill="#34A853" />
                      <path d="M7.03,12.91c-0.18,-0.54 -0.28,-1.11 -0.28,-1.71s0.1,-1.17 0.28,-1.71V6.96H3.61c-0.61,1.22 -0.96,2.6 -0.96,4.04s0.35,2.82 0.96,4.04L7.03,12.91z" fill="#FBBC05" />
                      <path d="M12,6.93c1.39,0 2.64,0.48 3.62,1.41l2.71,-2.71c-1.63,-1.52 -3.77,-2.45 -6.33,-2.45 -3.65,0 -6.82,3.29 -8.39,6.48l3.42,2.53c0.7,-2.1 2.66,-3.66 4.97,-3.66z" fill="#EA4335" />
                    </g>
                  </svg>
                  Masuk dengan Google Workspace
                </>
              )}
            </button>

            {onOfflineDemoSignIn && (
              <button
                onClick={onOfflineDemoSignIn}
                disabled={isLoggingIn || isSyncingData}
                type="button"
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-slate-200 rounded-2xl text-xs font-extrabold text-slate-600 bg-slate-50 hover:bg-slate-100 focus:outline-none transition duration-150 cursor-pointer disabled:opacity-50"
              >
                <Database className="w-4 h-4 text-emerald-500 shrink-0" />
                Gunakan Mode Demo (Offline / Tanpa Login)
              </button>
            )}
            
            {/* Feature lists for high quality professional feel */}
            <div className="pt-4 border-t border-slate-100/80 grid grid-cols-2 gap-3 text-left">
              <div className="flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span className="text-[10px] font-bold text-slate-600">Aman &amp; Terenkripsi</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span className="text-[10px] font-bold text-slate-600">Sinkronisasi Awan</span>
              </div>
            </div>

            <div className="pt-2 text-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                Sistem Rapor &amp; Presensi Akademik Berbasis Google Drive
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

