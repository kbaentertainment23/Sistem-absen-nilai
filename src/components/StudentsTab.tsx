import React, { useState } from 'react';
import { Student } from '../types';
import { Plus, Edit2, Trash2, Check, AlertCircle, RefreshCw, Loader2, Info, Camera, User, Image, X } from 'lucide-react';
import { uploadStudentPhotoToDrive, getStudentPhotoUrl } from '../lib/googleSheets';

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

interface StudentsTabProps {
  students: Student[];
  allStudents?: Student[];
  onSyncRoster: (updatedStudents: Student[], nisChanges?: Record<string, string>) => Promise<void>;
  role: 'admin' | 'guru';
  classes: { id: number; name: string }[];
  selectedClassId: number;
  onSelectClassId: (id: number) => void;
  onSyncClasses: (updatedClasses: { id: number; name: string }[]) => Promise<void>;
  accessToken?: string | null;
}

const DEFAULT_FALLBACK_ROSTER: Student[] = [
  { nis: '12001', nama: 'Andi Pratama', jenisKelamin: 'L' },
  { nis: '12002', nama: 'Budi Santoso', jenisKelamin: 'L' },
  { nis: '12003', nama: 'Citra Lestari', jenisKelamin: 'P' },
  { nis: '12004', nama: 'Dewi Sartika', jenisKelamin: 'P' },
  { nis: '12005', nama: 'Eko Prasetyo', jenisKelamin: 'L' },
  { nis: '12006', nama: 'Farhan Wijaya', jenisKelamin: 'L' },
];

export default function StudentsTab({
  students,
  allStudents = [],
  onSyncRoster,
  role,
  classes,
  selectedClassId,
  onSelectClassId,
  onSyncClasses,
  accessToken
}: StudentsTabProps) {
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [editingClassNameInput, setEditingClassNameInput] = useState('');

  // Local Students state for the active class
  const [localStudents, setLocalStudents] = useState<Student[]>([]);
  const [noAbsenInput, setNoAbsenInput] = useState('');
  const [nisInput, setNisInput] = useState('');
  const [namaInput, setNamaInput] = useState('');
  const [genderInput, setGenderInput] = useState<'L' | 'P'>('L');
  const [fotoInput, setFotoInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [zoomedName, setZoomedName] = useState<string>('');
  const [editingNis, setEditingNis] = useState<string | null>(null);
  const [nisChanges, setNisChanges] = useState<Record<string, string>>({});
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [classToDelete, setClassToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const startCamera = async () => {
    setErrorText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setErrorText('Tidak dapat mengakses kamera perangkat. Pastikan izin kamera telah diberikan.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the canvas context horizontally to match the mirrored camera display
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setFotoInput(dataUrl);
        stopCamera();
      }
    }
  };

  React.useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // States for adding a new class
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);

  // Synchronize when active class changes or props change from outside
  React.useEffect(() => {
    setNisChanges({});
    if (students && students.length > 0) {
      setLocalStudents(students.map(s => ({
        ...s,
        jenisKelamin: s.jenisKelamin || 'L',
        foto: s.foto || localStorage.getItem(`student_photo_${s.nis}`) || undefined
      })));
    } else {
      const cachedStudents = localStorage.getItem(`absensi_class_students_${selectedClassId}`);
      if (cachedStudents) {
        try {
          const parsed = JSON.parse(cachedStudents);
          const enriched = parsed.map((s: Student) => ({
            ...s,
            foto: s.foto || localStorage.getItem(`student_photo_${s.nis}`) || undefined
          }));
          setLocalStudents(enriched);
          return;
        } catch (e) {
          console.error(e);
        }
      }

      // Fallback roster initialization seeded with NIS variation
      const sample = DEFAULT_FALLBACK_ROSTER.map((s) => ({
        ...s,
        nis: String(Number(s.nis) + (selectedClassId - 1) * 10),
      })).map(s => ({
        ...s,
        foto: localStorage.getItem(`student_photo_${s.nis}`) || undefined
      }));
      setLocalStudents(sample);
      localStorage.setItem(`absensi_class_students_${selectedClassId}`, JSON.stringify(sample));
    }
  }, [selectedClassId, students]);

  // Handle local state updates back to localStorage
  const saveLocalStudentsState = (updated: Student[]) => {
    setLocalStudents(updated);
    localStorage.setItem(`absensi_class_students_${selectedClassId}`, JSON.stringify(updated));
  };

  const handleSelectClass = (classId: number) => {
    stopCamera();
    onSelectClassId(classId);
    setEditingNis(null);
    setNisInput('');
    setNamaInput('');
    setNoAbsenInput('');
    setGenderInput('L');
    setErrorText('');
  };

  const handleStartRenameClass = (cls: { id: number; name: string }) => {
    setEditingClassId(cls.id);
    setEditingClassNameInput(cls.name);
  };

  const handleSaveClassName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClassNameInput.trim()) return;

    const updated = classes.map(c =>
      c.id === editingClassId ? { ...c, name: editingClassNameInput.trim() } : c
    );
    try {
      await onSyncClasses(updated);
      setEditingClassId(null);
    } catch (err) {
      console.error(err);
      setErrorText('Gagal memperbarui nama kelas di spreadsheet.');
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newClassNameInput.trim();
    if (!trimmedName) return;

    if (classes.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setErrorText('Nama kelas sudah ada.');
      return;
    }

    setIsAddingClass(true);
    setErrorText('');

    const newId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
    const updated = [...classes, { id: newId, name: trimmedName }];

    try {
      await onSyncClasses(updated);
      setShowAddClassModal(false);
      setNewClassNameInput('');
      onSelectClassId(newId);
    } catch (err) {
      console.error(err);
      setErrorText('Gagal menambahkan kelas baru ke spreadsheet.');
    } finally {
      setIsAddingClass(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    setIsDeletingClass(true);
    setErrorText('');

    const updated = classes.filter(c => c.id !== classToDelete.id);
    try {
      await onSyncClasses(updated);
      setClassToDelete(null);
    } catch (err) {
      console.error(err);
      setErrorText('Gagal menghapus kelas dari spreadsheet.');
    } finally {
      setIsDeletingClass(false);
    }
  };

  const triggerAutoSync = async (updatedList: Student[], currentNisChanges?: Record<string, string>) => {
    if (role === 'guru') return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      await onSyncRoster(updatedList, currentNisChanges || nisChanges);
      setNisChanges({});
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      console.error('Auto-sync error:', err);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    const trimmedNis = nisInput.trim();
    const trimmedNama = namaInput.trim();

    if (!trimmedNis || !trimmedNama) {
      setErrorText('NIS dan Nama Siswa tidak boleh kosong.');
      return;
    }

    if (!/^\d+$/.test(trimmedNis)) {
      setErrorText('NIS harus berupa angka saja.');
      return;
    }

    let updatedList: Student[] = [];
    let currentNisChanges = { ...nisChanges };

    if (editingNis) {
      // Editing Mode
      if (trimmedNis !== editingNis && localStudents.some(s => s.nis === trimmedNis)) {
        setErrorText('NIS sudah terdaftar untuk siswa lain.');
        return;
      }

      let finalFoto = fotoInput;
      if (fotoInput && fotoInput.startsWith('data:image')) {
        setIsUploading(true);
        try {
          if (accessToken) {
            finalFoto = await uploadStudentPhotoToDrive(accessToken, trimmedNis, fotoInput);
          }
        } catch (err) {
          console.error('Gagal mengunggah foto ke Google Drive, menggunakan penyimpanan lokal:', err);
        } finally {
          setIsUploading(false);
        }
      }

      // If NIS changed, handle photo key migration
      if (trimmedNis !== editingNis) {
        if (finalFoto) {
          try {
            localStorage.setItem(`student_photo_${trimmedNis}`, finalFoto);
          } catch (err) {
            console.error('Failed to save student photo to localStorage:', err);
          }
        }
        try {
          localStorage.removeItem(`student_photo_${editingNis}`);
        } catch (err) {
          console.error('Failed to remove student photo from localStorage:', err);
        }
        currentNisChanges = { ...currentNisChanges, [editingNis]: trimmedNis };
        setNisChanges(currentNisChanges);
      } else {
        if (finalFoto) {
          try {
            localStorage.setItem(`student_photo_${trimmedNis}`, finalFoto);
          } catch (err) {
            console.error('Failed to save student photo to localStorage:', err);
          }
        } else {
          try {
            localStorage.removeItem(`student_photo_${trimmedNis}`);
          } catch (err) {
            console.error('Failed to remove student photo from localStorage:', err);
          }
        }
      }

      updatedList = localStudents.map(s =>
        s.nis === editingNis ? { ...s, noAbsen: noAbsenInput.trim(), nis: trimmedNis, nama: trimmedNama, jenisKelamin: genderInput, foto: finalFoto || undefined } : s
      );
      saveLocalStudentsState(updatedList);
      setEditingNis(null);
    } else {
      // Add Mode
      if (localStudents.some(s => s.nis === trimmedNis)) {
        setErrorText('NIS sudah terdaftar.');
        return;
      }

      let finalFoto = fotoInput;
      if (fotoInput && fotoInput.startsWith('data:image')) {
        setIsUploading(true);
        try {
          if (accessToken) {
            finalFoto = await uploadStudentPhotoToDrive(accessToken, trimmedNis, fotoInput);
          }
        } catch (err) {
          console.error('Gagal mengunggah foto ke Google Drive, menggunakan penyimpanan lokal:', err);
        } finally {
          setIsUploading(false);
        }
      }

      if (finalFoto) {
        try {
          localStorage.setItem(`student_photo_${trimmedNis}`, finalFoto);
        } catch (err) {
          console.error('Failed to save student photo to localStorage:', err);
        }
      }

      updatedList = [...localStudents, { noAbsen: noAbsenInput.trim(), nis: trimmedNis, nama: trimmedNama, jenisKelamin: genderInput, foto: finalFoto || undefined }];
      saveLocalStudentsState(updatedList);
    }

    setNisInput('');
    setNamaInput('');
    setNoAbsenInput('');
    setGenderInput('L');
    setFotoInput('');
    setShowStudentModal(false);

    // Automatically sync updated list
    await triggerAutoSync(updatedList, currentNisChanges);
  };

  const startEdit = (student: Student) => {
    setEditingNis(student.nis);
    setNisInput(student.nis);
    setNamaInput(student.nama);
    setNoAbsenInput(student.noAbsen || '');
    setGenderInput(student.jenisKelamin || 'L');
    setFotoInput(student.foto || localStorage.getItem(`student_photo_${student.nis}`) || '');
    setErrorText('');
    setShowStudentModal(true);
  };

  const cancelEdit = () => {
    stopCamera();
    setEditingNis(null);
    setNisInput('');
    setNamaInput('');
    setNoAbsenInput('');
    setGenderInput('L');
    setFotoInput('');
    setErrorText('');
    setShowStudentModal(false);
  };

  const handleDelete = (student: Student) => {
    setStudentToDelete(student);
  };

  const confirmDeleteStudent = async () => {
    if (studentToDelete) {
      localStorage.removeItem(`student_photo_${studentToDelete.nis}`);
      const updated = localStudents.filter(s => s.nis !== studentToDelete.nis);
      saveLocalStudentsState(updated);
      setStudentToDelete(null);
      
      // Automatically sync after deletion
      await triggerAutoSync(updated, nisChanges);
    }
  };

  // Check if there are local unsaved modifications compared to props
  const hasUnsavedChanges = JSON.stringify(localStudents) !== JSON.stringify(students);

  return (
    <div id="students-section" className="space-y-6">
      
      {/* Classes Selection Panel */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2 h-4.5 bg-indigo-600 rounded-full inline-block" />
              Pilih & Kelola Roster Kelas
              <span className="px-2 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 uppercase tracking-wider">
                {classes.length} Kelas
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Klik pada kelas untuk memuat roster siswa. Admin dapat mengedit nama atau menghapus kelas beserta rosternya.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {classes.map(cls => {
            const isSelected = selectedClassId === cls.id;
            
            // Dynamic count from allStudents loaded from Sheet, or local state for the active class, or local storage
            const studentsInThisClass = allStudents.filter(s => s.kelas === cls.name);
            const currentRoster = JSON.parse(localStorage.getItem(`absensi_class_students_${cls.id}`) || '[]');
            
            const studentCount = isSelected
              ? localStudents.length
              : (studentsInThisClass.length > 0
                  ? studentsInThisClass.length
                  : (currentRoster.length > 0 ? currentRoster.length : 0));

            return (
              <div
                key={cls.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200 select-none ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-slate-50/50 shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectClass(cls.id)}
                  className="inline-flex items-center gap-1.5 cursor-pointer focus:outline-none font-bold text-xs"
                >
                  <span className={isSelected ? 'text-white' : 'text-slate-800'}>{cls.name}</span>
                  <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {studentCount}
                  </span>
                </button>

                {role === 'admin' && (
                  <div className="flex items-center gap-0.5 pl-1.5 border-l border-slate-200/40 group-hover:border-slate-305">
                    <button
                      type="button"
                      onClick={() => handleStartRenameClass(cls)}
                      className={`p-0.5 rounded-full transition-colors duration-150 cursor-pointer ${
                        isSelected 
                          ? 'hover:bg-indigo-500 text-indigo-200 hover:text-white' 
                          : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'
                      }`}
                      title="Ubah nama kelas"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassToDelete(cls)}
                      className={`p-0.5 rounded-full transition-colors duration-150 cursor-pointer ${
                        isSelected 
                          ? 'hover:bg-indigo-500 text-indigo-200 hover:text-rose-200' 
                          : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                      }`}
                      title="Hapus kelas"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowAddClassModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/30 hover:bg-indigo-50/20 text-slate-500 hover:text-indigo-600 transition-all duration-200 cursor-pointer text-xs font-bold"
              title="Tambah kelas baru"
            >
              <Plus className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span>Tambah Kelas</span>
            </button>
          )}
        </div>
      </div>

      {/* Student Roster List Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  Daftar Roster: <span className="text-indigo-600 font-extrabold">{(classes.find(c => c.id === selectedClassId))?.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Total terdaftar: <span className="font-bold text-slate-800">{localStudents.length} siswa</span>.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {role === 'guru' && (
                  <span className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold">
                    Mode Lihat Saja 👁️
                  </span>
                )}

                {role === 'admin' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        cancelEdit();
                        setShowStudentModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" /> Tambah Siswa Baru
                    </button>
                    {isSyncing ? (
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-xl border border-indigo-200 font-bold flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Menyinkronkan otomatis...
                      </span>
                    ) : syncStatus === 'success' ? (
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 font-bold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        Tersinkron otomatis!
                      </span>
                    ) : syncStatus === 'error' ? (
                      <span className="text-xs text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-xl border border-rose-250 font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Gagal Menyinkronkan
                      </span>
                    ) : hasUnsavedChanges ? (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-200 font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Ada Perubahan (Menunggu Sinkron)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 font-bold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-slate-400" />
                        Database Tersinkron
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={`overflow-x-auto ${localStudents.length > 6 ? 'max-h-[440px] overflow-y-auto scrollbar-thin' : ''}`}>
              {localStudents.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  Belum ada murid dalam roster kelas ini. Gunakan formulir di samping untuk mendaftar.
                </div>
              ) : (
                <>
                  {/* Mobile view: Roster Card List */}
                  <div className="block md:hidden space-y-3 p-4 bg-slate-50/50">
                    {localStudents.map((student, idx) => (
                      <div key={student.nis} className="bg-white p-4.5 rounded-2xl border border-slate-150/80 shadow-xs hover:shadow-md hover:border-indigo-150 transition-all duration-200 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Absen No */}
                          <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100/70 rounded-xl text-indigo-700 font-mono font-extrabold text-xs shrink-0 shadow-3xs">
                            #{student.noAbsen || (idx + 1)}
                          </span>

                          {/* Student Photo */}
                          {student.foto ? (
                            <img
                              src={getStudentPhotoUrl(student.foto)}
                              alt={student.nama}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 object-cover rounded-full ring-2 ring-slate-100 ring-offset-1 cursor-pointer shrink-0 transition-transform duration-150 hover:scale-105"
                              onClick={() => {
                                setZoomedPhoto(student.foto || null);
                                setZoomedName(student.nama);
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-slate-50 rounded-full border border-slate-200/60 ring-2 ring-slate-50 ring-offset-1 flex items-center justify-center text-slate-400 shrink-0 shadow-2xs">
                              <User className="w-5.5 h-5.5 text-slate-400" />
                            </div>
                          )}

                          {/* Name & NIS & Gender */}
                          <div className="min-w-0 space-y-1">
                            <span className="font-extrabold text-slate-800 text-sm block truncate tracking-tight">{student.nama}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/40">NIS: {student.nis}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                student.jenisKelamin === 'P' 
                                  ? 'bg-pink-50 border border-pink-100 text-pink-700' 
                                  : 'bg-blue-50 border border-blue-100 text-blue-700'
                              }`}>
                                {student.jenisKelamin === 'P' ? 'Perempuan (P)' : 'Laki-laki (L)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {role === 'admin' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => startEdit(student)}
                              className="p-2 bg-slate-50/80 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/60 hover:border-indigo-150 rounded-xl transition duration-150 cursor-pointer shadow-3xs"
                              title="Edit Siswa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(student)}
                              className="p-2 bg-slate-50/80 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/60 hover:border-rose-150 rounded-xl transition duration-150 cursor-pointer shadow-3xs"
                              title="Hapus Siswa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop view: Standard table */}
                  <table className="hidden md:table w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                      <tr className="text-slate-500 font-bold text-xs tracking-wider uppercase">
                        <th className="py-2.5 px-5">No. Absen</th>
                        <th className="py-2.5 px-5 w-16">Foto</th>
                        <th className="py-2.5 px-5">NIS (Angka)</th>
                        <th className="py-2.5 px-5">Nama Lengkap</th>
                        <th className="py-2.5 px-5">Jenis Kelamin</th>
                        {role === 'admin' && <th className="py-2.5 px-5 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {localStudents.map((student, idx) => (
                        <tr key={student.nis} className="hover:bg-slate-50/20 transition">
                          <td className="py-3 px-5 text-slate-600 text-sm font-mono font-bold">{student.noAbsen || (idx + 1)}</td>
                          <td className="py-3 px-5">
                            {student.foto ? (
                              <img
                                src={getStudentPhotoUrl(student.foto)}
                                alt={student.nama}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 object-cover rounded-full border border-slate-200 cursor-pointer hover:scale-105 transition duration-150"
                                onClick={() => {
                                  setZoomedPhoto(student.foto || null);
                                  setZoomedName(student.nama);
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400">
                                <User className="w-5 h-5" />
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-5 font-mono text-sm text-slate-600 font-bold">{student.nis}</td>
                          <td className="py-3 px-5 text-sm font-bold text-slate-800">{student.nama}</td>
                          <td className="py-3 px-5 text-xs">
                            {student.jenisKelamin === 'P' ? (
                              <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 px-2.5 py-1 rounded-full font-bold border border-pink-100">
                                Perempuan (P)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold border border-blue-100">
                                Laki-laki (L)
                              </span>
                            )}
                          </td>
                          {role === 'admin' && (
                            <td className="py-3 px-5 text-right flex justify-end gap-2">
                              <button
                                onClick={() => startEdit(student)}
                                className="p-2 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/60 hover:border-indigo-150 rounded-xl transition duration-150 cursor-pointer shadow-3xs"
                                title="Edit Siswa"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(student)}
                                className="p-2 bg-slate-50 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/60 hover:border-rose-150 rounded-xl transition duration-150 cursor-pointer shadow-3xs"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>

      {/* Rename Class Modal */}
      {editingClassId !== null && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveClassName}
            className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                <Edit2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Ubah Nama Kelas
                </h3>
                <p className="text-xs text-slate-500">
                  Ubah nama kelas yang Anda pilih di roster.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Nama Kelas Baru
              </label>
              <input
                type="text"
                required
                value={editingClassNameInput}
                onChange={e => setEditingClassNameInput(e.target.value)}
                className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold text-slate-800"
                placeholder="Contoh: Kelas XI IPA 2"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditingClassId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddClass}
            className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                <Plus className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Tambah Kelas Baru
                </h3>
                <p className="text-xs text-slate-500">
                  Tambahkan kelas baru ke daftar kelas roster.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Nama Kelas Baru
              </label>
              <input
                type="text"
                required
                value={newClassNameInput}
                onChange={e => setNewClassNameInput(e.target.value)}
                className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold text-slate-800"
                placeholder="Contoh: Kelas 8.12"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddClassModal(false);
                  setNewClassNameInput('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                disabled={isAddingClass}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isAddingClass}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isAddingClass ? 'Menyimpan...' : 'Tambah Kelas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Hapus Kelas {classToDelete.name}?
                </h3>
                <p className="text-xs text-slate-500 font-bold font-mono">
                  ID KELAS: {classToDelete.id}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-rose-50/30 border border-rose-100 rounded-xl p-3.5 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus kelas ini? Tindakan ini akan langsung menghapus kelas dari spreadsheet pada sheet <strong>Daftar Kelas</strong>.
              </p>
              <p className="text-[10px] text-rose-700 font-semibold bg-white/85 p-2 rounded-lg border border-rose-100">
                ⚠️ PERINGATAN: Semua roster siswa yang terdaftar di kelas ini juga akan otomatis dihapus dari sheet Siswa, Nilai Formatif, Nilai Sumatif, dan Rekap Bulanan untuk menjaga sinkronisasi database!
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                disabled={isDeletingClass}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteClass}
                disabled={isDeletingClass}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeletingClass ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  'Hapus Kelas'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Hapus Siswa dari Roster?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {studentToDelete.nama} (NIS: {studentToDelete.nis})
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-rose-50/30 border border-rose-100 rounded-xl p-3.5 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus siswa ini? Tindakan ini akan langsung menghapus data siswa dari database Google Sheets secara otomatis.
              </p>
              <p className="text-[10px] text-rose-700 font-medium bg-white/80 p-2 rounded-lg border border-rose-100">
                ⚠️ PERINGATAN: Nilai formatif, sumatif, dan rekap bulanan untuk siswa ini juga akan otomatis dibersihkan agar database tetap sinkron dan rapi.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteStudent}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Hapus Siswa
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Student Add/Edit Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 relative my-8">
            <button
              type="button"
              onClick={cancelEdit}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                {editingNis ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  {editingNis ? 'Edit Detail Siswa' : 'Tambah Siswa Baru'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingNis ? 'Perbarui data siswa yang terdaftar di roster.' : 'Tambahkan siswa baru ke roster kelas ini.'}
                </p>
              </div>
            </div>

            {role === 'guru' ? (
              <div className="space-y-4">
                <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Akses Terbatas (Mode Guru)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Anda sedang dalam <strong>Mode Guru (Hanya Baca)</strong>. Hanya pengguna dengan peran <strong>Admin</strong> yang diperbolehkan menambah, mengedit, atau menghapus data murid dalam roster kelas ini.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  💡 <strong>Tips:</strong> Klik tombol peran <strong>"Admin 🔑"</strong> di menu kanan atas untuk membuka kunci akses penuh penambahan dan pengeditan data siswa.
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddOrUpdate} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    No. Absen
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1"
                    value={noAbsenInput}
                    onChange={e => setNoAbsenInput(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nomor Induk Siswa (NIS)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 12007"
                    value={nisInput}
                    onChange={e => setNisInput(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nama Lengkap Murid
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Galih Permana"
                    value={namaInput}
                    onChange={e => setNamaInput(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Foto Siswa
                  </label>
                  {isCameraActive ? (
                    <div className="space-y-3 border border-slate-200 rounded-2xl p-3 bg-slate-50">
                      <div className="relative aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-300 shadow-inner flex items-center justify-center">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                        <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                          Kamera Aktif
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs font-sans"
                        >
                          <Camera className="w-4 h-4" /> Ambil Foto
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      {fotoInput ? (
                        <div className="relative">
                          <img
                            src={getStudentPhotoUrl(fotoInput)}
                            alt="Preview"
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 object-cover rounded-xl border border-slate-200 cursor-pointer hover:opacity-90"
                            onClick={() => {
                              setZoomedPhoto(fotoInput);
                              setZoomedName(namaInput || 'Pratinjau Foto');
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setFotoInput('')}
                            className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition shadow-xs cursor-pointer"
                            title="Hapus Foto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          {/* Opsi 1: Kamera Langsung */}
                          <button
                            type="button"
                            onClick={startCamera}
                            className="border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 rounded-xl p-3 text-center transition flex flex-col items-center justify-center cursor-pointer min-h-[76px]"
                          >
                            <Camera className="w-5 h-5 text-indigo-500 mb-1" />
                            <span className="text-[10px] font-bold text-slate-700 block">Kamera Langsung</span>
                            <span className="text-[8px] text-slate-400 mt-0.5 block leading-tight">Ambil foto baru</span>
                          </button>

                          {/* Opsi 2: Unggah Berkas */}
                          <label className="border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/20 rounded-xl p-3 text-center transition flex flex-col items-center justify-center cursor-pointer min-h-[76px]">
                            <Image className="w-5 h-5 text-indigo-500 mb-1" />
                            <span className="text-[10px] font-bold text-slate-700 block">Unggah Galeri</span>
                            <span className="text-[8px] text-slate-400 mt-0.5 block leading-tight">Pilih dari perangkat</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setIsUploading(true);
                                  try {
                                    const compressed = await compressImage(file);
                                    setFotoInput(compressed);
                                  } catch (err) {
                                    console.error(err);
                                    setErrorText('Gagal mengunggah & mengompres foto.');
                                  } finally {
                                    setIsUploading(false);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}

                      {fotoInput && (
                        <div className="flex-1 text-left pt-1">
                          <span className="text-xs text-slate-600 block leading-tight">
                            {isUploading ? (
                              <span className="flex items-center gap-1 font-semibold text-indigo-600">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengompres...
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Foto siap disimpan
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-1 leading-tight">
                            Ukuran foto diperkecil otomatis agar ringan.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Jenis Kelamin
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setGenderInput('L')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        genderInput === 'L'
                          ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      Laki-laki (L)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenderInput('P')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        genderInput === 'P'
                          ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-xs'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      Perempuan (P)
                    </button>
                  </div>
                </div>

                {errorText && (
                  <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorText}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {editingNis ? (
                      <>
                        <Check className="w-4 h-4" /> Perbarui
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Tambah ke Daftar
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 px-3 rounded-xl text-sm font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed space-y-1 text-left">
              <p className="font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                PENTING UNTUK GURU:
              </p>
              <p>
                Setiap kali Anda menambah atau mengedit nama siswa, sistem akan langsung menyinkronkan data secara otomatis ke database Google Sheets secara real-time.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
