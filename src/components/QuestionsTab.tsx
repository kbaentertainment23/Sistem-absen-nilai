import React, { useState, useEffect } from 'react';
import { ExercisePackage, Question, StudentSubmission, GradeColumn } from '../types';
import { 
  Plus, Edit2, Trash2, Check, AlertCircle, BookOpen, FolderPlus, 
  Settings, Award, AlertTriangle, Sparkles, HelpCircle, Eye, X, Link, HelpCircle as QuestionIcon 
} from 'lucide-react';

const DEFAULT_FORMATIVE_COLS = [
  { key: 'f1', label: 'Formatif 1 (F1)' },
  { key: 'f2', label: 'Formatif 2 (F2)' },
  { key: 'f3', label: 'Formatif 3 (F3)' },
  { key: 'f4', label: 'Formatif 4 (F4)' },
];

const DEFAULT_SUMMATIVE_COLS = [
  { key: 's1', label: 'Sumatif 1 (S1)' },
  { key: 's2', label: 'Sumatif 2 (S2)' },
  { key: 's3', label: 'Sumatif 3 (S3)' },
  { key: 'uts', label: 'UTS' },
  { key: 'uas', label: 'UAS' },
];

interface QuestionsTabProps {
  packages: ExercisePackage[];
  submissions: StudentSubmission[];
  onSyncPackages: (updatedPackages: ExercisePackage[]) => Promise<void>;
  classes: { id: number; name: string }[];
  role: 'admin' | 'guru';
  formativeCols?: GradeColumn[];
  summativeCols?: GradeColumn[];
}

export default function QuestionsTab({
  packages,
  submissions,
  onSyncPackages,
  classes,
  role,
  formativeCols = [],
  summativeCols = [],
}: QuestionsTabProps) {
  const [localPackages, setLocalPackages] = useState<ExercisePackage[]>(packages);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  // Active columns fallback
  const activeFormativeCols = formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS;
  const activeSummativeCols = summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS;

  // Package Form States
  const [packageKategori, setPackageKategori] = useState<'Formatif' | 'Sumatif'>('Formatif');
  const [packageName, setPackageName] = useState('');
  const [packageKelas, setPackageKelas] = useState('Semua Kelas');
  const [targetNilaiKey, setTargetNilaiKey] = useState('f1');

  // Modal State for Package Editing
  const [editingPackage, setEditingPackage] = useState<ExercisePackage | null>(null);
  const [editPackageName, setEditPackageName] = useState('');
  const [editPackageKelas, setEditPackageKelas] = useState('Semua Kelas');
  const [editTargetNilaiKey, setEditTargetNilaiKey] = useState('');

  // Question Form States (for the composer)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionTeks, setQuestionTeks] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [keyAnswer, setKeyAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [questionBobot, setQuestionBobot] = useState<number>(10);

  // UI Status Alerts
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  // Modals visibility
  const [packageToDelete, setPackageToDelete] = useState<ExercisePackage | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [showQuestionListModal, setShowQuestionListModal] = useState<boolean>(false);
  const [viewingPackageInModal, setViewingPackageInModal] = useState<ExercisePackage | null>(null);

  // Sync state on packages prop change
  useEffect(() => {
    setLocalPackages(packages);
    if (packages.length > 0 && !selectedPackageId) {
      setSelectedPackageId(packages[0].id);
    }
  }, [packages]);

  // Handle targetNilaiKey defaults when packageKategori changes
  useEffect(() => {
    if (packageKategori === 'Formatif') {
      setTargetNilaiKey(activeFormativeCols[0]?.key || 'f1');
    } else {
      setTargetNilaiKey(activeSummativeCols[0]?.key || 's1');
    }
  }, [packageKategori]);

  const triggerAutoSync = async (updatedList: ExercisePackage[]) => {
    if (role === 'guru') return;
    setIsSyncing(true);
    try {
      await onSyncPackages(updatedList);
      setSuccessText('Perubahan berhasil disimpan ke database Google Sheets.');
      setTimeout(() => setSuccessText(''), 3000);
    } catch (err) {
      console.error('Auto-sync error:', err);
      setErrorText('Gagal menyelaraskan perubahan ke Sheets.');
      setTimeout(() => setErrorText(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Create Exercise Package
  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');

    const trimmedName = packageName.trim();
    if (!trimmedName) {
      setErrorText('Nama latihan soal harus diisi.');
      return;
    }

    const newPackage: ExercisePackage = {
      id: `PKG-${Date.now()}`,
      nama: trimmedName,
      kategori: packageKategori,
      targetKelas: packageKelas,
      targetNilaiKey: targetNilaiKey,
      soalList: [],
    };

    const updated = [...localPackages, newPackage];
    setLocalPackages(updated);
    setSelectedPackageId(newPackage.id);
    
    // Reset package form
    setPackageName('');
    
    await triggerAutoSync(updated);
  };

  // Open Edit Package Modal
  const startEditPackage = (pkg: ExercisePackage) => {
    setEditingPackage(pkg);
    setEditPackageName(pkg.nama);
    setEditPackageKelas(pkg.targetKelas || 'Semua Kelas');
    setEditTargetNilaiKey(pkg.targetNilaiKey || (pkg.kategori === 'Formatif' ? activeFormativeCols[0]?.key : activeSummativeCols[0]?.key));
  };

  // Save Package Edits
  const handleSavePackageEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage) return;

    const trimmedName = editPackageName.trim();
    if (!trimmedName) {
      setErrorText('Nama latihan soal tidak boleh kosong.');
      return;
    }

    const updated = localPackages.map(p => {
      if (p.id === editingPackage.id) {
        return {
          ...p,
          nama: trimmedName,
          targetKelas: editPackageKelas,
          targetNilaiKey: editTargetNilaiKey,
        };
      }
      return p;
    });

    setLocalPackages(updated);
    setEditingPackage(null);

    // Update selected package state to reflect edits if active
    if (selectedPackageId === editingPackage.id) {
      // Just triggers a re-render
    }

    // Update modal state if the modal is currently showing the package being edited
    if (viewingPackageInModal?.id === editingPackage.id) {
      const updatedPkg = updated.find(p => p.id === editingPackage.id);
      if (updatedPkg) setViewingPackageInModal(updatedPkg);
    }

    await triggerAutoSync(updated);
  };

  // Delete Package
  const confirmDeletePackage = async () => {
    if (!packageToDelete) return;
    const pkgId = packageToDelete.id;
    const updated = localPackages.filter(p => p.id !== pkgId);
    setLocalPackages(updated);
    if (selectedPackageId === pkgId) {
      setSelectedPackageId(updated.length > 0 ? updated[0].id : null);
    }
    if (viewingPackageInModal?.id === pkgId) {
      setShowQuestionListModal(false);
      setViewingPackageInModal(null);
    }
    setPackageToDelete(null);
    await triggerAutoSync(updated);
  };

  // Create or Update Question within selected package
  const handleAddOrUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');

    if (!selectedPackageId) {
      setErrorText('Silakan pilih atau buat paket latihan soal terlebih dahulu.');
      return;
    }

    const trimmedTeks = questionTeks.trim();
    const trimmedA = optionA.trim();
    const trimmedB = optionB.trim();
    const trimmedC = optionC.trim();
    const trimmedD = optionD.trim();

    if (!trimmedTeks || !trimmedA || !trimmedB || !trimmedC || !trimmedD) {
      setErrorText('Teks soal dan semua pilihan opsi (A-D) harus diisi.');
      return;
    }

    const targetPkg = localPackages.find(p => p.id === selectedPackageId);
    if (!targetPkg) return;

    let updatedQuestions: Question[] = [];

    if (editingQuestionId) {
      // Edit Question
      updatedQuestions = targetPkg.soalList.map(q =>
        q.id === editingQuestionId
          ? {
              ...q,
              teks: trimmedTeks,
              pilihanA: trimmedA,
              pilihanB: trimmedB,
              pilihanC: trimmedC,
              pilihanD: trimmedD,
              kunci: keyAnswer,
              bobot: Number(questionBobot) || 10,
            }
          : q
      );
      setEditingQuestionId(null);
    } else {
      // Add Question
      const newQ: Question = {
        id: `Q-${Date.now()}`,
        idPaket: selectedPackageId,
        teks: trimmedTeks,
        pilihanA: trimmedA,
        pilihanB: trimmedB,
        pilihanC: trimmedC,
        pilihanD: trimmedD,
        kunci: keyAnswer,
        bobot: Number(questionBobot) || 10,
      };
      updatedQuestions = [...targetPkg.soalList, newQ];
    }

    const updatedPackages = localPackages.map(p =>
      p.id === selectedPackageId ? { ...p, soalList: updatedQuestions } : p
    );

    setLocalPackages(updatedPackages);

    // If modal is showing the edited package, update its contents
    if (viewingPackageInModal?.id === selectedPackageId) {
      const updatedPkg = updatedPackages.find(p => p.id === selectedPackageId);
      if (updatedPkg) setViewingPackageInModal(updatedPkg);
    }

    // Reset question form
    setQuestionTeks('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setKeyAnswer('A');
    setQuestionBobot(10);

    setSuccessText(editingQuestionId ? 'Pertanyaan berhasil diperbarui.' : 'Pertanyaan berhasil ditambahkan.');
    setTimeout(() => setSuccessText(''), 3000);

    await triggerAutoSync(updatedPackages);
  };

  // Edit Question Click
  const startEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setQuestionTeks(q.teks);
    setOptionA(q.pilihanA);
    setOptionB(q.pilihanB);
    setOptionC(q.pilihanC);
    setOptionD(q.pilihanD);
    setKeyAnswer(q.kunci);
    setQuestionBobot(q.bobot || 10);
  };

  // Cancel Edit Question
  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setQuestionTeks('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setKeyAnswer('A');
    setQuestionBobot(10);
  };

  // Delete Question
  const confirmDeleteQuestion = async () => {
    if (!questionToDelete) return;
    const qId = questionToDelete.id;
    const targetPkgId = questionToDelete.idPaket;
    const targetPkg = localPackages.find(p => p.id === targetPkgId);
    if (!targetPkg) return;

    const updatedQs = targetPkg.soalList.filter(q => q.id !== qId);
    const updatedPackages = localPackages.map(p =>
      p.id === targetPkgId ? { ...p, soalList: updatedQs } : p
    );

    setLocalPackages(updatedPackages);

    // If modal is showing the edited package, update its contents
    if (viewingPackageInModal?.id === targetPkgId) {
      const updatedPkg = updatedPackages.find(p => p.id === targetPkgId);
      if (updatedPkg) setViewingPackageInModal(updatedPkg);
    }

    setQuestionToDelete(null);
    await triggerAutoSync(updatedPackages);
  };

  const selectedPackage = localPackages.find(p => p.id === selectedPackageId);
  const totalPackagePoints = selectedPackage?.soalList.reduce((sum, q) => sum + (q.bobot || 0), 0) || 0;

  // Helper to find column label from key
  const findColumnLabel = (category: 'Formatif' | 'Sumatif', key?: string) => {
    if (!key) return '-';
    const cols = category === 'Formatif' ? activeFormativeCols : activeSummativeCols;
    const found = cols.find(c => c.key === key);
    return found ? found.label : key.toUpperCase();
  };

  return (
    <div id="questions-section" className="space-y-6">
      
      {/* Banner Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Kelola Paket Soal Latihan CBT
          </h3>
          <p className="text-xs text-slate-500">
            Hubungkan paket soal dengan nilai akademik siswa (Formatif/Sumatif). Kelola pertanyaan, tentukan bobot nilai, dan buka Bank Soal dalam popup modal yang profesional.
          </p>
        </div>

        <div className="flex gap-2 text-xs font-bold shrink-0">
          <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200">
            {localPackages.length} Paket Latihan
          </span>
          <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl border border-slate-200">
            {localPackages.reduce((sum, p) => sum + p.soalList.length, 0)} Total Soal
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Grid span 5): Manage Packages & List */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Create Package Form */}
          {role === 'admin' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-500" />
                Buat Paket Soal Baru
              </h3>

              <form onSubmit={handleCreatePackage} className="space-y-4">
                
                {/* 1. KATEGORI */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    1. Kategori Penilaian
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Formatif', 'Sumatif'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setPackageKategori(cat)}
                        className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                          packageKategori === cat
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Penilaian {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. NAMA LATIHAN */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    2. Nama Latihan Soal
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bab 1 Relasi dan Fungsi"
                    value={packageName}
                    onChange={e => setPackageName(e.target.value)}
                    className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                  />
                </div>

                {/* 3. TARGET KELAS */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      3. Target Kelas
                    </label>
                    <select
                      value={packageKelas}
                      onChange={e => setPackageKelas(e.target.value)}
                      className="w-full py-2 px-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium cursor-pointer"
                    >
                      <option value="Semua Kelas">Semua Kelas</option>
                      <option value="Kelas 7">Kelas 7</option>
                      <option value="Kelas 8">Kelas 8</option>
                      <option value="Kelas 9">Kelas 9</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 4. LINK KE NILAI AKADEMIK */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Link className="w-3 h-3 text-slate-400" />
                      4. Kolom Nilai
                    </label>
                    <select
                      value={targetNilaiKey}
                      onChange={e => setTargetNilaiKey(e.target.value)}
                      className="w-full py-2 px-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-bold cursor-pointer"
                    >
                      {packageKategori === 'Formatif' ? (
                        activeFormativeCols.map(col => (
                          <option key={col.key} value={col.key}>
                            {col.label}
                          </option>
                        ))
                      ) : (
                        activeSummativeCols.map(col => (
                          <option key={col.key} value={col.key}>
                            {col.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Buat Paket Latihan Soal
                </button>
              </form>
            </div>
          )}

          {/* Package Directory & Active List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Daftar Paket Latihan</span>
              {isSyncing && (
                <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded font-bold animate-pulse font-mono">
                  Sinkron...
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
              {localPackages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada paket latihan. Buat satu untuk mulai menyusun soal.
                </div>
              ) : (
                localPackages.map(pkg => (
                  <div
                    key={pkg.id}
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setEditingQuestionId(null);
                    }}
                    className={`w-full p-4 text-left hover:bg-slate-50/50 transition flex justify-between items-start gap-3 cursor-pointer relative ${
                      selectedPackageId === pkg.id ? 'bg-indigo-50/40 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="space-y-1.5 truncate pr-2 flex-grow">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                          pkg.kategori === 'Sumatif' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {pkg.kategori}
                        </span>
                        <span className="text-[10px] text-slate-400 font-extrabold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{pkg.targetKelas}</span>
                        {pkg.targetNilaiKey && (
                          <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                            <Link className="w-2.5 h-2.5" />
                            {findColumnLabel(pkg.kategori, pkg.targetNilaiKey)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-black text-slate-800 block truncate">{pkg.nama}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {pkg.soalList.length} Soal • Poin: {pkg.soalList.reduce((acc, q) => acc + (q.bobot || 0), 0)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 items-end justify-center self-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingPackageInModal(pkg);
                          setShowQuestionListModal(true);
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1 cursor-pointer transition shadow-xs"
                        title="Lihat Soal / Bank Soal"
                      >
                        <Eye className="w-3 h-3" />
                        Soal ({pkg.soalList.length})
                      </button>

                      <div className="flex gap-1.5">
                        {role === 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditPackage(pkg);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                              title="Edit Pengaturan Paket"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPackageToDelete(pkg);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Hapus Paket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column (Grid span 7): Question Composer Form */}
        <div className="lg:col-span-7 space-y-6">
          
          {selectedPackage ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              
              {/* Active Target Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Menyusun Pertanyaan Untuk:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-black text-slate-950">{selectedPackage.nama}</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-150 font-black">{selectedPackage.kategori}</span>
                  </div>
                  {selectedPackage.targetNilaiKey && (
                    <span className="text-[10px] text-slate-400 font-bold block mt-1">
                      🔗 Terhubung Akademik: <strong className="text-slate-600">{findColumnLabel(selectedPackage.kategori, selectedPackage.targetNilaiKey)}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-bold">Total Bobot:</span>
                    <span className="text-indigo-600 text-sm font-black block">{totalPackagePoints} Poin</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setViewingPackageInModal(selectedPackage);
                      setShowQuestionListModal(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Eye className="w-4 h-4" />
                    Bank Soal ({selectedPackage.soalList.length})
                  </button>
                </div>
              </div>

              {role === 'guru' ? (
                <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Akses Guru Terbatas</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Hanya pengguna dengan tingkat akses <strong>Admin</strong> yang diperkenankan untuk menambah, mengedit, atau menghapus pertanyaan di Bank Soal.
                  </p>
                </div>
              ) : (
                <>
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      {editingQuestionId ? '📝 Edit Pertanyaan Aktif' : '✍️ Buat Pertanyaan Baru'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Isi pertanyaan pilihan ganda dengan bobot nilai khusus di bawah ini.
                    </p>
                  </div>

                  <form onSubmit={handleAddOrUpdateQuestion} className="space-y-4">
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      
                      {/* Bobot Nilai */}
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Bobot Nilai (Poin)
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          max={100}
                          value={questionBobot}
                          onChange={e => setQuestionBobot(Number(e.target.value))}
                          className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-indigo-700 bg-slate-50"
                        />
                      </div>

                      {/* Teks Pertanyaan */}
                      <div className="md:col-span-8">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Pertanyaan / Soal Cerita
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Manakah yang termasuk fungsi kuadrat?"
                          value={questionTeks}
                          onChange={e => setQuestionTeks(e.target.value)}
                          className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                        />
                      </div>

                    </div>

                    {/* Multiple Choice Options */}
                    <div className="space-y-3">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Pilihan Opsi Ganda (Ketik teks pilihan)
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-black bg-slate-100 px-2.5 py-2 rounded-xl border border-slate-200 shrink-0">A</span>
                          <input
                            type="text"
                            required
                            placeholder="Teks Pilihan A"
                            value={optionA}
                            onChange={e => setOptionA(e.target.value)}
                            className="flex-grow py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-black bg-slate-100 px-2.5 py-2 rounded-xl border border-slate-200 shrink-0">B</span>
                          <input
                            type="text"
                            required
                            placeholder="Teks Pilihan B"
                            value={optionB}
                            onChange={e => setOptionB(e.target.value)}
                            className="flex-grow py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-black bg-slate-100 px-2.5 py-2 rounded-xl border border-slate-200 shrink-0">C</span>
                          <input
                            type="text"
                            required
                            placeholder="Teks Pilihan C"
                            value={optionC}
                            onChange={e => setOptionC(e.target.value)}
                            className="flex-grow py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-black bg-slate-100 px-2.5 py-2 rounded-xl border border-slate-200 shrink-0">D</span>
                          <input
                            type="text"
                            required
                            placeholder="Teks Pilihan D"
                            value={optionD}
                            onChange={e => setOptionD(e.target.value)}
                            className="flex-grow py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Kunci Jawaban */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Kunci Jawaban yang Benar
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['A', 'B', 'C', 'D'] as const).map(ch => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => setKeyAnswer(ch)}
                            className={`py-2 rounded-xl border text-xs font-black transition cursor-pointer text-center ${
                              keyAnswer === ch
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            Opsi {ch}
                          </button>
                        ))}
                      </div>
                    </div>

                    {errorText && (
                      <div className="text-[11px] text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {errorText}
                      </div>
                    )}

                    {successText && (
                      <div className="text-[11px] text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100 font-bold flex items-center gap-1.5">
                        <Check className="w-4 h-4 shrink-0" />
                        {successText}
                      </div>
                    )}

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="submit"
                        className="flex-grow bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {editingQuestionId ? 'Perbarui Pertanyaan' : 'Simpan Pertanyaan'}
                      </button>
                      {editingQuestionId && (
                        <button
                          type="button"
                          onClick={cancelEditQuestion}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Batal
                        </button>
                      )}
                    </div>

                  </form>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-16 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center gap-4 h-[350px]">
              <AlertCircle className="w-10 h-10 text-indigo-600 animate-bounce" />
              <div>
                <p className="font-bold text-slate-800">Tidak ada Paket Latihan Terpilih</p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Pilih salah satu paket latihan dari kolom sebelah kiri atau buat paket baru untuk mulai menyusun pertanyaan.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* QUESTION LIST POPUP MODAL (User Requirement: Question list made into a professional popup) */}
      {showQuestionListModal && viewingPackageInModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                    viewingPackageInModal.kategori === 'Sumatif' 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    {viewingPackageInModal.kategori}
                  </span>
                  <span className="text-[10px] text-slate-400 font-extrabold bg-white px-1.5 py-0.5 rounded border border-slate-100">{viewingPackageInModal.targetKelas}</span>
                </div>
                <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Bank Soal: {viewingPackageInModal.nama}
                </h3>
                {viewingPackageInModal.targetNilaiKey && (
                  <p className="text-[11px] text-slate-500 font-medium">
                    🔗 Terhubung ke Nilai Akademik: <strong className="text-indigo-600">{findColumnLabel(viewingPackageInModal.kategori, viewingPackageInModal.targetNilaiKey)}</strong>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-bold">
                  <span className="text-[9px] text-slate-400 uppercase block tracking-wider leading-none">Skor Total:</span>
                  <span className="text-indigo-600 text-sm font-black mt-1 block">
                    {viewingPackageInModal.soalList.reduce((acc, q) => acc + (q.bobot || 0), 0)} Poin
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuestionListModal(false);
                    setViewingPackageInModal(null);
                  }}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable Question Items */}
            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/20 max-h-[60vh] divide-y divide-slate-100">
              {viewingPackageInModal.soalList.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <QuestionIcon className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">Belum ada pertanyaan di paket ini</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Gunakan panel input form pertanyaan di halaman utama untuk memasukkan soal baru terlebih dahulu.
                  </p>
                </div>
              ) : (
                viewingPackageInModal.soalList.map((q, idx) => (
                  <div key={q.id} className={`pt-4 ${idx === 0 ? 'pt-0' : ''} space-y-3`}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-150">
                            Soal Ke-{idx + 1}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Bobot: {q.bobot || 10} Poin
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-slate-800 leading-relaxed pt-1.5">
                          {q.teks}
                        </p>
                      </div>

                      {role === 'admin' && (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              // Select parent package first so composer switches
                              setSelectedPackageId(q.idPaket);
                              // Start editing the question
                              startEditQuestion(q);
                              // Close this modal to let them use the composer
                              setShowQuestionListModal(false);
                              setViewingPackageInModal(null);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Edit Soal"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuestionToDelete(q)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Hapus Soal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Options (A-D) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className={`p-2.5 rounded-xl border flex items-start gap-1.5 ${
                        q.kunci === 'A' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' 
                          : 'bg-white border-slate-100 text-slate-600'
                      }`}>
                        <span className="font-mono font-black text-[11px] text-slate-400">A.</span>
                        <span>{q.pilihanA}</span>
                      </div>

                      <div className={`p-2.5 rounded-xl border flex items-start gap-1.5 ${
                        q.kunci === 'B' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' 
                          : 'bg-white border-slate-100 text-slate-600'
                      }`}>
                        <span className="font-mono font-black text-[11px] text-slate-400">B.</span>
                        <span>{q.pilihanB}</span>
                      </div>

                      <div className={`p-2.5 rounded-xl border flex items-start gap-1.5 ${
                        q.kunci === 'C' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' 
                          : 'bg-white border-slate-100 text-slate-600'
                      }`}>
                        <span className="font-mono font-black text-[11px] text-slate-400">C.</span>
                        <span>{q.pilihanC}</span>
                      </div>

                      <div className={`p-2.5 rounded-xl border flex items-start gap-1.5 ${
                        q.kunci === 'D' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' 
                          : 'bg-white border-slate-100 text-slate-600'
                      }`}>
                        <span className="font-mono font-black text-[11px] text-slate-400">D.</span>
                        <span>{q.pilihanD}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 font-bold font-mono">
                      KUNCI JAWABAN BENAR: <strong className="text-emerald-600">{q.kunci}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowQuestionListModal(false);
                  setViewingPackageInModal(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Tutup Bank Soal
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EDIT PACKAGE SETTINGS MODAL */}
      {editingPackage && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-950">Pengaturan Paket Latihan</h3>
                <p className="text-[11px] text-slate-500">Edit nama, target kelas, atau pemetaan akademik paket soal.</p>
              </div>
            </div>

            <form onSubmit={handleSavePackageEdits} className="space-y-4">
              
              {/* Nama */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nama Latihan Soal
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama Paket"
                  value={editPackageName}
                  onChange={e => setEditPackageName(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
                />
              </div>

              {/* Target Kelas */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Target Kelas
                </label>
                <select
                  value={editPackageKelas}
                  onChange={e => setEditPackageKelas(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium cursor-pointer"
                >
                  <option value="Semua Kelas">Semua Kelas</option>
                  <option value="Kelas 7">Kelas 7</option>
                  <option value="Kelas 8">Kelas 8</option>
                  <option value="Kelas 9">Kelas 9</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.name}>{cls.name}</option>
                  ))}
                </select>
              </div>

              {/* Target Nilai Key */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Link className="w-3 h-3 text-slate-400" />
                  Hubungkan ke Nilai Akademik
                </label>
                <select
                  value={editTargetNilaiKey}
                  onChange={e => setEditTargetNilaiKey(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-bold cursor-pointer"
                >
                  <option value="">-- Tidak Dihubungkan --</option>
                  {editingPackage.kategori === 'Formatif' ? (
                    activeFormativeCols.map(col => (
                      <option key={col.key} value={col.key}>
                        {col.label}
                      </option>
                    ))
                  ) : (
                    activeSummativeCols.map(col => (
                      <option key={col.key} value={col.key}>
                        {col.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPackage(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* DELETE PACKAGE CONFIRMATION MODAL */}
      {packageToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Hapus Paket Latihan Soal?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {packageToDelete.nama} ({packageToDelete.kategori})
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-rose-50/30 border border-rose-100 rounded-xl p-4 space-y-2">
              <p>
                Menghapus paket latihan ini juga akan menghapus seluruh <strong>{packageToDelete.soalList.length} soal</strong> di dalamnya secara permanen dari database Google Sheets.
              </p>
              <p className="text-[10px] text-rose-700 font-bold bg-white/90 p-2.5 rounded-lg border border-rose-100">
                ⚠️ PERINGATAN: Nilai siswa CBT yang sudah pengerjaan tidak hilang, namun paket latihan ini tidak akan bisa diakses lagi oleh siswa kelas target.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPackageToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeletePackage}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Hapus Paket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE QUESTION CONFIRMATION MODAL (z-index is high to render on top of the Question List modal) */}
      {questionToDelete && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Hapus Pertanyaan Soal?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-rose-50/30 border border-rose-100 rounded-xl p-4 space-y-2">
              <p className="font-semibold text-slate-800">Teks Pertanyaan:</p>
              <p className="italic bg-white p-3 rounded-lg border border-slate-100 text-[11px] text-slate-500 max-h-24 overflow-y-auto leading-relaxed">
                "{questionToDelete.teks}"
              </p>
              <p className="text-[10px] text-rose-700 font-bold">
                Apakah Anda benar-benar yakin ingin menghapus pertanyaan ini?
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setQuestionToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteQuestion}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Hapus Soal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
