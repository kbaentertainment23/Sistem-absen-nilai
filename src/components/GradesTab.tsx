import React, { useState, useEffect } from 'react';
import { Student, GradeFormative, GradeSummative, GradeColumn } from '../types';
import { getStudentPhotoUrl } from '../lib/googleSheets';
import { Search, Save, Check, AlertCircle, Sparkles, Loader2, BookOpen, GraduationCap, User, X } from 'lucide-react';

interface GradesTabProps {
  students: Student[];
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  onSave: (
    formative: GradeFormative[],
    summative: GradeSummative[],
    customFormativeCols?: GradeColumn[],
    customSummativeCols?: GradeColumn[]
  ) => Promise<void>;
  formativeCols?: GradeColumn[];
  setFormativeCols?: React.Dispatch<React.SetStateAction<GradeColumn[]>>;
  summativeCols?: GradeColumn[];
  setSummativeCols?: React.Dispatch<React.SetStateAction<GradeColumn[]>>;
}

const DEFAULT_FORMATIVE_COLS: GradeColumn[] = [
  { key: 'f1', label: 'Formatif 1 (F1)' },
  { key: 'f2', label: 'Formatif 2 (F2)' },
  { key: 'f3', label: 'Formatif 3 (F3)' },
  { key: 'f4', label: 'Formatif 4 (F4)' }
];

const DEFAULT_SUMMATIVE_COLS: GradeColumn[] = [
  { key: 's1', label: 'Sumatif 1 (S1)' },
  { key: 's2', label: 'Sumatif 2 (S2)' },
  { key: 's3', label: 'Sumatif 3 (S3)' },
  { key: 'uts', label: 'UTS' },
  { key: 'uas', label: 'UAS' }
];

export default function GradesTab({
  students,
  formativeGrades,
  summativeGrades,
  onSave,
  formativeCols = [],
  setFormativeCols,
  summativeCols = [],
  setSummativeCols
}: GradesTabProps) {
  const [gradeType, setGradeType] = useState<'formative' | 'summative'>('formative');
  const [searchQuery, setSearchQuery] = useState('');
  const [localFormative, setLocalFormative] = useState<GradeFormative[]>([]);
  const [localSummative, setLocalSummative] = useState<GradeSummative[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [zoomedName, setZoomedName] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);

  const activeFormativeCols = formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS;
  const activeSummativeCols = summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS;

  // Sync local state when the student roster (class) changes
  useEffect(() => {
    setLocalFormative(formativeGrades.map(g => ({ ...g })));
    setLocalSummative(summativeGrades.map(g => ({ ...g })));
    setIsDirty(false);
    setSaveStatus('idle');
  }, [students]);

  // Sync local state with fresh props when they change, but ONLY if not dirty (no unsaved changes)
  useEffect(() => {
    if (!isDirty) {
      setLocalFormative(formativeGrades.map(g => ({ ...g })));
      setLocalSummative(summativeGrades.map(g => ({ ...g })));
    }
  }, [formativeGrades, summativeGrades, isDirty]);

  const calculateAverage = (scores: (number | null)[]): number | null => {
    const validScores = scores.filter((s): s is number => s !== null);
    if (validScores.length === 0) return 0;
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    return parseFloat((sum / validScores.length).toFixed(1));
  };

  const handleGradeChange = (
    nis: string,
    field: string,
    value: string
  ) => {
    setIsDirty(true);
    // If empty string, set as null
    if (value.trim() === '') {
      if (gradeType === 'formative') {
        setLocalFormative(prev =>
          prev.map(g => {
            if (g.nis === nis) {
              const updated = { ...g, [field]: null };
              if (field !== 'rataRata') {
                const scores = activeFormativeCols.map(c => updated[c.key]);
                updated.rataRata = calculateAverage(scores);
              }
              return updated;
            }
            return g;
          })
        );
      } else {
        setLocalSummative(prev =>
          prev.map(g => {
            if (g.nis === nis) {
              const updated = { ...g, [field]: null };
              if (field !== 'rataRata') {
                const scores = activeSummativeCols.map(c => updated[c.key]);
                updated.rataRata = calculateAverage(scores);
              }
              return updated;
            }
            return g;
          })
        );
      }
      return;
    }

    // Otherwise validate range 0-100
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;

    if (gradeType === 'formative') {
      setLocalFormative(prev =>
        prev.map(g => {
          if (g.nis === nis) {
            const updated = { ...g, [field]: parsed };
            if (field !== 'rataRata') {
              const scores = activeFormativeCols.map(c => updated[c.key]);
              updated.rataRata = calculateAverage(scores);
            }
            return updated;
          }
          return g;
        })
      );
    } else {
      setLocalSummative(prev =>
        prev.map(g => {
          if (g.nis === nis) {
            const updated = { ...g, [field]: parsed };
            if (field !== 'rataRata') {
              const scores = activeSummativeCols.map(c => updated[c.key]);
              updated.rataRata = calculateAverage(scores);
            }
            return updated;
          }
          return g;
        })
      );
    }
  };

  const handleAddColumn = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      if (gradeType === 'formative') {
        if (!setFormativeCols) return;
        const nextIndex = activeFormativeCols.length + 1;
        const newCol = {
          key: `f${nextIndex}`,
          label: `Formatif ${nextIndex} (F${nextIndex})`
        };
        const updatedCols = [...(formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS), newCol];
        setFormativeCols(updatedCols);
        
        const updatedGrades = localFormative.map(r => ({ ...r, [newCol.key]: null }));
        setLocalFormative(updatedGrades);

        await onSave(updatedGrades, localSummative, updatedCols, activeSummativeCols);
      } else {
        if (!setSummativeCols) return;
        const sCols = activeSummativeCols.filter(c => c.key.startsWith('s'));
        const nextSIndex = sCols.length + 1;
        const newCol = {
          key: `s${nextSIndex}`,
          label: `Sumatif ${nextSIndex} (S${nextSIndex})`
        };

        let updatedCols: GradeColumn[] = [];
        const cols = summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS;
        const utsIndex = cols.findIndex(c => c.key === 'uts');
        if (utsIndex !== -1) {
          const updated = [...cols];
          updated.splice(utsIndex, 0, newCol);
          updatedCols = updated;
        } else {
          updatedCols = [...cols, newCol];
        }
        setSummativeCols(updatedCols);

        const updatedGrades = localSummative.map(r => ({ ...r, [newCol.key]: null }));
        setLocalSummative(updatedGrades);

        await onSave(localFormative, updatedGrades, activeFormativeCols, updatedCols);
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveColumn = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      if (gradeType === 'formative') {
        if (!setFormativeCols || activeFormativeCols.length <= 1) return;
        const colToRemove = activeFormativeCols[activeFormativeCols.length - 1];
        const updatedCols = (formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS).slice(0, -1);
        setFormativeCols(updatedCols);

        const updatedGrades = localFormative.map(r => {
          const updated = { ...r };
          delete updated[colToRemove.key];
          const scores = updatedCols.map(c => updated[c.key]);
          updated.rataRata = calculateAverage(scores);
          return updated;
        });
        setLocalFormative(updatedGrades);

        await onSave(updatedGrades, localSummative, updatedCols, activeSummativeCols);
      } else {
        if (!setSummativeCols) return;
        const sCols = activeSummativeCols.filter(c => c.key.startsWith('s'));
        if (sCols.length <= 1) return;
        const lastSCol = sCols[sCols.length - 1];

        const updatedCols = (summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS).filter(c => c.key !== lastSCol.key);
        setSummativeCols(updatedCols);

        const updatedGrades = localSummative.map(r => {
          const updated = { ...r };
          delete updated[lastSCol.key];
          const scores = updatedCols.map(c => updated[c.key]);
          updated.rataRata = calculateAverage(scores);
          return updated;
        });
        setLocalSummative(updatedGrades);

        await onSave(localFormative, updatedGrades, activeFormativeCols, updatedCols);
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onSave(localFormative, localSummative);
      setSaveStatus('success');
      setIsDirty(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Get filtered records based on search query
  const filteredFormative = localFormative.filter(
    g =>
      g.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.nis.includes(searchQuery)
  ).sort((a, b) => {
    const sA = students.find(s => s.nis === a.nis);
    const sB = students.find(s => s.nis === b.nis);
    const noA = sA ? parseInt(sA.noAbsen || '', 10) : NaN;
    const noB = sB ? parseInt(sB.noAbsen || '', 10) : NaN;
    if (!isNaN(noA) && !isNaN(noB)) return noA - noB;
    if (!isNaN(noA)) return -1;
    if (!isNaN(noB)) return 1;
    const nameA = a.nama || '';
    const nameB = b.nama || '';
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });

  const filteredSummative = localSummative.filter(
    g =>
      g.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.nis.includes(searchQuery)
  ).sort((a, b) => {
    const sA = students.find(s => s.nis === a.nis);
    const sB = students.find(s => s.nis === b.nis);
    const noA = sA ? parseInt(sA.noAbsen || '', 10) : NaN;
    const noB = sB ? parseInt(sB.noAbsen || '', 10) : NaN;
    if (!isNaN(noA) && !isNaN(noB)) return noA - noB;
    if (!isNaN(noA)) return -1;
    if (!isNaN(noB)) return 1;
    const nameA = a.nama || '';
    const nameB = b.nama || '';
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });

  // Helper to color grade value
  const getGradeColor = (score: number | null) => {
    if (score === null) return 'text-slate-400';
    if (score >= 80) return 'text-indigo-600 font-bold';
    if (score >= 65) return 'text-amber-600 font-bold';
    return 'text-rose-600 font-bold';
  };

  return (
    <div id="grades-section" className="space-y-6">
      {/* Grade Selector & Info */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setGradeType('formative')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition cursor-pointer ${
              gradeType === 'formative'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Nilai Formatif (Harian)
          </button>
          <button
            onClick={() => setGradeType('summative')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition cursor-pointer ${
              gradeType === 'summative'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Nilai Sumatif (Akhir Bab/Semester)
          </button>
        </div>

        <div className="flex items-center gap-3 justify-end">
          {saveStatus === 'success' && (
            <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1.5 animate-pulse">
              <Check className="w-4 h-4" /> Nilai Berhasil Disinkronkan!
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-rose-600 font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Gagal sinkronisasi nilai.
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || students.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan Semua Nilai
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grade Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search header with add/remove controls */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Cari Siswa..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
          </div>

          <div className="flex flex-wrap items-center gap-3.5 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={handleRemoveColumn}
                disabled={gradeType === 'formative' ? activeFormativeCols.length <= 1 : activeSummativeCols.filter(c => c.key.startsWith('s')).length <= 1}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-700 font-bold rounded-lg text-[11px] transition border border-slate-200 cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Hapus kolom penilaian terakhir"
              >
                <span>- Kurang</span>
              </button>
              <span className="text-[10px] font-bold text-slate-500 px-2.5 select-none font-mono">
                {gradeType === 'formative'
                  ? `${activeFormativeCols.length} Kolom`
                  : `${activeSummativeCols.filter(c => c.key.startsWith('s')).length} Bab + UTS/UAS`}
              </span>
              <button
                type="button"
                onClick={handleAddColumn}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Tambah kolom penilaian baru"
              >
                <span>+ Tambah</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              Kalkulasi Rata-Rata Otomatis
            </div>
          </div>
        </div>

        {/* Content table */}
        {students.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600">Belum ada siswa.</p>
          </div>
        ) : gradeType === 'formative' ? (
          <div className={filteredFormative.length > 4 ? 'max-h-[440px] overflow-y-auto scrollbar-thin' : ''}>
            {/* Formative Mobile View: Cards */}
            <div className="block md:hidden space-y-4 p-4 bg-slate-50/50">
              {filteredFormative.map(row => {
                const matchingStudent = students.find(s => s.nis === row.nis);
                const studentPhoto = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);
                const noAbsen = matchingStudent?.noAbsen || '';
                return (
                  <div key={row.nis} className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-xs space-y-4 hover:shadow-md hover:border-indigo-150 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {studentPhoto ? (
                          <img
                            src={getStudentPhotoUrl(studentPhoto)}
                            alt={row.nama}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 object-cover rounded-full ring-2 ring-slate-100 ring-offset-1 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 bg-slate-50 rounded-full border border-slate-200/60 ring-2 ring-slate-100 ring-offset-1 flex items-center justify-center text-slate-400 shrink-0 shadow-2xs">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 text-sm block truncate tracking-tight">{row.nama}</span>
                          <span className="font-mono text-[10px] text-slate-400 block font-bold">NIS: {row.nis}</span>
                        </div>
                      </div>
                      {noAbsen && (
                        <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100/70 rounded-xl text-indigo-700 font-mono font-extrabold text-[10px] shrink-0 shadow-3xs">
                          Absen #{noAbsen}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      {activeFormativeCols.map(col => (
                        <div key={col.key} className="space-y-1 bg-slate-50/75 p-2 rounded-xl border border-slate-200/50 hover:border-slate-300 transition-all">
                          <span className="block text-[10px] font-bold text-slate-500 truncate" title={col.label}>
                            {col.label}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="--"
                            value={row[col.key] === null || row[col.key] === undefined ? '' : row[col.key]}
                            onChange={e => handleGradeChange(row.nis, col.key, e.target.value)}
                            className="w-full text-center py-1.5 rounded-lg border border-slate-200/80 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white text-slate-800 shadow-2xs"
                          />
                        </div>
                      ))}
                      
                      {/* Rata-Rata Card */}
                      <div className="space-y-1 bg-indigo-50/40 p-2 rounded-xl border border-indigo-100/70 col-span-2 sm:col-span-1">
                        <span className="block text-[10px] font-black text-indigo-700 truncate">
                          Rata-Rata
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder={(calculateAverage(activeFormativeCols.map(c => row[c.key])) ?? 0).toFixed(1)}
                          value={row.rataRata === null ? '' : row.rataRata}
                          onChange={e => handleGradeChange(row.nis, 'rataRata', e.target.value)}
                          className={`w-full text-center py-1 rounded-md border border-indigo-200 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white ${getGradeColor(row.rataRata)}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formative Desktop View: Standard Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                  <tr className="text-slate-500 font-bold text-xs tracking-wider uppercase">
                    <th className="py-3 px-5">Siswa</th>
                    {activeFormativeCols.map(col => {
                      const shortLabel = col.label.match(/\(([^)]+)\)/)?.[1] || col.label;
                      return (
                        <th key={col.key} className="py-3 px-5 text-center w-24" title={col.label}>
                          {shortLabel}
                        </th>
                      );
                    })}
                    <th className="py-3 px-5 text-center w-36 bg-indigo-50/10">Rata-Rata Formatif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFormative.map(row => (
                    <tr key={row.nis} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const matchingStudent = students.find(s => s.nis === row.nis);
                            const studentPhoto = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);
                            const noAbsen = matchingStudent?.noAbsen || '';
                            return (
                              <>
                                {noAbsen && (
                                  <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-mono font-extrabold text-xs shrink-0">
                                    No. {noAbsen}
                                  </span>
                                )}
                                {studentPhoto ? (
                                  <img
                                    src={getStudentPhotoUrl(studentPhoto)}
                                    alt={row.nama}
                                    referrerPolicy="no-referrer"
                                    className="w-10 h-10 object-cover rounded-full border border-slate-200 cursor-pointer hover:scale-105 transition duration-150"
                                    onClick={() => {
                                      setZoomedPhoto(studentPhoto);
                                      setZoomedName(row.nama);
                                    }}
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400">
                                    <User className="w-5 h-5" />
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <div>
                            <span className="font-bold text-slate-800 block text-sm">{row.nama}</span>
                            <span className="font-mono text-xs text-slate-500">NIS: {row.nis}</span>
                          </div>
                        </div>
                      </td>
                      {activeFormativeCols.map(col => (
                        <td key={col.key} className="py-3.5 px-5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="--"
                            value={row[col.key] === null || row[col.key] === undefined ? '' : row[col.key]}
                            onChange={e => handleGradeChange(row.nis, col.key, e.target.value)}
                            className="w-16 text-center py-1.5 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                      ))}
                      <td className="py-3.5 px-5 text-center bg-indigo-50/5 font-mono text-sm font-bold">
                        <span className={getGradeColor(row.rataRata)}>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder={(calculateAverage(activeFormativeCols.map(c => row[c.key])) ?? 0).toFixed(1)}
                            value={row.rataRata === null ? '' : row.rataRata}
                            onChange={e => handleGradeChange(row.nis, 'rataRata', e.target.value)}
                            className={`w-16 text-center py-1.5 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs ${getGradeColor(row.rataRata)}`}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={filteredSummative.length > 4 ? 'max-h-[440px] overflow-y-auto scrollbar-thin' : ''}>
            {/* Summative Mobile View: Cards */}
            <div className="block md:hidden space-y-4 p-4 bg-slate-50/50">
              {filteredSummative.map(row => {
                const matchingStudent = students.find(s => s.nis === row.nis);
                const studentPhoto = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);
                const noAbsen = matchingStudent?.noAbsen || '';
                return (
                  <div key={row.nis} className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-xs space-y-4 hover:shadow-md hover:border-indigo-150 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {studentPhoto ? (
                          <img
                            src={getStudentPhotoUrl(studentPhoto)}
                            alt={row.nama}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 object-cover rounded-full ring-2 ring-slate-100 ring-offset-1 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 bg-slate-50 rounded-full border border-slate-200/60 ring-2 ring-slate-100 ring-offset-1 flex items-center justify-center text-slate-400 shrink-0 shadow-2xs">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 text-sm block truncate tracking-tight">{row.nama}</span>
                          <span className="font-mono text-[10px] text-slate-400 block font-bold">NIS: {row.nis}</span>
                        </div>
                      </div>
                      {noAbsen && (
                        <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100/70 rounded-xl text-indigo-700 font-mono font-extrabold text-[10px] shrink-0 shadow-3xs">
                          Absen #{noAbsen}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      {activeSummativeCols.map(col => (
                        <div key={col.key} className="space-y-1 bg-slate-50/75 p-2 rounded-xl border border-slate-200/50 hover:border-slate-300 transition-all">
                          <span className="block text-[10px] font-bold text-slate-500 truncate" title={col.label}>
                            {col.label}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="--"
                            value={row[col.key] === null || row[col.key] === undefined ? '' : row[col.key]}
                            onChange={e => handleGradeChange(row.nis, col.key, e.target.value)}
                            className="w-full text-center py-1.5 rounded-lg border border-slate-200/80 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white text-slate-800 shadow-2xs"
                          />
                        </div>
                      ))}
                      
                      {/* Rata-Rata Card */}
                      <div className="space-y-1 bg-indigo-50/40 p-2 rounded-xl border border-indigo-100/70 col-span-2 sm:col-span-1">
                        <span className="block text-[10px] font-black text-indigo-700 truncate">
                          Rata-Rata
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder={(calculateAverage(activeSummativeCols.map(c => row[c.key])) ?? 0).toFixed(1)}
                          value={row.rataRata === null ? '' : row.rataRata}
                          onChange={e => handleGradeChange(row.nis, 'rataRata', e.target.value)}
                          className={`w-full text-center py-1.5 rounded-lg border border-indigo-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${getGradeColor(row.rataRata)}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summative Desktop View: Standard Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                  <tr className="text-slate-500 font-bold text-xs tracking-wider uppercase">
                    <th className="py-3 px-5">Siswa</th>
                    {activeSummativeCols.map(col => {
                      const shortLabel = col.label.match(/\(([^)]+)\)/)?.[1] || col.label;
                      return (
                        <th key={col.key} className="py-3 px-5 text-center w-20" title={col.label}>
                          {shortLabel}
                        </th>
                      );
                    })}
                    <th className="py-3 px-5 text-center w-36 bg-indigo-50/10">Rata-Rata Sumatif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummative.map(row => (
                    <tr key={row.nis} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const matchingStudent = students.find(s => s.nis === row.nis);
                            const studentPhoto = matchingStudent?.foto || localStorage.getItem(`student_photo_${row.nis}`);
                            const noAbsen = matchingStudent?.noAbsen || '';
                            return (
                              <>
                                {noAbsen && (
                                  <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-mono font-extrabold text-xs shrink-0">
                                    No. {noAbsen}
                                  </span>
                                )}
                                {studentPhoto ? (
                                  <img
                                    src={getStudentPhotoUrl(studentPhoto)}
                                    alt={row.nama}
                                    referrerPolicy="no-referrer"
                                    className="w-10 h-10 object-cover rounded-full border border-slate-200 cursor-pointer hover:scale-105 transition duration-150"
                                    onClick={() => {
                                      setZoomedPhoto(studentPhoto);
                                      setZoomedName(row.nama);
                                    }}
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400">
                                    <User className="w-5 h-5" />
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <div>
                            <span className="font-bold text-slate-800 block text-sm">{row.nama}</span>
                            <span className="font-mono text-xs text-slate-500">NIS: {row.nis}</span>
                          </div>
                        </div>
                      </td>
                      {activeSummativeCols.map(col => (
                        <td key={col.key} className="py-3.5 px-5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="--"
                            value={row[col.key] === null || row[col.key] === undefined ? '' : row[col.key]}
                            onChange={e => handleGradeChange(row.nis, col.key, e.target.value)}
                            className="w-14 text-center py-1.5 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                      ))}
                      <td className="py-3.5 px-5 text-center bg-indigo-50/5 font-mono text-sm font-bold">
                        <span className={getGradeColor(row.rataRata)}>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder={(calculateAverage(activeSummativeCols.map(c => row[c.key])) ?? 0).toFixed(1)}
                            value={row.rataRata === null ? '' : row.rataRata}
                            onChange={e => handleGradeChange(row.nis, 'rataRata', e.target.value)}
                            className={`w-16 text-center py-1.5 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs ${getGradeColor(row.rataRata)}`}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Photo Zoom Modal Overlay */}
      {zoomedPhoto && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 z-50 animate-in fade-in duration-200"
          onClick={() => setZoomedPhoto(null)}
        >
          <div 
            className="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl max-w-lg md:max-w-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div>
                <h4 className="text-base font-extrabold text-slate-100 leading-tight">{zoomedName}</h4>
                <p className="text-[10px] text-indigo-400 font-bold mt-0.5 uppercase tracking-wider">Pratinjau Foto Kualitas HD</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedPhoto(null)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-1 bg-slate-950 flex items-center justify-center p-4 md:p-6 min-h-[300px] md:min-h-[420px] select-none shadow-inner">
              <img 
                src={getStudentPhotoUrl(zoomedPhoto)} 
                alt={zoomedName} 
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl border border-slate-800/50"
              />
            </div>

            <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-400 text-center sm:text-left leading-relaxed">
                Gunakan klik kanan atau tahan layar pada ponsel untuk menyimpan foto beresolusi penuh.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={zoomedPhoto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer border border-slate-700 hover:border-slate-600"
                >
                  Buka Tab Baru ↗
                </a>
                <button
                  type="button"
                  onClick={() => setZoomedPhoto(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
