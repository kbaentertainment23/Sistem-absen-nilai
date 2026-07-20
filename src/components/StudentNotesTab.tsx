import React, { useState } from 'react';
import { Student, StudentNote } from '../types';
import { getStudentPhotoUrl } from '../lib/googleSheets';
import { 
  Sparkles, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  FileText, 
  User,
  CheckCircle,
  HelpCircle,
  X,
  Edit2
} from 'lucide-react';

interface StudentNotesTabProps {
  students: Student[];
  notes: StudentNote[];
  onAddNote: (note: Omit<StudentNote, 'id'>) => void;
  onDeleteNote: (id: string) => void;
  onUpdateNote: (id: string, updated: Partial<StudentNote>) => void;
}

const COMMON_JAM_PEMBELAJARAN = [
  "Jam 1-2 (07.00 - 08.30)",
  "Jam 3-4 (08.30 - 10.00)",
  "Jam 5-6 (10.30 - 12.00)",
  "Jam 7-8 (12.00 - 13.30)",
  "Jam 9-10 (13.30 - 15.00)"
];

export default function StudentNotesTab({
  students,
  notes,
  onAddNote,
  onDeleteNote,
  onUpdateNote
}: StudentNotesTabProps) {
  // Form states
  const [tanggalInput, setTanggalInput] = useState<string>(
    new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local timezone friendly
  );
  const [selectedNis, setSelectedNis] = useState<string>('');
  const [jamInput, setJamInput] = useState<string>(COMMON_JAM_PEMBELAJARAN[0]);
  const [isCustomJam, setIsCustomJam] = useState<boolean>(false);
  const [customJamInput, setCustomJamInput] = useState<string>('');
  const [tipeInput, setTipeInput] = useState<'aktif' | 'bermasalah'>('aktif');
  const [catatanInput, setCatatanInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Edit states
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<StudentNote | null>(null);

  // Success / Error alerts
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Handle Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedNis) {
      setErrorMsg('Pilih siswa terlebih dahulu.');
      return;
    }

    const student = students.find(s => s.nis === selectedNis);
    if (!student) {
      setErrorMsg('Siswa tidak ditemukan.');
      return;
    }

    const jam = isCustomJam ? customJamInput.trim() : jamInput;
    if (!jam) {
      setErrorMsg('Tentukan jam pembelajaran.');
      return;
    }

    if (!catatanInput.trim()) {
      setErrorMsg('Tulis deskripsi catatan aktivitas.');
      return;
    }

    if (editingNoteId) {
      // Update existing
      onUpdateNote(editingNoteId, {
        tanggal: tanggalInput,
        nis: selectedNis,
        nama: student.nama,
        kelas: student.kelas || 'Kelas 8.1',
        jamPembelajaran: jam,
        tipe: tipeInput,
        catatan: catatanInput.trim()
      });
      setSuccessMsg('Catatan siswa berhasil diperbarui!');
      setEditingNoteId(null);
    } else {
      // Add new
      onAddNote({
        tanggal: tanggalInput,
        nis: selectedNis,
        nama: student.nama,
        kelas: student.kelas || 'Kelas 8.1',
        jamPembelajaran: jam,
        tipe: tipeInput,
        catatan: catatanInput.trim()
      });
      setSuccessMsg('Catatan baru berhasil disimpan!');
    }

    // Reset some inputs
    setCatatanInput('');
    // Keep date, student, and session for potential rapid batch entry
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Set form to edit mode
  const handleEditClick = (note: StudentNote) => {
    setEditingNoteId(note.id);
    setTanggalInput(note.tanggal);
    setSelectedNis(note.nis);
    setTipeInput(note.tipe);
    setCatatanInput(note.catatan);
    
    if (COMMON_JAM_PEMBELAJARAN.includes(note.jamPembelajaran)) {
      setJamInput(note.jamPembelajaran);
      setIsCustomJam(false);
    } else {
      setIsCustomJam(true);
      setCustomJamInput(note.jamPembelajaran);
    }
    
    // Scroll form into view if mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setSelectedNis('');
    setCatatanInput('');
    setSuccessMsg('');
    setErrorMsg('');
  };

  // Filter notes to display based on date, search, etc.
  const filteredNotes = notes.filter(n => {
    const matchesSearch = 
      n.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.nis.includes(searchQuery) ||
      n.catatan.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            🗒️ Jurnal & Catatan Siswa Harian
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Catat siswa yang <strong>aktif / berprestasi</strong> maupun yang <strong>bermasalah / melanggar tata tertib</strong> selama pembelajaran kelas berlangsung.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Metode Sinkronisasi</span>
          <span className="px-3 py-1 bg-teal-50 border border-teal-100 text-teal-700 font-bold rounded-full text-[10px] uppercase mt-1 inline-block">
            Auto-Sync Lokal (Offline-First)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDE: Entry Form */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs lg:col-span-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">
              {editingNoteId ? '✏️ Edit Catatan Siswa' : '📝 Tambah Catatan Baru'}
            </h3>
            {editingNoteId && (
              <button 
                type="button" 
                onClick={handleCancelEdit}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Tanggal & Sesi */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" /> Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={tanggalInput}
                  onChange={e => setTanggalInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-slate-50 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" /> Jam Pembelajaran
                </label>
                {!isCustomJam ? (
                  <select
                    value={jamInput}
                    onChange={e => {
                      if (e.target.value === 'CUSTOM') {
                        setIsCustomJam(true);
                      } else {
                        setJamInput(e.target.value);
                      }
                    }}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    {COMMON_JAM_PEMBELAJARAN.map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                    <option value="CUSTOM">-- Ketik Kustom --</option>
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Jam Istirahat"
                      value={customJamInput}
                      onChange={e => setCustomJamInput(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomJam(false)}
                      className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Kembali ke pilihan standar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pilih Siswa */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3 text-indigo-500" /> Pilih Siswa ({students.length} anak)
              </label>
              <select
                required
                value={selectedNis}
                onChange={e => setSelectedNis(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-slate-50 text-slate-700 cursor-pointer"
              >
                <option value="">-- Pilih Siswa --</option>
                {students.map(s => (
                  <option key={s.nis} value={s.nis}>
                    {s.noAbsen ? `${s.noAbsen}. ` : ''}{s.nama} (NIS: {s.nis})
                  </option>
                ))}
              </select>
            </div>

            {/* Tipe Catatan (Aktif vs Bermasalah) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Tipe Karakter / Aktivitas Siswa
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Tipe Aktif */}
                <button
                  type="button"
                  onClick={() => setTipeInput('aktif')}
                  className={`py-3 px-4 rounded-xl border font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    tipeInput === 'aktif'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                      : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <Sparkles className={`w-5 h-5 ${tipeInput === 'aktif' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className="text-[10px]">Siswa Aktif</span>
                  <span className="text-[8px] font-normal text-slate-400">(Bertanya, Kreatif, dll)</span>
                </button>

                {/* Tipe Bermasalah */}
                <button
                  type="button"
                  onClick={() => setTipeInput('bermasalah')}
                  className={`py-3 px-4 rounded-xl border font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    tipeInput === 'bermasalah'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                      : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 ${tipeInput === 'bermasalah' ? 'text-rose-500' : 'text-slate-400'}`} />
                  <span className="text-[10px]">Siswa Bermasalah</span>
                  <span className="text-[8px] font-normal text-slate-400">(Tidur, Ribut, dll)</span>
                </button>
              </div>
            </div>

            {/* Deskripsi Catatan */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <FileText className="w-3 h-3 text-indigo-500" /> Isi Catatan Kejadian
              </label>
              <textarea
                required
                rows={4}
                value={catatanInput}
                onChange={e => setCatatanInput(e.target.value)}
                placeholder={
                  tipeInput === 'aktif'
                    ? "Contoh: Sangat aktif menjawab pertanyaan analisis dan membantu temannya menyelesaikan soal matematika tingkat tinggi."
                    : "Contoh: Tertidur pulas selama 20 menit saat penjelasan materi berlangsung dan tidak mengumpulkan tugas latihan harian."
                }
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 text-slate-700 leading-relaxed font-medium"
              />
            </div>

            {/* Feedback messages */}
            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-bold text-[11px] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl font-bold text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-black text-white transition shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                editingNoteId 
                  ? 'bg-amber-600 hover:bg-amber-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {editingNoteId ? (
                <>
                  <Edit2 className="w-4 h-4" /> Perbarui Catatan
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Simpan Catatan Harian
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT SIDE: List / History of Notes */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm tracking-tight uppercase">
                📋 Daftar Jurnal Kejadian Kelas
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                Menampilkan semua catatan untuk kelas terpilih ({filteredNotes.length} entri)
              </p>
            </div>

            {/* Simple Search bar */}
            <div className="relative w-full sm:w-52 shrink-0">
              <input
                type="text"
                placeholder="Cari nama atau catatan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[10px] rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700"
              />
              <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300 shadow-inner">
                <HelpCircle className="w-6 h-6" />
              </div>
              <p className="font-semibold max-w-xs">
                {searchQuery 
                  ? 'Tidak ditemukan catatan yang cocok dengan pencarian.'
                  : 'Belum ada catatan aktivitas siswa. Silakan tambahkan pada form di samping.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredNotes.map((note) => {
                const s = students.find(std => std.nis === note.nis);
                return (
                  <div 
                    key={note.id} 
                    className={`p-5 rounded-2xl border transition-all duration-200 hover:shadow-sm flex flex-col sm:flex-row gap-4 items-start ${
                      note.tipe === 'aktif'
                        ? 'border-emerald-100/80 bg-emerald-50/15 hover:bg-emerald-50/30 hover:border-emerald-200'
                        : 'border-rose-100/80 bg-rose-50/15 hover:bg-rose-50/30 hover:border-rose-200'
                    }`}
                  >
                    {/* Student Photo or initial */}
                    <div className="w-11 h-11 rounded-full ring-2 ring-slate-100/80 ring-offset-1 overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center font-bold text-slate-600 text-sm shadow-sm">
                      {s?.foto ? (
                        <img 
                          src={getStudentPhotoUrl(s.foto)} 
                          alt={note.nama} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        note.nama.charAt(0)
                      )}
                    </div>

                    {/* Description Area */}
                    <div className="flex-grow space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {s?.noAbsen && (
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100/70 rounded-xl text-indigo-700 font-mono font-extrabold text-[9px] shrink-0 shadow-3xs">
                            Absen #{s.noAbsen}
                          </span>
                        )}
                        <span className="font-extrabold text-slate-800 text-sm leading-none tracking-tight">
                          {note.nama}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/40">
                          NIS: {note.nis}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">• {note.tanggal}</span>
                      </div>

                      {/* Time / Session Info */}
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {note.jamPembelajaran}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-black flex items-center gap-1 border ${
                          note.tipe === 'aktif'
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                            : 'bg-rose-50 border-rose-100 text-rose-800'
                        }`}>
                          {note.tipe === 'aktif' ? (
                            <>
                              <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> Siswa Aktif
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600" /> Siswa Bermasalah
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-semibold pt-1">
                        {note.catatan}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex sm:flex-col gap-2 w-full sm:w-auto justify-end sm:justify-start shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 mt-1 sm:mt-0">
                      <button
                        type="button"
                        onClick={() => handleEditClick(note)}
                        className="px-2.5 py-2 text-[10px] text-amber-700 bg-amber-50 hover:text-white hover:bg-amber-600 border border-amber-200 hover:border-amber-600 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer shadow-3xs"
                        title="Edit Catatan"
                      >
                        <Edit2 className="w-3 h-3" /> <span className="sm:hidden">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteToDelete(note)}
                        className="px-2.5 py-2 text-[10px] text-rose-700 bg-rose-50 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer shadow-3xs"
                        title="Hapus Catatan"
                      >
                        <Trash2 className="w-3 h-3" /> <span className="sm:hidden">Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Custom Delete Confirmation Modal */}
      {noteToDelete && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setNoteToDelete(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-150 max-w-md w-full flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-500 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-900">Hapus Catatan Harian?</h4>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Tindakan ini bersifat permanen dan tidak dapat dibatalkan. Data keaktifan / kendala yang sudah dihapus tidak akan dapat dikembalikan.
              </p>
            </div>

            {/* Selected Note Details Card */}
            <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-400 text-[10px]">
                <span>IDENTITAS SISWA</span>
                <span>{noteToDelete.tanggal}</span>
              </div>
              <div>
                <span className="font-extrabold text-slate-800 text-xs block">{noteToDelete.nama}</span>
                <span className="font-mono text-[9px] text-slate-400">NIS: {noteToDelete.nis}</span>
              </div>
              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ISI CATATAN KEJADIAN:</span>
                <p className="text-slate-600 italic font-medium leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                  "{noteToDelete.catatan}"
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteNote(noteToDelete.id);
                  setNoteToDelete(null);
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
