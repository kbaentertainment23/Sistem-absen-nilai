import React, { useState } from 'react';
import { ExercisePackage, ActiveAssessment, StudentSubmission, Student, RetakePermission } from '../types';
import { Plus, Trash2, Check, AlertCircle, Key, Award, Users, Play, Square, Eye, Sparkles, Search, FileSpreadsheet, X, RefreshCw } from 'lucide-react';

interface AssessmentsTabProps {
  packages: ExercisePackage[];
  assessments: ActiveAssessment[];
  onSyncAssessments: (updatedAssessments: ActiveAssessment[]) => Promise<void>;
  classes: { id: number; name: string }[];
  role: 'admin' | 'guru';
  submissions: StudentSubmission[];
  students: Student[];
  retakePermissions: RetakePermission[];
  onSyncRetakes: (updatedRetakes: RetakePermission[]) => Promise<void>;
  // Real-time CBT monitoring props
  isRealtimeActive?: boolean;
  onToggleRealtime?: (active: boolean) => void;
  lastSyncTime?: string;
  onRefreshData?: () => Promise<void>;
}

export default function AssessmentsTab({
  packages,
  assessments,
  onSyncAssessments,
  classes,
  role,
  submissions,
  students,
  retakePermissions,
  onSyncRetakes,
  isRealtimeActive = true,
  onToggleRealtime,
  lastSyncTime = '',
  onRefreshData,
}: AssessmentsTabProps) {
  const [localAssessments, setLocalAssessments] = useState<ActiveAssessment[]>(assessments);
  
  // Form States
  const [selectedPaketId, setSelectedPaketId] = useState('');
  const [targetKelas, setTargetKelas] = useState('Semua Kelas');
  const [tokenInput, setTokenInput] = useState('');
  const [statusInput, setStatusInput] = useState<'Aktif' | 'Tidak Aktif'>('Aktif');

  // Form States for Retake Permissions
  const [retakeStudentNis, setRetakeStudentNis] = useState('');
  const [retakePaketId, setRetakePaketId] = useState('');

  // Submissions and Exam Results filtering states
  const [examSearchQuery, setExamSearchQuery] = useState('');
  const [examClassFilter, setExamClassFilter] = useState('Semua Kelas');
  const [examPackageFilter, setExamPackageFilter] = useState('Semua Paket');
  const [selectedSubDetail, setSelectedSubDetail] = useState<StudentSubmission | null>(null);

  const filteredSubmissions = (submissions || []).filter(s => {
    const matchSearch = examSearchQuery.trim() === '' || 
      (s.nama || '').toLowerCase().includes(examSearchQuery.toLowerCase()) || 
      (s.nis || '').toLowerCase().includes(examSearchQuery.toLowerCase());
    
    const matchClass = examClassFilter === 'Semua Kelas' || s.kelas === examClassFilter;
    const matchPackage = examPackageFilter === 'Semua Paket' || s.namaPaket === examPackageFilter || s.idPaket === examPackageFilter;
    
    return matchSearch && matchClass && matchPackage;
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  // Delete modal state
  const [assessmentToDelete, setAssessmentToDelete] = useState<ActiveAssessment | null>(null);

  const confirmDeleteAssessment = async () => {
    if (!assessmentToDelete) return;
    const updated = localAssessments.filter(a => a.id !== assessmentToDelete.id);
    setLocalAssessments(updated);
    setAssessmentToDelete(null);
    await triggerAutoSync(updated);
  };

  const handleAddRetakePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retakeStudentNis || !retakePaketId) {
      setErrorText('Silakan pilih Siswa dan Paket Soal.');
      return;
    }

    const selectedStudent = students.find(s => s.nis.toString() === retakeStudentNis);
    const selectedPkg = packages.find(p => p.id === retakePaketId);
    if (!selectedStudent || !selectedPkg) return;

    // Check if already has an active permission
    const exists = (retakePermissions || []).some(
      r => r.nis === selectedStudent.nis && r.idPaket === selectedPkg.id && r.status === 'Aktif'
    );
    if (exists) {
      setErrorText('Siswa tersebut sudah memiliki hak akses retake aktif untuk paket ini.');
      return;
    }

    const newPermission: RetakePermission = {
      id: `R-${Date.now()}`,
      nis: selectedStudent.nis,
      nama: selectedStudent.nama,
      kelas: selectedStudent.kelas || '',
      idPaket: selectedPkg.id,
      namaPaket: selectedPkg.nama,
      tanggalDisetujui: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      status: 'Aktif'
    };

    const updated = [...(retakePermissions || []), newPermission];
    setIsSyncing(true);
    try {
      await onSyncRetakes(updated);
      setSuccessText('Akses retake berhasil diberikan.');
      setTimeout(() => setSuccessText(''), 3000);
      setRetakeStudentNis('');
      setRetakePaketId('');
    } catch (err) {
      console.error(err);
      setErrorText('Gagal menyimpan akses retake.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRevokeRetake = async (id: string) => {
    const updated = (retakePermissions || []).filter(r => r.id !== id);
    setIsSyncing(true);
    try {
      await onSyncRetakes(updated);
      setSuccessText('Akses retake berhasil dicabut.');
      setTimeout(() => setSuccessText(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorText('Gagal mencabut akses retake.');
    } finally {
      setIsSyncing(false);
    }
  };

  React.useEffect(() => {
    setLocalAssessments(assessments);
  }, [assessments]);

  // Sync helpers
  const triggerAutoSync = async (updatedList: ActiveAssessment[]) => {
    if (role === 'guru') return;
    setIsSyncing(true);
    try {
      await onSyncAssessments(updatedList);
      setSuccessText('Perubahan berhasil disinkronkan ke Google Sheets.');
      setTimeout(() => setSuccessText(''), 3000);
    } catch (err) {
      console.error('Auto-sync error:', err);
      setErrorText('Gagal melakukan sinkronisasi ke Sheets.');
      setTimeout(() => setErrorText(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGenerateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTokenInput(token);
  };

  const handleAddAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');

    if (!selectedPaketId) {
      setErrorText('Silakan pilih Paket Latihan terlebih dahulu.');
      return;
    }

    const trimmedToken = tokenInput.trim().toUpperCase();
    if (!trimmedToken) {
      setErrorText('Token pengerjaan harus diisi.');
      return;
    }

    // Check if duplicate token
    if (localAssessments.some(a => a.status === 'Aktif' && a.token.toUpperCase() === trimmedToken)) {
      setErrorText('Token ini sedang digunakan oleh penilaian aktif lain. Silakan buat token unik.');
      return;
    }

    const newAssessment: ActiveAssessment = {
      id: `A-${Date.now()}`,
      idPaket: selectedPaketId,
      targetKelas,
      token: trimmedToken,
      status: statusInput,
    };

    const updated = [...localAssessments, newAssessment];
    setLocalAssessments(updated);
    
    // Clear inputs
    setSelectedPaketId('');
    setTargetKelas('Semua Kelas');
    setTokenInput('');
    setStatusInput('Aktif');

    await triggerAutoSync(updated);
  };

  const handleDelete = (a: ActiveAssessment) => {
    setAssessmentToDelete(a);
  };

  const handleToggleStatus = async (a: ActiveAssessment) => {
    if (role === 'guru') return;
    const nextStatus = a.status === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
    const updated = localAssessments.map(item =>
      item.id === a.id ? { ...item, status: nextStatus } : item
    );
    setLocalAssessments(updated);
    await triggerAutoSync(updated);
  };

  return (
    <div id="assessments-section" className="space-y-6">
      
      {/* Banner Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            Penilaian Aktif Siswa (CBT Control Panel)
          </h3>
          <p className="text-xs text-slate-500">
            Aktifkan latihan soal untuk kelas tertentu dan tetapkan token ujian agar siswa dapat mulai mengerjakan tes.
          </p>
        </div>

        <div className="flex gap-2 text-xs font-bold shrink-0">
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200">
            {localAssessments.filter(a => a.status === 'Aktif').length} Penilaian Aktif
          </span>
          <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl border border-slate-200">
            {submissions.length} Total Selesai
          </span>
        </div>
      </div>

      {/* Real-time Monitor Status Indicator */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-md border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3 shrink-0">
            {isRealtimeActive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-500"></span>
            )}
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              Monitor Real-Time Hasil Ujian
              {isRealtimeActive && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30 animate-pulse">
                  AKTIF (15s)
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-400">
              {isRealtimeActive 
                ? `Terakhir disinkronkan: ${lastSyncTime || 'menghubungkan...'} (Auto-refresh aktif)`
                : 'Auto-refresh dinonaktifkan. Hasil pengerjaan siswa tidak akan disinkronkan secara otomatis.'}
            </p>
            <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1.5 text-[9px] font-bold text-slate-300 uppercase tracking-wider">
              <span className="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-slate-200">
                <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                NIS
              </span>
              <span className="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-slate-200">
                <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                Nama Siswa
              </span>
              <span className="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/60 text-slate-200">
                <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                Skor Siswa
              </span>
              <span className="text-[9px] text-indigo-400 flex items-center normal-case font-normal italic">
                → Sinkronisasi kolom khusus "Hasil Ujian Siswa" aktif
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => onToggleRealtime && onToggleRealtime(!isRealtimeActive)}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
              isRealtimeActive 
                ? 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRealtimeActive ? '' : ''}`} />
            {isRealtimeActive ? 'Matikan Auto-Refresh' : 'Aktifkan Auto-Refresh'}
          </button>
          
          <button
            type="button"
            onClick={async () => {
              if (onRefreshData) {
                await onRefreshData();
              }
            }}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-[11px] font-bold transition border border-slate-700 flex items-center justify-center cursor-pointer"
          >
            Segarkan Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activator Form Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs h-fit space-y-4">
          {role === 'guru' ? (
            <div className="space-y-3">
              <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Akses Terbatas (Guru)</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Hanya peran <strong>Admin</strong> yang dapat mengaktifkan penilaian, membuat token pengerjaan, atau menghapus konfigurasi CBT.
                </p>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Aktifkan Penilaian Baru
              </h3>

              <form onSubmit={handleAddAssessment} className="space-y-4">
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Pilih Paket Soal Latihan
                  </label>
                  <select
                    required
                    value={selectedPaketId}
                    onChange={e => setSelectedPaketId(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
                  >
                    <option value="">-- Pilih Paket Soal --</option>
                    {packages.map(pkg => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.kategori} - {pkg.nama} ({pkg.soalList.length} Soal)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Aktifkan Untuk Kelas
                  </label>
                  <select
                    value={targetKelas}
                    onChange={e => setTargetKelas(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.name}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Token Pengerjaan Siswa
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: ANALIS"
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value.toUpperCase())}
                      className="flex-grow py-2 px-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold tracking-widest text-indigo-700"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateToken}
                      className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-bold transition border border-slate-200 cursor-pointer shrink-0"
                    >
                      Acak
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Siswa harus mengetik token ini persis sebelum membuka lembar soal.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Status Awal
                  </label>
                  <select
                    value={statusInput}
                    onChange={e => setStatusInput(e.target.value as 'Aktif' | 'Tidak Aktif')}
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-bold"
                  >
                    <option value="Aktif">Aktif (Langsung Bisa Dikerjakan)</option>
                    <option value="Tidak Aktif">Tidak Aktif (Disembunyikan)</option>
                  </select>
                </div>

                {errorText && (
                  <div className="p-2.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorText}
                  </div>
                )}

                {successText && (
                  <div className="p-2.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 shrink-0" />
                    {successText}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Buat Penilaian CBT
                </button>
              </form>
            </>
          )}
        </div>

        {/* Live Active Assessments Board */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daftar Penilaian Saat Ini</span>
            {isSyncing && (
              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 animate-pulse font-bold font-mono">
                Menyimpan...
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
            {localAssessments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Belum ada ujian/penilaian yang dikonfigurasi. Buat satu menggunakan panel di sebelah kiri.
              </div>
            ) : (
              localAssessments.map(a => {
                const pkg = packages.find(p => p.id === a.idPaket);
                const packageSubmissions = submissions.filter(s => s.idPaket === a.idPaket);
                
                return (
                  <div key={a.id} className="p-4 hover:bg-slate-50/40 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1.5 flex-grow">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                          pkg?.kategori === 'Sumatif' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {pkg?.kategori || 'Tes'}
                        </span>
                        
                        <span className="text-xs font-bold text-slate-800">
                          {pkg ? pkg.nama : `ID Paket: ${a.idPaket}`}
                        </span>

                        <span className="text-[10px] text-slate-400 font-medium">
                          ({pkg?.soalList.length || 0} Soal)
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          Kelas: <strong className="text-indigo-600 font-bold">{a.targetKelas}</strong>
                        </span>

                        <span className="flex items-center gap-1 font-mono text-indigo-950 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          <Key className="w-3 h-3 text-slate-500 shrink-0" />
                          Token: {a.token}
                        </span>

                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          {packageSubmissions.length} Selesai Mengerjakan
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(a)}
                        disabled={role === 'guru'}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                          a.status === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {a.status === 'Aktif' ? (
                          <>
                            <Play className="w-3 h-3 text-emerald-600 fill-emerald-600 shrink-0" />
                            Aktif
                          </>
                        ) : (
                          <>
                            <Square className="w-3 h-3 text-slate-400 fill-slate-400 shrink-0" />
                            Non-aktif
                          </>
                        )}
                      </button>

                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(a)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Hapus Penilaian"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* SECTION 2: AKSES RETAKE / REMEDIAL */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-8">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Hak Akses Retake Ujian (Remedial)
          </h3>
          <p className="text-xs text-slate-500">
            Berikan izin khusus bagi siswa yang telah menyelesaikan ujian agar mereka dapat mengerjakan kembali ujian tersebut untuk memperbaiki nilainya.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs h-fit space-y-4">
          {role === 'guru' ? (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Hanya peran <strong>Admin</strong> yang dapat memberikan hak akses ujian ulang (remedial).
            </p>
          ) : (
            <>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Izinkan Siswa Mengerjakan Ulang
              </h3>

              <form onSubmit={handleAddRetakePermission} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Pilih Siswa
                  </label>
                  <select
                    required
                    value={retakeStudentNis}
                    onChange={e => setRetakeStudentNis(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {(students || []).map(st => (
                      <option key={st.nis} value={st.nis}>
                        {st.kelas} - {st.nama} ({st.nis})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Pilih Paket Soal Latihan
                  </label>
                  <select
                    required
                    value={retakePaketId}
                    onChange={e => setRetakePaketId(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="">-- Pilih Paket Soal --</option>
                    {packages.map(pkg => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.kategori} - {pkg.nama} ({pkg.soalList.length} Soal)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Berikan Akses Retake
                </button>
              </form>
            </>
          )}
        </div>

        {/* Permissions List Table/Board */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Daftar Izin Retake Aktif & Digunakan
            </span>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[350px]">
            {(!retakePermissions || retakePermissions.length === 0) ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Belum ada izin retake pengerjaan soal yang diberikan.
              </div>
            ) : (
              retakePermissions.map(r => {
                const pkgName = packages.find(p => p.id === r.idPaket)?.nama || r.namaPaket;
                return (
                  <div key={r.id} className="p-4 hover:bg-slate-50/40 transition flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{r.nama}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({r.nis})</span>
                      </div>
                      <p className="text-xs font-semibold text-indigo-600">
                        {pkgName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Disetujui: {r.tanggalDisetujui}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                        r.status === 'Aktif' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {r.status === 'Aktif' ? 'Aktif' : 'Digunakan'}
                      </span>

                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeRetake(r.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Hapus / Cabut Izin"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: HASIL UJIAN SISWA (GURU/ADMIN DASHBOARD) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-8">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Hasil Ujian Siswa (Database Google Spreadsheet)
          </h3>
          <p className="text-xs text-slate-500">
            Seluruh data pengerjaan sumatif dan formatif siswa disimpan secara otomatis di lembar <strong>Hasil Ujian Siswa</strong> dan <strong>Jawaban Siswa</strong>.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filters */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Cari nama atau NIS siswa..."
              value={examSearchQuery}
              onChange={(e) => setExamSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* Filter Kelas */}
            <select
              value={examClassFilter}
              onChange={(e) => setExamClassFilter(e.target.value)}
              className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 font-semibold cursor-pointer"
            >
              <option value="Semua Kelas">Semua Kelas</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            {/* Filter Paket */}
            <select
              value={examPackageFilter}
              onChange={(e) => setExamPackageFilter(e.target.value)}
              className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 font-semibold cursor-pointer max-w-[200px]"
            >
              <option value="Semua Paket">Semua Paket</option>
              {packages.map(p => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Absen</th>
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Ujian / Paket Soal</th>
                <th className="py-3 px-4 text-center">ID Soal (Nilai Key)</th>
                <th className="py-3 px-4 text-center">Skor / Nilai</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Tanggal Pengerjaan</th>
                <th className="py-3 px-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    Belum ada data pengerjaan ujian yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((s) => {
                  const sInfo = students.find(st => st.nis?.toString().trim() === s.nis?.toString().trim());
                  const absen = s.noAbsen || sInfo?.noAbsen || '-';
                  const idSoalKey = s.idSoal || (packages.find(p => p.id === s.idPaket)?.targetNilaiKey) || s.idPaket;
                  const scoreColor = s.persentase >= 75 ? 'text-emerald-600' : 'text-rose-600';
                  
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-bold text-slate-400">{absen}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{s.nis}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">{s.nama}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">{s.kelas}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {s.namaPaket}
                        <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-500 rounded border border-slate-200">
                          {s.kategoriPaket}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-mono font-bold border border-indigo-100">
                          {idSoalKey}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-sm">
                        <span className={scoreColor}>{s.persentase}%</span>
                        <span className="text-[10px] text-slate-400 block font-normal">
                          ({s.nilaiTotal}/{s.nilaiMaksimal})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold inline-block border ${
                          s.persentase >= 75
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {s.persentase >= 75 ? 'Lulus' : 'Remedial'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-medium">{s.tanggal}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedSubDetail(s)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-indigo-600 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Assessment Confirmation Modal */}
      {assessmentToDelete && (() => {
        const pkg = packages.find(p => p.id === assessmentToDelete.idPaket);
        return (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-250">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-250">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-950">
                    Hapus Ujian / Penilaian?
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {pkg?.nama || `Paket ID: ${assessmentToDelete.idPaket}`}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed bg-rose-50/30 border border-rose-100 rounded-xl p-3.5 space-y-2">
                <p>
                  Apakah Anda yakin ingin menghapus konfigurasi penilaian CBT ini?
                </p>
                <div className="space-y-1 text-[11px] bg-white p-2.5 rounded-lg border border-slate-100 font-medium text-slate-700">
                  <p>• Kelas Target: <strong className="text-indigo-600 font-bold">{assessmentToDelete.targetKelas}</strong></p>
                  <p>• Token Ujian: <strong className="text-indigo-950 font-mono font-extrabold">{assessmentToDelete.token}</strong></p>
                  <p>• Jumlah Soal: <span className="font-bold">{pkg?.soalList.length || 0} Soal</span></p>
                </div>
                <p className="text-[10px] text-rose-700 font-medium">
                  ⚠️ Penilaian ini tidak akan muncul lagi di halaman dashboard siswa.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setAssessmentToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAssessment}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  Hapus Penilaian
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Detail Submission / Hasil Pengerjaan Modal */}
      {selectedSubDetail && (() => {
        const p = packages.find(pkg => pkg.id === selectedSubDetail.idPaket);
        let answersMap: Record<string, string> = {};
        try {
          answersMap = JSON.parse(selectedSubDetail.detailJawaban || '{}');
        } catch (e) {}

        return (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-3xl">
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-950">
                    Detail Lembar Jawaban Siswa
                  </h3>
                  <p className="text-xs text-slate-500">
                    Siswa: <strong>{selectedSubDetail.nama}</strong> ({selectedSubDetail.nis}) • Kelas: {selectedSubDetail.kelas}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSubDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body / Scroll Area */}
              <div className="p-6 overflow-y-auto space-y-6 flex-grow">
                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Kategori Ujian</span>
                    <p className="text-xs font-bold text-slate-800">
                      {selectedSubDetail.namaPaket} ({selectedSubDetail.kategoriPaket})
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Skor Persentase</span>
                    <p className="text-base font-extrabold text-indigo-600">{selectedSubDetail.persentase}%</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Status Hasil</span>
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-block ${
                        selectedSubDetail.persentase >= 75
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {selectedSubDetail.persentase >= 75 ? 'Lulus' : 'Remedial'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Question and Answer Breakdown */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Analisis Jawaban Per Butir Soal
                  </h4>

                  {!p || p.soalList.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      Daftar soal asli tidak dapat dimuat atau telah dihapus.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {p.soalList.map((q, idx) => {
                        const studentAns = answersMap[q.id] || '';
                        const isCorrect = studentAns === q.kunci;
                        
                        return (
                          <div key={q.id} className={`p-4 rounded-2xl border transition ${
                            isCorrect 
                              ? 'bg-emerald-50/20 border-emerald-100' 
                              : 'bg-rose-50/20 border-rose-100'
                          }`}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <span className="text-xs font-bold text-slate-400 shrink-0 mt-0.5">
                                Soal {idx + 1}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 ${
                                isCorrect 
                                  ? 'bg-emerald-100/60 text-emerald-800' 
                                  : 'bg-rose-100/60 text-rose-800'
                              }`}>
                                {isCorrect ? 'Benar' : 'Salah'}
                              </span>
                            </div>

                            <p className="text-xs font-bold text-slate-800 mb-3 leading-relaxed">
                              {q.teks}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] mb-3">
                              <div className={`p-2 rounded-lg border ${q.kunci === 'A' ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold' : 'bg-white border-slate-100 text-slate-600'} ${studentAns === 'A' && !isCorrect ? 'bg-rose-50 border-rose-200 text-rose-950 font-bold' : ''}`}>
                                A. {q.pilihanA} {studentAns === 'A' && '👈 (Pilihan Siswa)'}
                              </div>
                              <div className={`p-2 rounded-lg border ${q.kunci === 'B' ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold' : 'bg-white border-slate-100 text-slate-600'} ${studentAns === 'B' && !isCorrect ? 'bg-rose-50 border-rose-200 text-rose-950 font-bold' : ''}`}>
                                B. {q.pilihanB} {studentAns === 'B' && '👈 (Pilihan Siswa)'}
                              </div>
                              <div className={`p-2 rounded-lg border ${q.kunci === 'C' ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold' : 'bg-white border-slate-100 text-slate-600'} ${studentAns === 'C' && !isCorrect ? 'bg-rose-50 border-rose-200 text-rose-950 font-bold' : ''}`}>
                                C. {q.pilihanC} {studentAns === 'C' && '👈 (Pilihan Siswa)'}
                              </div>
                              <div className={`p-2 rounded-lg border ${q.kunci === 'D' ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold' : 'bg-white border-slate-100 text-slate-600'} ${studentAns === 'D' && !isCorrect ? 'bg-rose-50 border-rose-200 text-rose-950 font-bold' : ''}`}>
                                D. {q.pilihanD} {studentAns === 'D' && '👈 (Pilihan Siswa)'}
                              </div>
                            </div>

                            <div className="flex gap-4 text-[10px] font-bold text-slate-500 bg-white/60 p-2 rounded-lg border border-slate-100">
                              <p>Jawaban Siswa: <span className={isCorrect ? 'text-emerald-700' : 'text-rose-700'}>{studentAns || 'Tidak Dijawab'}</span></p>
                              <p>Kunci Jawaban: <span className="text-emerald-700">{q.kunci}</span></p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setSelectedSubDetail(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
