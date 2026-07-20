import React, { useState, useEffect, useMemo } from 'react';
import { Student, AttendanceRecord } from '../types';
import { Check, Clock, Calendar, Search, AlertCircle, Save, Loader2, ChevronLeft, ChevronRight, Info, User } from 'lucide-react';
import { getStudentPhotoUrl } from '../lib/googleSheets';

interface AttendanceTabProps {
  students: Student[];
  attendance: AttendanceRecord[];
  onSave: (records: AttendanceRecord[]) => Promise<void>;
}

export default function AttendanceTab({ students, attendance, onSave }: AttendanceTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [localRecords, setLocalRecords] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(selectedDate);
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate);
    return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  });

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeekIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeekIndex; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(d);
  }

  const getFormattedDateString = (year: number, month: number, day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const recordedDates = useMemo(() => {
    const dates = new Set<string>();
    attendance.forEach(r => {
      if (r.tanggal) {
        dates.add(r.tanggal);
      }
    });
    return dates;
  }, [attendance]);

  // Sync view when selectedDate changes
  useEffect(() => {
    const d = new Date(selectedDate);
    if (!isNaN(d.getTime())) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [selectedDate]);

  // Load records for the selected date, or initialize if empty
  useEffect(() => {
    const existingRecords = attendance.filter(r => r.tanggal === selectedDate);
    
    const initialized = students.map(student => {
      const match = existingRecords.find(r => r.nis === student.nis);
      if (match) return { ...match };
      
      // Default initial record
      return {
        tanggal: selectedDate,
        nis: student.nis,
        nama: student.nama,
        status: 'Hadir' as const,
        terlambat: 0,
        keterangan: '',
      };
    });
    
    setLocalRecords(initialized);
    setSaveStatus('idle');
  }, [selectedDate, students, attendance]);

  const handleStatusChange = (nis: string, status: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa') => {
    setLocalRecords(prev =>
      prev.map(r => (r.nis === nis ? { ...r, status } : r))
    );
  };

  const handleLatenessChange = (nis: string, value: string) => {
    const parsed = parseInt(value, 10);
    const minutes = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setLocalRecords(prev =>
      prev.map(r => (r.nis === nis ? { ...r, terlambat: minutes } : r))
    );
  };

  const handleRemarkChange = (nis: string, remark: string) => {
    setLocalRecords(prev =>
      prev.map(r => (r.nis === nis ? { ...r, keterangan: remark } : r))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onSave(localRecords);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRecords = localRecords.filter(
    r =>
      r.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.nis.includes(searchQuery)
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

  // Stats for the day
  const total = localRecords.length;
  const present = localRecords.filter(r => r.status === 'Hadir').length;
  const sick = localRecords.filter(r => r.status === 'Sakit').length;
  const excused = localRecords.filter(r => r.status === 'Izin').length;
  const absent = localRecords.filter(r => r.status === 'Alfa').length;
  const lateCount = localRecords.filter(r => r.status === 'Hadir' && r.terlambat > 0).length;

  return (
    <div id="attendance-section" className="space-y-6">
      {/* Auto-Sync status info banner */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-800 text-xs sm:text-sm animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              Sinkronisasi Otomatis Ditangguhkan Sementara
            </p>
            <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
              Selama Anda berada di halaman Absensi Harian, sinkronisasi otomatis dinonaktifkan agar pengisian tidak terganggu. Tekan tombol <strong className="font-bold">"Simpan & Sinkronkan"</strong> di bawah untuk memperbarui database Google Sheets secara permanen.
            </p>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-black shrink-0 uppercase tracking-wider text-[10px] text-center self-start sm:self-center">
          Mode Edit Lokal
        </div>
      </div>

      {/* Date & Quick Stats Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Mengisi data absen untuk tanggal: <span className="font-semibold text-slate-700">{new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>.
            </p>

            {/* Elegant Mini Monthly Calendar */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Kalender Presensi
                </span>
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-white hover:shadow-xs rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center justify-center"
                    title="Bulan Sebelumnya"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-extrabold text-slate-700 min-w-24 text-center">
                    {monthNames[viewMonth]} {viewYear}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-white hover:shadow-xs rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center justify-center"
                    title="Bulan Berikutnya"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => (
                  <span key={day} className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tight">
                    {day}
                  </span>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-7" />;
                  }

                  const dateStr = getFormattedDateString(viewYear, viewMonth, day);
                  const isSelected = dateStr === selectedDate;
                  const hasAttendance = recordedDates.has(dateStr);

                  return (
                    <button
                      key={`day-${day}`}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`h-7 text-xs font-semibold rounded-lg transition relative flex flex-col items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs font-bold'
                          : hasAttendance
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold hover:bg-emerald-100/80 hover:text-emerald-800'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-transparent'
                      }`}
                      title={
                        isSelected
                          ? `Terpilih: ${day} ${monthNames[viewMonth]}`
                          : hasAttendance
                          ? `Sudah Absen: ${day} ${monthNames[viewMonth]}`
                          : `Belum Absen: ${day} ${monthNames[viewMonth]}`
                      }
                    >
                      <span>{day}</span>
                      {/* Attendance indicator dot */}
                      {hasAttendance && (
                        <span className={`w-1 h-1 rounded-full absolute bottom-1 ${
                          isSelected ? 'bg-emerald-400' : 'bg-emerald-500'
                        }`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend & Today quick button */}
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-50 pt-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2.5 h-2.5 rounded-md bg-emerald-50 border border-emerald-150 inline-block shrink-0" />
                    Sudah Absen
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <span className="w-2.5 h-2.5 rounded-md bg-slate-50 border border-transparent inline-block shrink-0" />
                    Belum Absen
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    setSelectedDate(todayStr);
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer"
                >
                  Hari Ini
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs col-span-1 lg:col-span-2">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Ringkasan Kehadiran Hari Ini
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-150 text-center">
              <span className="block text-xl font-bold text-emerald-700">{present}</span>
              <span className="text-[10px] font-semibold text-emerald-600">Hadir</span>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-150 text-center">
              <span className="block text-xl font-bold text-blue-700">{sick}</span>
              <span className="text-[10px] font-semibold text-blue-600">Sakit</span>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-150 text-center">
              <span className="block text-xl font-bold text-amber-700">{excused}</span>
              <span className="text-[10px] font-semibold text-amber-600">Izin</span>
            </div>
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-150 text-center">
              <span className="block text-xl font-bold text-rose-700">{absent}</span>
              <span className="text-[10px] font-semibold text-rose-600">Alfa</span>
            </div>
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-center col-span-2 sm:col-span-1">
              <span className="block text-xl font-bold text-slate-700">{lateCount}</span>
              <span className="text-[10px] font-semibold text-slate-600">Terlambat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Roster Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Actions header */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Cari NIS atau Nama Siswa..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {saveStatus === 'success' && (
              <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1.5 animate-pulse">
                <Check className="w-4 h-4" /> Tersimpan ke Google Sheets!
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-rose-600 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Gagal menyimpan data.
              </span>
            )}
            
            <button
              onClick={handleSave}
              disabled={isSaving || students.length === 0}
              className="w-full sm:w-auto bg-linear-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-200 disabled:to-slate-300 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-50/50 btn-premium"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sinkronisasi...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Simpan &amp; Sinkronkan
                </>
              )}
            </button>
          </div>
        </div>

        {/* List of students */}
        {students.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-600">Belum ada siswa yang terdaftar.</p>
            <p className="text-xs text-slate-400 mt-1">Gunakan tab "Kelola Siswa" untuk menambahkan murid pertama.</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Tidak ada siswa yang cocok dengan pencarian "{searchQuery}"
          </div>
        ) : (
          <div>
            {/* Mobile View: Card-based Attendance List */}
            <div className="block md:hidden space-y-4 p-4 bg-slate-50/50">
              {filteredRecords.map(record => {
                const studentInfo = students.find(s => s.nis === record.nis);
                const noAbsen = studentInfo?.noAbsen || '';
                const foto = studentInfo?.foto;
                return (
                  <div key={record.nis} className="bg-white p-5 rounded-2xl border border-slate-150/80 shadow-xs space-y-4 hover:shadow-md hover:border-indigo-150 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* Student Info Header */}
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Student Photo */}
                        {foto ? (
                          <img
                            src={getStudentPhotoUrl(foto)}
                            alt={record.nama}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 object-cover rounded-full ring-2 ring-slate-100 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-50 rounded-full border border-slate-200/60 ring-2 ring-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <User className="w-4.5 h-4.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 text-sm block truncate tracking-tight">{record.nama}</span>
                          <span className="font-mono text-[10px] text-slate-400 block font-bold">NIS: {record.nis}</span>
                        </div>
                      </div>
                      {noAbsen && (
                        <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100/70 rounded-xl text-indigo-700 font-mono font-extrabold text-[10px] shrink-0 shadow-3xs">
                          Absen #{noAbsen}
                        </span>
                      )}
                    </div>

                    {/* Attendance Grid Selection */}
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Status Kehadiran</span>
                      <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(record.nis, 'Hadir')}
                          className={`py-2 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer text-center ${
                            record.status === 'Hadir'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-emerald-700 hover:bg-emerald-50 rounded-lg'
                          }`}
                        >
                          Hadir
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(record.nis, 'Sakit')}
                          className={`py-2 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer text-center ${
                            record.status === 'Sakit'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-blue-700 hover:bg-blue-50 rounded-lg'
                          }`}
                        >
                          Sakit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(record.nis, 'Izin')}
                          className={`py-2 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer text-center ${
                            record.status === 'Izin'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-amber-700 hover:bg-amber-50 rounded-lg'
                          }`}
                        >
                          Izin
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(record.nis, 'Alfa')}
                          className={`py-2 text-xs font-extrabold rounded-lg transition-all duration-150 cursor-pointer text-center ${
                            record.status === 'Alfa'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-rose-700 hover:bg-rose-50 rounded-lg'
                          }`}
                        >
                          Alfa
                        </button>
                      </div>
                    </div>

                    {/* Inputs Area */}
                    <div className="grid grid-cols-1 gap-3 pt-2.5 border-t border-slate-100">
                      {record.status === 'Hadir' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> Keterlambatan (Menit)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={record.terlambat}
                              onChange={e => handleLatenessChange(record.nis, e.target.value)}
                              className={`w-full pl-3 pr-16 py-2 text-sm rounded-lg border font-mono ${
                                record.terlambat > 0
                                  ? 'border-rose-300 text-rose-700 bg-rose-50 focus:ring-2 focus:ring-rose-200'
                                  : 'border-slate-200 text-slate-700 focus:ring-2 focus:ring-indigo-100'
                              }`}
                              placeholder="0"
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold select-none">menit</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Keterangan / Alasan</label>
                        <input
                          type="text"
                          value={record.keterangan}
                          onChange={e => handleRemarkChange(record.nis, e.target.value)}
                          placeholder={
                            record.status === 'Sakit'
                              ? 'Contoh: Demam, Surat dokter'
                              : record.status === 'Izin'
                              ? 'Contoh: Acara keluarga'
                              : record.status === 'Hadir' && record.terlambat > 0
                              ? 'Contoh: Ban bocor, Angkot lambat'
                              : 'Tambahkan catatan...'
                          }
                          className="w-full py-2 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Standard Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-xs tracking-wider uppercase border-b border-slate-200">
                    <th className="py-3 px-5">Siswa</th>
                    <th className="py-3 px-5 text-center">Status Kehadiran (Validasi Dropdown)</th>
                    <th className="py-3 px-5 text-center w-40">Keterlambatan (Menit)</th>
                    <th className="py-3 px-5">Keterangan / Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map(record => {
                    const studentInfo = students.find(s => s.nis === record.nis);
                    const noAbsen = studentInfo?.noAbsen || '';
                    return (
                      <tr key={record.nis} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            {noAbsen && (
                              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-mono font-extrabold text-xs shrink-0">
                                No. Absen: {noAbsen}
                              </span>
                            )}
                            <div>
                              <span className="font-bold text-slate-800 block text-sm">{record.nama}</span>
                              <span className="font-mono text-xs text-slate-500">NIS: {record.nis}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 gap-1 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(record.nis, 'Hadir')}
                              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                                record.status === 'Hadir'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Hadir
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(record.nis, 'Sakit')}
                              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                                record.status === 'Sakit'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Sakit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(record.nis, 'Izin')}
                              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                                record.status === 'Izin'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Izin
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(record.nis, 'Alfa')}
                              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                                record.status === 'Alfa'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Alfa
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center justify-center">
                            <div className="relative w-28">
                              <input
                                type="number"
                                min="0"
                                disabled={record.status !== 'Hadir'}
                                value={record.status !== 'Hadir' ? '' : record.terlambat}
                                onChange={e => handleLatenessChange(record.nis, e.target.value)}
                                className={`w-full text-center py-1.5 text-sm rounded-lg border font-mono ${
                                  record.status !== 'Hadir'
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    : record.terlambat > 0
                                    ? 'border-rose-300 text-rose-700 bg-rose-50 focus:ring-rose-400 focus:border-rose-400'
                                    : 'border-slate-200 text-slate-700 focus:ring-indigo-500 focus:border-indigo-500'
                                }`}
                                placeholder="0"
                              />
                              {record.status === 'Hadir' && record.terlambat > 0 && (
                                <span className="absolute right-2 top-2.5 text-rose-500 animate-pulse">
                                  <Clock className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <input
                            type="text"
                            value={record.keterangan}
                            onChange={e => handleRemarkChange(record.nis, e.target.value)}
                            placeholder={
                              record.status === 'Sakit'
                                ? 'Contoh: Demam tinggi, Surat dokter ada'
                                : record.status === 'Izin'
                                ? 'Contoh: Acara keluarga ke luar kota'
                                : record.status === 'Hadir' && record.terlambat > 0
                                ? 'Contoh: Ketinggalan angkot, Ban bocor'
                                : 'Catatan tambahan...'
                            }
                            className="w-full py-1.5 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
