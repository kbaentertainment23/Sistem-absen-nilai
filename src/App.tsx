import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from './lib/firebase';
import { appsScriptConfig } from './lib/appsScriptConfig';
import {
  listSpreadsheets,
  createSpreadsheet,
  getSpreadsheetData,
  syncStudentRoster,
  saveAllAttendance,
  saveGrades,
  downloadExportFile,
  checkAndPrepareSpreadsheet,
  setupMissingSheets,
  APPS_SCRIPT_TEMPLATE_CODE
} from './lib/googleSheets';
import { Student, AttendanceRecord, GradeFormative, GradeSummative, MonthlyRecap, SpreadsheetInfo, GradeColumn, StudentNote, ExtraTikPeserta, ExtraTikAbsensi, ExtraTikNilai } from './types';

// Tab components
import AttendanceTab from './components/AttendanceTab';
import GradesTab from './components/GradesTab';
import RecapTab from './components/RecapTab';
import StudentsTab from './components/StudentsTab';
import StudentNotesTab from './components/StudentNotesTab';
import LoginPage from './components/LoginPage';
import ProfessionalReportTab from './components/ProfessionalReportTab';
import ExtraTIKTab from './components/ExtraTIKTab';

import {
  FileSpreadsheet,
  FileText,
  LogIn,
  LogOut,
  CalendarDays,
  GraduationCap,
  PieChart,
  Users,
  Download,
  Plus,
  RefreshCw,
  FolderOpen,
  Info,
  ExternalLink,
  Loader2,
  AlertCircle,
  TrendingUp,
  Award,
  ChevronRight,
  Search,
  Link,
  Database,
  ShieldAlert,
  ClipboardList,
  Sparkles,
  AlertTriangle,
  BookOpen,
  UserCheck,
  Menu,
  X
} from 'lucide-react';

const DEFAULT_SAMPLE_STUDENTS: Student[] = [
  { nis: '12001', nama: 'Andi Pratama', jenisKelamin: 'L', kelas: 'Kelas 8.1' },
  { nis: '12002', nama: 'Budi Santoso', jenisKelamin: 'L', kelas: 'Kelas 8.1' },
  { nis: '12003', nama: 'Citra Lestari', jenisKelamin: 'P', kelas: 'Kelas 8.1' },
  { nis: '12004', nama: 'Dewi Sartika', jenisKelamin: 'P', kelas: 'Kelas 8.1' },
  { nis: '12005', nama: 'Eko Prasetyo', jenisKelamin: 'L', kelas: 'Kelas 8.1' },
  { nis: '12006', nama: 'Farhan Wijaya', jenisKelamin: 'L', kelas: 'Kelas 8.1' },
];

const DEFAULT_CLASSES = Array.from({ length: 11 }, (_, i) => {
  return { id: i + 1, name: `Kelas 8.${i + 1}` };
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [role, setRole] = useState<'admin' | 'guru'>('admin');
  const isPermanentConnection = false;

  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [nisInput, setNisInput] = useState('');
  
  // New States for Questions & Submissions
  const [questions, setQuestions] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [retakePermissions, setRetakePermissions] = useState<any[]>([]);

  // Real-time CBT Monitoring & Auto-Sync state
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' }[]>([]);

  const addToast = (message: string, type: 'success' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Active tab inside connected dashboard
  const [activeTab, setActiveTab] = useState<'attendance' | 'grades' | 'notes' | 'recap' | 'students' | 'professional_report' | 'database' | 'extra_tik'>('attendance');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState(false);

  // Extra TIK States
  const [extraTikPeserta, setExtraTikPeserta] = useState<ExtraTikPeserta[]>([]);
  const [extraTikAbsensi, setExtraTikAbsensi] = useState<ExtraTikAbsensi[]>([]);
  const [extraTikNilai, setExtraTikNilai] = useState<ExtraTikNilai[]>([]);

  // Safety check to reset tab if the role doesn't have access to it
  useEffect(() => {
    if (role === 'guru') {
      const allowedGuruTabs = ['attendance', 'grades', 'notes', 'recap', 'students'];
      if (!allowedGuruTabs.includes(activeTab)) {
        setActiveTab('attendance');
      }
    }
  }, [role, activeTab]);

  // Bank Soal & Schedules (Jadwal Ujian) states
  const [bankSoalQuestions, setBankSoalQuestions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  // Jurnal Catatan Siswa State
  const [notes, setNotes] = useState<StudentNote[]>([]);

  // 11 Customizable Classes State
  const [classes, setClasses] = useState<{ id: number; name: string }[]>(DEFAULT_CLASSES);
  const [selectedClassId, setSelectedClassId] = useState<number>(1);

  // Spreadsheet connections state
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([]);
  const [connectedSpreadsheet, setConnectedSpreadsheet] = useState<SpreadsheetInfo | null>(null);
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('');

  // States for search and connecting existing databases
  const [spreadsheetSearchQuery, setSpreadsheetSearchQuery] = useState('');
  const [urlOrIdInput, setUrlOrIdInput] = useState('');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [isConnectingCustom, setIsConnectingCustom] = useState(false);
  const [showIncompatibleModal, setShowIncompatibleModal] = useState(false);
  const [incompatibleSheetId, setIncompatibleSheetId] = useState<string | null>(null);
  const [incompatibleSheetTitle, setIncompatibleSheetTitle] = useState<string | null>(null);
  const [missingSheetsToInit, setMissingSheetsToInit] = useState<string[]>([]);

  // Main student database states loaded from Sheets
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [formativeGrades, setFormativeGrades] = useState<GradeFormative[]>([]);
  const [summativeGrades, setSummativeGrades] = useState<GradeSummative[]>([]);
  const [formativeCols, setFormativeCols] = useState<GradeColumn[]>([]);
  const [summativeCols, setSummativeCols] = useState<GradeColumn[]>([]);
  const [recap, setRecap] = useState<MonthlyRecap[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Simplified auto-connection states
  const [syncingStatusMessage, setSyncingStatusMessage] = useState('');
  const autoConnectInProgress = React.useRef(false);

  // Integrated Login & Results Recap States
  const [hasilUlangan, setHasilUlangan] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Auto discover or create spreadsheet database
  const autoDiscoverOrCreateSpreadsheet = async (accessToken: string) => {
    const savedSpreadsheet = localStorage.getItem('connected_spreadsheet');
    if (savedSpreadsheet || autoConnectInProgress.current) return;
    autoConnectInProgress.current = true;
    setIsLoadingData(true);
    setErrorMsg('');
    try {
      setSyncingStatusMessage('Mencari database Portal Akademik di Google Drive Anda...');
      
      // List spreadsheets in Drive
      const list = await listSpreadsheets(accessToken);
      
      // Look for a spreadsheet that contains "Portal Akademik & Extra TIK" or "Database Absensi & Nilai Siswa"
      const matched = list.find(sheet => 
        sheet.name.includes('Portal Akademik & Extra TIK') || 
        sheet.name.includes('Database Absensi & Nilai Siswa')
      );

      let targetSheet: SpreadsheetInfo;

      if (matched) {
        setSyncingStatusMessage(`Ditemukan! Menghubungkan ke database "${matched.name}"...`);
        targetSheet = matched;
        setConnectedSpreadsheet(targetSheet);
        await loadActiveSpreadsheetData(targetSheet.id, accessToken);
        addToast(`Terhubung otomatis ke database "${matched.name}"`, 'success');
      } else {
        setSyncingStatusMessage('Membuat database baru "Portal Akademik & Extra TIK" di Google Drive Anda...');
        const title = 'Portal Akademik & Extra TIK';
        targetSheet = await createSpreadsheet(accessToken, title, DEFAULT_SAMPLE_STUDENTS);
        setConnectedSpreadsheet(targetSheet);
        await loadActiveSpreadsheetData(targetSheet.id, accessToken);
        addToast('Database baru "Portal Akademik & Extra TIK" berhasil dibuat & terhubung secara otomatis!', 'success');
      }
    } catch (err: any) {
      console.error('Auto connection failed:', err);
      setErrorMsg(`Gagal menghubungkan database secara otomatis: ${err.message || err}`);
      addToast('Otomatisasi database gagal. Silakan hubungkan secara manual di menu Pengaturan.', 'info');
    } finally {
      setIsLoadingData(false);
      setSyncingStatusMessage('');
      autoConnectInProgress.current = false;
    }
  };

  // Dynamically compute monthly attendance recap from students and attendance records
  const calculatedRecap = useMemo(() => {
    return students.map(s => {
      const studentAttendance = attendance.filter(r => r.nis === s.nis);
      const hadir = studentAttendance.filter(r => r.status === 'Hadir').length;
      const sakit = studentAttendance.filter(r => r.status === 'Sakit').length;
      const izin = studentAttendance.filter(r => r.status === 'Izin').length;
      const alfa = studentAttendance.filter(r => r.status === 'Alfa').length;
      const terlambatCount = studentAttendance.filter(r => Number(r.terlambat) > 0).length;
      
      const total = hadir + sakit + izin + alfa;
      const persentaseKehadiran = total > 0 ? hadir / total : 0.0;
      
      return {
        nis: s.nis,
        nama: s.nama,
        jenisKelamin: s.jenisKelamin,
        kelas: s.kelas,
        hadir,
        sakit,
        izin,
        alfa,
        terlambatCount,
        persentaseKehadiran,
      };
    });
  }, [students, attendance]);

  // Dynamically compute unique session days count for Extra TIK
  const extraTikDaysCount = useMemo(() => {
    const dates = new Set<string>();
    extraTikAbsensi.forEach(a => {
      if (a.tanggal) {
        dates.add(a.tanggal);
      }
    });
    return dates.size;
  }, [extraTikAbsensi]);

  // Initialize Auth on App Mount with standard OAuth flow
  useEffect(() => {
    const unsubscribe = initAuth(
      async (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        if (accessToken) {
          loadSpreadsheetsList(accessToken);
        }

        const savedSpreadsheet = localStorage.getItem('connected_spreadsheet');
        if (savedSpreadsheet) {
          try {
            const parsed = JSON.parse(savedSpreadsheet);
            setConnectedSpreadsheet(parsed);
            if (accessToken) {
              await loadActiveSpreadsheetData(parsed.id, accessToken);
            }
          } catch (e) {
            console.error('Error loading cached connected spreadsheet:', e);
          }
        } else {
          // If logged in but no spreadsheet saved, auto-connect or create!
          if (accessToken) {
            await autoDiscoverOrCreateSpreadsheet(accessToken);
          }
        }
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Auto-persist connected spreadsheet whenever it changes
  useEffect(() => {
    if (connectedSpreadsheet) {
      localStorage.setItem('connected_spreadsheet', JSON.stringify(connectedSpreadsheet));
    } else {
      localStorage.removeItem('connected_spreadsheet');
    }
  }, [connectedSpreadsheet]);

  // Set default tab to database if logged in but spreadsheet not connected
  useEffect(() => {
    if (user && !connectedSpreadsheet) {
      setActiveTab('database');
    }
  }, [user, connectedSpreadsheet]);

  // Load student notes & CBT cache on mount
  useEffect(() => {
    const stored = localStorage.getItem('student_notes_records');
    if (stored) {
      try {
        setNotes(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading student notes:', e);
      }
    }

    const cachedHasil = localStorage.getItem('cached_hasil_ulangan');
    if (cachedHasil) {
      try {
        setHasilUlangan(JSON.parse(cachedHasil));
      } catch (e) {}
    }

    const cachedStudents = localStorage.getItem('cached_students');
    const cachedQs = localStorage.getItem('cached_questions');
    const cachedPackages = localStorage.getItem('cached_packages');
    const cachedAssessments = localStorage.getItem('cached_assessments');
    const cachedSubs = localStorage.getItem('cached_submissions');
    const cachedRetakes = localStorage.getItem('cached_retake_permissions');

    if (cachedStudents) {
      try { setStudents(JSON.parse(cachedStudents)); } catch (e) {}
    }
    if (cachedQs) {
      try { setQuestions(JSON.parse(cachedQs)); } catch (e) {}
    }
    if (cachedPackages) {
      try { setPackages(JSON.parse(cachedPackages)); } catch (e) {}
    }
    if (cachedAssessments) {
      try { setAssessments(JSON.parse(cachedAssessments)); } catch (e) {}
    }
    if (cachedSubs) {
      try { setSubmissions(JSON.parse(cachedSubs)); } catch (e) {}
    }
    if (cachedRetakes) {
      try { setRetakePermissions(JSON.parse(cachedRetakes)); } catch (e) {}
    }

    const cachedBankSoal = localStorage.getItem('cached_bank_soal');
    const cachedSchedules = localStorage.getItem('cached_schedules');
    if (cachedBankSoal) {
      try { setBankSoalQuestions(JSON.parse(cachedBankSoal)); } catch (e) {}
    }
    if (cachedSchedules) {
      try { setSchedules(JSON.parse(cachedSchedules)); } catch (e) {}
    }

    const cachedLogins = localStorage.getItem('cached_login_accounts');
    if (cachedLogins) {
      try { setAccounts(JSON.parse(cachedLogins)); } catch (e) {}
    }

    const cachedExtraPeserta = localStorage.getItem('cached_extra_tik_peserta');
    const cachedExtraAbsensi = localStorage.getItem('cached_extra_tik_absensi');
    const cachedExtraNilai = localStorage.getItem('cached_extra_tik_nilai');
    if (cachedExtraPeserta) {
      try { setExtraTikPeserta(JSON.parse(cachedExtraPeserta)); } catch (e) {}
    }
    if (cachedExtraAbsensi) {
      try { setExtraTikAbsensi(JSON.parse(cachedExtraAbsensi)); } catch (e) {}
    }
    if (cachedExtraNilai) {
      try { setExtraTikNilai(JSON.parse(cachedExtraNilai)); } catch (e) {}
    }
  }, []);

  // Real-time security alerts listener for Admin Dashboard
  useEffect(() => {
    if (!user) {
      return;
    }

    const handleViolationEvent = (data: any) => {
      if (data && data.type === 'violation') {
        const { studentName, studentKelas, examName, reason, count } = data;
        addToast(
          `⚠️ [PELANGGARAN] ${studentName} (Kelas ${studentKelas}) terdeteksi: "${reason}" saat mengerjakan "${examName}" (Peringatan ke-${count}/3)`,
          'info'
        );
      }
    };

    // 1. Listen via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('cbt_security_channel');
      channel.onmessage = (event) => {
        handleViolationEvent(event.data);
      };
    } catch (e) {
      console.error('Failed to init BroadcastChannel in App.tsx:', e);
    }

    // 2. Listen via StorageEvent
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cbt_last_violation' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          // Only process if it's within the last 10 seconds to prevent replay on mount
          if (Date.now() - parsed.timestamp < 10000) {
            handleViolationEvent(parsed);
          }
        } catch (err) {
          console.error('Error parsing storage violation:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (channel) {
        channel.close();
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  // Real-time CBT background polling for Admin/Guru dashboard
  useEffect(() => {
    if (!connectedSpreadsheet || !token || activeStudent !== null || !isRealtimeActive || activeTab === 'attendance' || activeTab === 'grades' || activeTab === 'extra_tik') {
      return;
    }

    console.log('[Realtime Polling] Initializing background polling every 15 seconds...');
    const interval = setInterval(async () => {
      try {
        console.log('[Realtime Polling] Checking Google Sheets for newly completed student exams...');
        const { getCbtData } = await import('./lib/googleSheets');
        const { packages: fetchedPkgs, assessments: fetchedAssessments, submissions: fetchedSubs, retakePermissions: fetchedRetakes } = await getCbtData(token, connectedSpreadsheet.id);
        
        setPackages(fetchedPkgs);
        setAssessments(fetchedAssessments);
        setRetakePermissions(fetchedRetakes || []);

        setSubmissions(prevSubs => {
          if (prevSubs && prevSubs.length > 0) {
            const prevIds = new Set(prevSubs.map(s => s.id));
            const newSubs = fetchedSubs.filter(s => !prevIds.has(s.id));
            if (newSubs.length > 0) {
              newSubs.forEach(s => {
                addToast(`🔔 ${s.nama} (${s.kelas}) baru saja menyelesaikan ujian "${s.namaPaket}" dengan skor ${s.persentase}%!`, 'success');
              });
            }
          }
          return fetchedSubs;
        });

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        setLastSyncTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);

        // Update local cache for background data
        localStorage.setItem('cached_packages', JSON.stringify(fetchedPkgs));
        localStorage.setItem('cached_assessments', JSON.stringify(fetchedAssessments));
        localStorage.setItem('cached_submissions', JSON.stringify(fetchedSubs));
        localStorage.setItem('cached_retake_permissions', JSON.stringify(fetchedRetakes || []));
      } catch (err) {
        console.error('[Realtime Polling] Error fetching latest submissions:', err);
      }
    }, 15000);

    return () => {
      console.log('[Realtime Polling] Stopping background polling...');
      clearInterval(interval);
    };
  }, [connectedSpreadsheet, token, activeStudent, isRealtimeActive, activeTab]);

  const handleAddNote = (newNote: Omit<StudentNote, 'id'>) => {
    const noteWithId: StudentNote = {
      ...newNote,
      id: Date.now().toString()
    };
    const updated = [noteWithId, ...notes];
    setNotes(updated);
    localStorage.setItem('student_notes_records', JSON.stringify(updated));
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    localStorage.setItem('student_notes_records', JSON.stringify(updated));
  };

  const handleUpdateNote = (id: string, updatedFields: Partial<StudentNote>) => {
    const updated = notes.map(n => n.id === id ? { ...n, ...updatedFields } : n);
    setNotes(updated);
    localStorage.setItem('student_notes_records', JSON.stringify(updated));
  };

  // Trigger Google Sign In Flow
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        loadSpreadsheetsList(result.accessToken);
        await autoDiscoverOrCreateSpreadsheet(result.accessToken);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      const errMsg = err?.message || '';
      if (errMsg.includes('auth/network-request-failed') || errMsg.includes('network-request-failed')) {
        setAuthError('network-request-failed');
      } else {
        setAuthError(errMsg || 'Gagal masuk menggunakan Google Auth.');
      }
      setErrorMsg('Gagal masuk menggunakan Google Auth. Pastikan pop-up diizinkan.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConnectOfflineDemo = async () => {
    setIsLoadingData(true);
    setErrorMsg('');
    setAuthError(null);
    try {
      const dummyUser = {
        displayName: 'Demo Administrator',
        email: 'demo@smp.sch.id',
        uid: 'mock-offline-uid'
      } as any;
      
      setUser(dummyUser);
      setToken('mock-offline-token');
      setNeedsAuth(false);
      
      const mockSheet = {
        id: 'mock-offline-spreadsheet',
        name: 'Database Demo (Offline Mode)',
        url: '#'
      };
      
      setConnectedSpreadsheet(mockSheet);
      await loadActiveSpreadsheetData(mockSheet.id, 'mock-offline-token');
      addToast('Terhubung ke Database Demo dalam Mode Offline!', 'success');
    } catch (err: any) {
      console.error('Failed to initialize Offline Demo Mode:', err);
      setErrorMsg('Gagal menginisialisasi Mode Demo Offline.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setConnectedSpreadsheet(null);
    setStudents([]);
    setAttendance([]);
    setFormativeGrades([]);
    setSummativeGrades([]);
    setRecap([]);
  };

  const handleSaveStudentSubmission = async (newSubmission: any) => {};
  const handleSyncRetakePermissions = async (updatedRetakes: any[]) => {};
  const handleSyncPackages = async (updatedPackages: any[]) => {};
  const handleSyncAssessments = async (updatedAssessments: any[]) => {};
  const handleSaveBankSoal = async (subject: string, questionsToSave: any[]) => {};
  const handleDeleteSubjectQuestions = async (subject: string, materi: string) => {};
  const handleSaveSchedule = async (schedule: any) => {};
  const handleDeleteSchedule = async (id: string) => {};
  const handleToggleScheduleStatus = async (id: string, nextStatus: any) => {};
  const handleGenerateNewToken = async (id: string) => {};

  const handleSyncExtraTikPeserta = async (updatedPeserta: ExtraTikPeserta[]) => {
    if (!connectedSpreadsheet) return;
    try {
      const { syncExtraTikPeserta } = await import('./lib/googleSheets');
      await syncExtraTikPeserta(token || 'mock-offline-token', connectedSpreadsheet.id, updatedPeserta);
      setExtraTikPeserta(updatedPeserta);
      localStorage.setItem('cached_extra_tik_peserta', JSON.stringify(updatedPeserta));
    } catch (err) {
      console.error('Error syncing Extra TIK Peserta:', err);
      throw err;
    }
  };

  const handleSyncExtraTikAbsensi = async (updatedAbsensi: ExtraTikAbsensi[]) => {
    if (!connectedSpreadsheet) return;
    try {
      const { syncExtraTikAbsensi } = await import('./lib/googleSheets');
      await syncExtraTikAbsensi(token || 'mock-offline-token', connectedSpreadsheet.id, updatedAbsensi);
      setExtraTikAbsensi(updatedAbsensi);
      localStorage.setItem('cached_extra_tik_absensi', JSON.stringify(updatedAbsensi));
    } catch (err) {
      console.error('Error syncing Extra TIK Absensi:', err);
      throw err;
    }
  };

  const handleSyncExtraTikNilai = async (updatedNilai: ExtraTikNilai[]) => {
    if (!connectedSpreadsheet) return;
    try {
      const { syncExtraTikNilai } = await import('./lib/googleSheets');
      await syncExtraTikNilai(token || 'mock-offline-token', connectedSpreadsheet.id, updatedNilai);
      setExtraTikNilai(updatedNilai);
      localStorage.setItem('cached_extra_tik_nilai', JSON.stringify(updatedNilai));
    } catch (err) {
      console.error('Error syncing Extra TIK Nilai:', err);
      throw err;
    }
  };

  // List existing files in user's Drive with optional query
  const loadSpreadsheetsList = async (accessToken: string, query: string = '') => {
    setIsLoadingSpreadsheets(true);
    try {
      const list = await listSpreadsheets(accessToken, query);
      setSpreadsheets(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSpreadsheets(false);
    }
  };

  // Creates and initializes a new student database spreadsheet
  const handleCreateNewSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsCreatingSheet(true);
    setErrorMsg('');
    try {
      const title = newSheetTitle.trim() || 'Database Absensi & Nilai Siswa';
      const sheetInfo = await createSpreadsheet(token, title, DEFAULT_SAMPLE_STUDENTS);
      setConnectedSpreadsheet(sheetInfo);
      
      // Add to list and clear input
      setSpreadsheets(prev => [sheetInfo, ...prev]);
      setNewSheetTitle('');
      
      // Load its freshly initialized contents
      await loadActiveSpreadsheetData(sheetInfo.id, token);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal membuat spreadsheet baru di Drive Anda.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Connects via Google Apps Script Web App URL and Spreadsheet ID/URL
  const handleConnectAppsScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appsScriptUrl.trim()) {
      addToast('URL Apps Script wajib diisi!', 'info');
      return;
    }
    if (!urlOrIdInput.trim()) {
      addToast('URL/ID Spreadsheet wajib diisi!', 'info');
      return;
    }

    setIsConnectingCustom(true);
    setErrorMsg('');
    try {
      const targetUrl = appsScriptUrl.trim();
      const sheetId = extractSpreadsheetId(urlOrIdInput);

      // Temporarily store variables in localStorage to let the callAppsScript proxy use them
      localStorage.setItem('apps_script_url', targetUrl);
      const tempSheetInfo: SpreadsheetInfo = {
        id: sheetId,
        name: 'Database Terhubung (Apps Script)',
        url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
      };
      localStorage.setItem('connected_spreadsheet', JSON.stringify(tempSheetInfo));

      // Test connection by triggering a simple loadActiveSpreadsheetData call
      setToken('apps-script-token');
      await loadActiveSpreadsheetData(sheetId, 'apps-script-token');
      
      setConnectedSpreadsheet(tempSheetInfo);
      setNeedsAuth(false);
      addToast('Koneksi Google Apps Script berhasil terhubung!', 'success');
      setUrlOrIdInput('');
    } catch (err: any) {
      console.error(err);
      // Revert upon connection failure
      localStorage.removeItem('apps_script_url');
      localStorage.removeItem('connected_spreadsheet');
      setConnectedSpreadsheet(null);
      setToken(null);
      setNeedsAuth(true);
      setErrorMsg(`Koneksi Gagal: ${err.message || err}. Pastikan URL Web App benar, mode otorisasi 'Anyone' sudah dipilih di Apps Script, dan ID Spreadsheet valid.`);
      addToast('Koneksi Apps Script Gagal!', 'info');
    } finally {
      setIsConnectingCustom(false);
    }
  };

  // Disconnects Apps Script
  const handleDisconnectAppsScript = () => {
    localStorage.removeItem('apps_script_url');
    localStorage.removeItem('connected_spreadsheet');
    setConnectedSpreadsheet(null);
    setToken(null);
    setNeedsAuth(true);
    addToast('Koneksi Google Spreadsheet diputuskan.', 'info');
  };

  // Extract spreadsheet ID from full URL or return input directly
  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.includes('docs.google.com/spreadsheets')) {
      const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return trimmed;
  };

  // Connects to an existing spreadsheet, checks compatibility first, and loads data
  const handleConnectSpreadsheet = async (sheet: SpreadsheetInfo) => {
    if (!token) return;
    setIsLoadingData(true);
    setErrorMsg('');
    try {
      const { compatible, missingSheets } = await checkAndPrepareSpreadsheet(token, sheet.id);
      if (compatible) {
        setConnectedSpreadsheet(sheet);
        await loadActiveSpreadsheetData(sheet.id, token);
      } else {
        setIncompatibleSheetId(sheet.id);
        setIncompatibleSheetTitle(sheet.name);
        setMissingSheetsToInit(missingSheets);
        setShowIncompatibleModal(true);
        setIsLoadingData(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal memverifikasi format spreadsheet. Pastikan file valid.');
      setIsLoadingData(false);
    }
  };

  // Connects via manually entered Google Sheets URL or ID
  const handleConnectCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !urlOrIdInput.trim()) return;

    setIsConnectingCustom(true);
    setErrorMsg('');
    try {
      const sheetId = extractSpreadsheetId(urlOrIdInput);
      
      // Try to fetch spreadsheet metadata first using the check function
      const { compatible, missingSheets } = await checkAndPrepareSpreadsheet(token, sheetId);
      
      // Fetch its title using the Sheets API
      const metaResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties(title)`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!metaResponse.ok) {
        throw new Error('Spreadsheet tidak ditemukan atau tidak dapat diakses.');
      }
      const metaData = await metaResponse.json();
      const title = metaData.properties?.title || 'Spreadsheet Terhubung';

      const sheetInfo: SpreadsheetInfo = {
        id: sheetId,
        name: title,
        url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      };

      if (compatible) {
        setConnectedSpreadsheet(sheetInfo);
        await loadActiveSpreadsheetData(sheetId, token);
        setUrlOrIdInput('');
      } else {
        setIncompatibleSheetId(sheetId);
        setIncompatibleSheetTitle(title);
        setMissingSheetsToInit(missingSheets);
        setShowIncompatibleModal(true);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Spreadsheet tidak ditemukan atau Anda tidak memiliki hak akses (baca/tulis) ke file tersebut.');
    } finally {
      setIsConnectingCustom(false);
    }
  };

  // Repairs and formats the existing spreadsheet to make it compatible
  const handleRepairSpreadsheet = async () => {
    if (!token || !incompatibleSheetId) return;
    setIsCreatingSheet(true);
    setShowIncompatibleModal(false);
    setErrorMsg('');
    try {
      // Setup missing sheets inside the existing file
      await setupMissingSheets(token, incompatibleSheetId, missingSheetsToInit, DEFAULT_SAMPLE_STUDENTS);
      
      const sheetInfo: SpreadsheetInfo = {
        id: incompatibleSheetId,
        name: incompatibleSheetTitle || 'Database Absensi & Nilai',
        url: `https://docs.google.com/spreadsheets/d/${incompatibleSheetId}/edit`,
      };
      
      setConnectedSpreadsheet(sheetInfo);
      
      // Load data
      await loadActiveSpreadsheetData(incompatibleSheetId, token);
      setUrlOrIdInput('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal melakukan sinkronisasi inisialisasi pada spreadsheet pilihan.');
    } finally {
      setIsCreatingSheet(false);
      setIncompatibleSheetId(null);
      setIncompatibleSheetTitle(null);
      setMissingSheetsToInit([]);
    }
  };

  // Loads database content from the active Google Spreadsheet
  const loadActiveSpreadsheetData = async (spreadsheetId: string, accessToken: string) => {
    setIsLoadingData(true);
    setErrorMsg('');
    try {
      // 1. Fetch ALL data tables in ONE single batched API call!
      const data = await getSpreadsheetData(accessToken, spreadsheetId);
      
      if ((window as any).__appsScriptError) {
        addToast(`Koneksi Google Sheets bermasalah. Sistem menggunakan database cadangan lokal (Mode Offline).`, 'info');
        delete (window as any).__appsScriptError;
      }
      
      const enrichedStudents = data.students.map((s: Student) => ({
        ...s,
        foto: localStorage.getItem(`student_photo_${s.nis}`) || undefined
      }));
      const sortedStudents = [...enrichedStudents].sort((a, b) => {
        const classA = a.kelas || '';
        const classB = b.kelas || '';
        const classCompare = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
        if (classCompare !== 0) return classCompare;
        const noA = parseInt(a.noAbsen || '', 10);
        const noB = parseInt(b.noAbsen || '', 10);
        if (!isNaN(noA) && !isNaN(noB)) return noA - noB;
        if (!isNaN(noA)) return -1;
        if (!isNaN(noB)) return 1;
        const nameA = a.nama || '';
        const nameB = b.nama || '';
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      });
      setStudents(sortedStudents);
      setAttendance(data.attendance);
      setFormativeGrades(data.formativeGrades);
      setSummativeGrades(data.summativeGrades);
      setFormativeCols(data.formativeCols);
      setSummativeCols(data.summativeCols);
      setRecap(data.recap);
      
      setExtraTikPeserta(data.extraTikPeserta || []);
      setExtraTikAbsensi(data.extraTikAbsensi || []);
      setExtraTikNilai(data.extraTikNilai || []);
      
      localStorage.setItem('cached_extra_tik_peserta', JSON.stringify(data.extraTikPeserta || []));
      localStorage.setItem('cached_extra_tik_absensi', JSON.stringify(data.extraTikAbsensi || []));
      localStorage.setItem('cached_extra_tik_nilai', JSON.stringify(data.extraTikNilai || []));
      
      if (data.classes && data.classes.length > 0) {
        const sortedClasses = [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        setClasses(sortedClasses);
      } else {
        setClasses(DEFAULT_CLASSES);
      }

      // Populate CBT-related data
      setPackages([]);
      setAssessments([]);
      setSubmissions([]);
      setRetakePermissions([]);
      setQuestions([]);

      // Map Bank Soal, Schedules, Accounts, and Hasil Ulangan directly from the batched response!
      const fetchedBankQs = data.bankSoalQuestions || [];
      setBankSoalQuestions(fetchedBankQs);
      localStorage.setItem('cached_bank_soal', JSON.stringify(fetchedBankQs));

      const fetchedSchedules = data.schedules || [];
      setSchedules(fetchedSchedules);
      localStorage.setItem('cached_schedules', JSON.stringify(fetchedSchedules));

      const fetchedLogins = data.accounts || [];
      setAccounts(fetchedLogins);
      localStorage.setItem('cached_login_accounts', JSON.stringify(fetchedLogins));

      const fetchedHasil = data.hasilUlangan || [];
      setHasilUlangan(fetchedHasil);
      localStorage.setItem('cached_hasil_ulangan', JSON.stringify(fetchedHasil));

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setLastSyncTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);

      // Save to local cache
      localStorage.setItem('cached_packages', JSON.stringify([]));
      localStorage.setItem('cached_assessments', JSON.stringify([]));
      localStorage.setItem('cached_questions', JSON.stringify([]));
      localStorage.setItem('cached_submissions', JSON.stringify([]));
      localStorage.setItem('cached_retake_permissions', JSON.stringify([]));
      localStorage.setItem('cached_students', JSON.stringify(sortedStudents));

      // 2. Perform background tasks (unused sheets cleanup and user synchronization) asynchronously!
      setTimeout(async () => {
        try {
          const { ensureLoginSheetExistsAndPopulated } = await import('./lib/googleSheets');
          await ensureLoginSheetExistsAndPopulated(accessToken, spreadsheetId, enrichedStudents);
        } catch (loginErr) {
          console.error('Error in background login synchronization:', loginErr);
        }
      }, 500);

    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal memuat data dari spreadsheet ini. Silakan periksa kembali koneksi internet atau konfigurasi Apps Script Anda.');
      // Hanya putuskan koneksi jika tidak menggunakan konfigurasi database permanen
      if (!appsScriptConfig.spreadsheetId || !appsScriptConfig.appsScriptUrl) {
        setConnectedSpreadsheet(null); // disconnect if failed
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  // Reload/refresh current connected sheet
  const handleRefreshData = async () => {
    if (!connectedSpreadsheet || !token) return;
    await loadActiveSpreadsheetData(connectedSpreadsheet.id, token);
  };

  // Handles saving completed student exam answers and scoring
  const handleSaveHasilUlangan = async (result: any) => {
    if (!connectedSpreadsheet || !token) return;
    try {
      const { saveHasilUlangan } = await import('./lib/googleSheets');
      await saveHasilUlangan(token, connectedSpreadsheet.id, result);
      
      // Update state locally so it's instantly available in Riwayat
      setHasilUlangan(prev => {
        const next = [result, ...prev.filter(r => r.id_hasil !== result.id_hasil)];
        localStorage.setItem('cached_hasil_ulangan', JSON.stringify(next));
        return next;
      });

      // SYNC SCORE TO ACADEMIC GRADES (Nilai Formatif / Sumatif)
      const sched = schedules.find(s => s.id === result.id_jadwal);
      if (sched && sched.nilai_key) {
        const key = sched.nilai_key;
        const isSummative = sched.jenis_ulangan === 'Sumatif';
        const score = result.nilai; // 0 - 100
        
        let gradesChanged = false;
        let nextFormativeGrades = [...formativeGrades];
        let nextSummativeGrades = [...summativeGrades];

        if (isSummative) {
          nextSummativeGrades = nextSummativeGrades.map(sg => {
            if (sg.nis?.toString().trim() === result.nis?.toString().trim()) {
              const previousScore = sg[key] !== null && sg[key] !== undefined && sg[key] !== '' ? Number(sg[key]) : -1;
              const finalScore = score > previousScore ? score : previousScore;

              if (finalScore !== previousScore) {
                gradesChanged = true;
              }

              const updated = {
                ...sg,
                [key]: finalScore
              };
              const activeSummativeCols = summativeCols.length > 0 ? summativeCols : [
                { key: 's1', label: 'Sumatif 1 (S1)' },
                { key: 's2', label: 'Sumatif 2 (S2)' },
                { key: 's3', label: 'Sumatif 3 (S3)' },
                { key: 'uts', label: 'UTS' },
                { key: 'uas', label: 'UAS' }
              ];
              const scores = activeSummativeCols.map(c => updated[c.key]);
              const validScores = scores.filter((s): s is number => s !== null && s !== undefined && s !== '');
              updated.rataRata = validScores.length > 0
                ? parseFloat((validScores.reduce((acc, curr) => acc + Number(curr), 0) / validScores.length).toFixed(1))
                : 0;
              return updated;
            }
            return sg;
          });
        } else {
          nextFormativeGrades = nextFormativeGrades.map(fg => {
            if (fg.nis?.toString().trim() === result.nis?.toString().trim()) {
              const previousScore = fg[key] !== null && fg[key] !== undefined && fg[key] !== '' ? Number(fg[key]) : -1;
              const finalScore = score > previousScore ? score : previousScore;

              if (finalScore !== previousScore) {
                gradesChanged = true;
              }

              const updated = {
                ...fg,
                [key]: finalScore
              };
              const activeFormativeCols = formativeCols.length > 0 ? formativeCols : [
                { key: 'f1', label: 'Formatif 1 (F1)' },
                { key: 'f2', label: 'Formatif 2 (F2)' },
                { key: 'f3', label: 'Formatif 3 (F3)' },
                { key: 'f4', label: 'Formatif 4 (F4)' }
              ];
              const scores = activeFormativeCols.map(c => updated[c.key]);
              const validScores = scores.filter((s): s is number => s !== null && s !== undefined && s !== '');
              updated.rataRata = validScores.length > 0
                ? parseFloat((validScores.reduce((acc, curr) => acc + Number(curr), 0) / validScores.length).toFixed(1))
                : 0;
              return updated;
            }
            return fg;
          });
        }

        if (gradesChanged) {
          setFormativeGrades(nextFormativeGrades);
          setSummativeGrades(nextSummativeGrades);
          localStorage.setItem('cached_formative_grades', JSON.stringify(nextFormativeGrades));
          localStorage.setItem('cached_summative_grades', JSON.stringify(nextSummativeGrades));
          
          await saveGrades(token, connectedSpreadsheet.id, nextFormativeGrades, nextSummativeGrades, students, formativeCols, summativeCols);
          console.log('[handleSaveHasilUlangan] Successfully synced student grade to Academic spreadsheet!');
        }
      }
      
      addToast(`Jawaban berhasil dikirim! Skor Anda: ${result.nilai}%`, 'success');
    } catch (err) {
      console.error('Error saving exam result:', err);
      throw err;
    }
  };

  // Deletes a specific student exam result
  const handleDeleteHasilUlangan = async (idHasil: string) => {
    if (!connectedSpreadsheet || !token) return;
    try {
      const { syncHasilUlangan } = await import('./lib/googleSheets');
      
      const nextHasilUlangan = hasilUlangan.filter(h => h.id_hasil !== idHasil);
      
      // Overwrite/Sync Google Sheet
      await syncHasilUlangan(token, connectedSpreadsheet.id, nextHasilUlangan);
      
      // Update local state & cache
      setHasilUlangan(nextHasilUlangan);
      localStorage.setItem('cached_hasil_ulangan', JSON.stringify(nextHasilUlangan));
      
      addToast('Hasil ulangan berhasil dihapus.', 'success');
    } catch (err: any) {
      console.error('Error deleting exam result:', err);
      addToast(err.message || 'Gagal menghapus hasil ulangan.', 'info');
      throw err;
    }
  };


  // Saves a block of attendance records
  const handleSaveAttendance = async (records: AttendanceRecord[]) => {
    if (!connectedSpreadsheet || !token) return;
    
    const activeClassName = classes.find(c => c.id === selectedClassId)?.name || 'Kelas 8.1';
    const selectedDate = records[0]?.tanggal;
    
    // Filter out records for this specific class on this specific date
    const remainingRecords = attendance.filter(r => !(r.tanggal === selectedDate && r.kelas === activeClassName));
    
    // Attach current class and gender properly to each record
    const recordsWithClass = records.map(r => ({
      ...r,
      kelas: activeClassName,
      jenisKelamin: students.find(s => s.nis === r.nis)?.jenisKelamin || r.jenisKelamin || 'L'
    }));
    
    const updatedFullList = [...remainingRecords, ...recordsWithClass];

    await saveAllAttendance(token, connectedSpreadsheet.id, updatedFullList);
    setAttendance(updatedFullList);
    
    // Refresh to update computed formulas on recap sheet
    await loadActiveSpreadsheetData(connectedSpreadsheet.id, token);
  };

  // Saves both formative and summative grades
  const handleSaveGrades = async (
    formative: GradeFormative[],
    summative: GradeSummative[],
    customFormativeCols?: GradeColumn[],
    customSummativeCols?: GradeColumn[]
  ) => {
    if (!connectedSpreadsheet || !token) return;
    const activeClassName = classes.find(c => c.id === selectedClassId)?.name || 'Kelas 8.1';

    // Keep grades of other classes untouched
    const otherFormative = formativeGrades.filter(f => f.kelas !== activeClassName);
    const otherSummative = summativeGrades.filter(s => s.kelas !== activeClassName);

    const combinedFormative = [...otherFormative, ...formative];
    const combinedSummative = [...otherSummative, ...summative];

    const fCols = customFormativeCols || formativeCols;
    const sCols = customSummativeCols || summativeCols;

    await saveGrades(token, connectedSpreadsheet.id, combinedFormative, combinedSummative, students, fCols, sCols);
    setFormativeGrades(combinedFormative);
    setSummativeGrades(combinedSummative);
    
    // Refresh to load updated averages or formula modifications
    await loadActiveSpreadsheetData(connectedSpreadsheet.id, token);
  };

  // Sync Student Roster and align worksheets
  const handleSyncStudentRoster = async (updatedStudents: Student[], nisChanges?: Record<string, string>) => {
    if (!connectedSpreadsheet || !token) return;
    const activeClassName = classes.find(c => c.id === selectedClassId)?.name || 'Kelas 8.1';

    // Filter out active class students and merge with updated set
    const otherStudents = students.filter(s => s.kelas !== activeClassName);
    const updatedStudentsWithClass = updatedStudents.map(s => ({
      ...s,
      kelas: activeClassName,
      jenisKelamin: s.jenisKelamin || 'L'
    }));

    const combinedStudents = [...otherStudents, ...updatedStudentsWithClass];

    let migratedFormative = [...formativeGrades];
    let migratedSummative = [...summativeGrades];
    let migratedAttendance = [...attendance];

    // Align names, NIS, genders, and classes across all academic and attendance records
    updatedStudentsWithClass.forEach(s => {
      // Find if this student has an old NIS that was migrated
      let oldNis: string | undefined = undefined;
      if (nisChanges) {
        const entry = Object.entries(nisChanges).find(([_, newNis]) => newNis?.toString().trim() === s.nis?.toString().trim());
        if (entry) {
          oldNis = entry[0];
        }
      }

      // Update Formative Grades
      migratedFormative = migratedFormative.map(f => {
        const isMatch = oldNis
          ? f.nis?.toString().trim() === oldNis.trim()
          : f.nis?.toString().trim() === s.nis?.toString().trim();
        if (isMatch) {
          return {
            ...f,
            nis: s.nis,
            nama: s.nama,
            jenisKelamin: s.jenisKelamin,
            kelas: s.kelas
          };
        }
        return f;
      });

      // Update Summative Grades
      migratedSummative = migratedSummative.map(sum => {
        const isMatch = oldNis
          ? sum.nis?.toString().trim() === oldNis.trim()
          : sum.nis?.toString().trim() === s.nis?.toString().trim();
        if (isMatch) {
          return {
            ...sum,
            nis: s.nis,
            nama: s.nama,
            jenisKelamin: s.jenisKelamin,
            kelas: s.kelas
          };
        }
        return sum;
      });

      // Update Attendance Records
      migratedAttendance = migratedAttendance.map(a => {
        const isMatch = oldNis
          ? a.nis?.toString().trim() === oldNis.trim()
          : a.nis?.toString().trim() === s.nis?.toString().trim();
        if (isMatch) {
          return {
            ...a,
            nis: s.nis,
            nama: s.nama,
            jenisKelamin: s.jenisKelamin,
            kelas: s.kelas
          };
        }
        return a;
      });
    });

    // Save migrated attendance to Google Sheets because it is NOT updated by syncStudentRoster
    const { saveAllAttendance } = await import('./lib/googleSheets');
    await saveAllAttendance(token, connectedSpreadsheet.id, migratedAttendance);
    setAttendance(migratedAttendance);

    const { syncStudentRoster } = await import('./lib/googleSheets');
    await syncStudentRoster(token, connectedSpreadsheet.id, combinedStudents, migratedFormative, migratedSummative, formativeCols, summativeCols);
    setStudents(combinedStudents);
    
    // Refresh whole layout structure
    await loadActiveSpreadsheetData(connectedSpreadsheet.id, token);
  };

  // Sync classes to Google Sheets when names are edited or new classes are added
  const handleSyncClasses = async (updatedClasses: { id: number; name: string }[]) => {
    if (!connectedSpreadsheet || !token) return;

    // Find if a class name was actually modified
    const renamedClass = updatedClasses.find(uc => {
      const old = classes.find(o => o.id === uc.id);
      return old && old.name !== uc.name;
    });

    // Find if a new class was added
    const addedClass = updatedClasses.find(uc => !classes.some(o => o.id === uc.id));

    // Find if a class was deleted
    const deletedClass = classes.find(o => !updatedClasses.some(uc => uc.id === o.id));

    let updatedStudents = [...students];
    let shouldSyncStudents = false;

    if (renamedClass) {
      const oldClass = classes.find(o => o.id === renamedClass.id);
      if (oldClass) {
        // Change the class name for all students belonging to the old class
        updatedStudents = students.map(s => 
          s.kelas === oldClass.name ? { ...s, kelas: renamedClass.name } : s
        );
        shouldSyncStudents = true;
      }
    } else if (addedClass) {
      // Create a unique NIS for the placeholder student of the new class
      let baseNisNum = 12000 + addedClass.id * 10 + 1;
      while (students.some(s => s.nis === String(baseNisNum))) {
        baseNisNum++;
      }
      const placeholderStudent: Student = {
        nis: String(baseNisNum),
        nama: 'Siswa Baru',
        jenisKelamin: 'L',
        kelas: addedClass.name
      };
      updatedStudents.push(placeholderStudent);
      shouldSyncStudents = true;
    } else if (deletedClass) {
      // Remove all students belonging to the deleted class
      updatedStudents = students.filter(s => s.kelas !== deletedClass.name);
      shouldSyncStudents = true;
      if (selectedClassId === deletedClass.id) {
        const remaining = updatedClasses[0]?.id || 1;
        setSelectedClassId(remaining);
      }
    }

    const { syncClasses, syncStudentRoster } = await import('./lib/googleSheets');
    
    // Call both to ensure consistency across Siswa and Daftar Kelas
    await syncClasses(token, connectedSpreadsheet.id, updatedClasses);
    
    if (shouldSyncStudents) {
      await syncStudentRoster(token, connectedSpreadsheet.id, updatedStudents, formativeGrades, summativeGrades);
      setStudents(updatedStudents);
    }
    
    setClasses(updatedClasses);
    
    // Refresh to apply updated class names
    await loadActiveSpreadsheetData(connectedSpreadsheet.id, token);
  };

  // Sync user accounts to Google Sheets and state
  const handleSyncAccounts = async (updatedAccounts: any[]) => {
    if (!connectedSpreadsheet || !token) return;
    const { saveLoginAccounts } = await import('./lib/googleSheets');
    await saveLoginAccounts(token, connectedSpreadsheet.id, updatedAccounts);
    setAccounts(updatedAccounts);
    localStorage.setItem('cached_login_accounts', JSON.stringify(updatedAccounts));
    addToast('Perubahan akun login berhasil disimpan ke Google Sheets.', 'success');
  };

  // Triggers binary download export for PDF/Excel via Drive API
  const handleDownloadFile = async (format: 'pdf' | 'xlsx') => {
    if (!connectedSpreadsheet || !token) return;
    await downloadExportFile(token, connectedSpreadsheet.id, format);
  };

  // UNIFIED LOGIN PAGE (Displayed first as main entry point)
  if (needsAuth || !user || !token || !connectedSpreadsheet) {
    return (
      <LoginPage
        onGoogleSignIn={handleLogin}
        onOfflineDemoSignIn={handleConnectOfflineDemo}
        isLoggingIn={isLoggingIn}
        isSyncingData={isLoadingData}
        syncingMessage={syncingStatusMessage}
        errorMsg={errorMsg}
      />
    );
  }

  // MAIN SYSTEM DASHBOARD (Spreadsheet connected and logged in as Admin)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Banner Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Hamburger Menu for Mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 -ml-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition md:hidden cursor-pointer"
            title="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="h-8 w-8 sm:h-9 sm:w-9 bg-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0">
            <FileSpreadsheet className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-slate-800 tracking-tight block text-xs sm:text-base leading-none truncate max-w-[130px] sm:max-w-none">
              Presensi & Akademik Siswa
            </span>
            <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 truncate max-w-[100px] sm:max-w-xs uppercase tracking-wider">
                Aktif: {connectedSpreadsheet ? connectedSpreadsheet.name : 'Belum Terhubung'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Toolbar and Sign Out */}
        <div className="flex items-center gap-1.5 sm:gap-4">
          {/* Role Badge */}
          <div className="flex items-center bg-indigo-50 border border-indigo-100 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl shrink-0">
            <span className="flex items-center gap-1 text-[10px] sm:text-xs font-extrabold text-indigo-700 select-none">
              Admin 🔑
            </span>
          </div>

          {connectedSpreadsheet && (
            <a
              href={connectedSpreadsheet.url}
              target="_blank"
              referrerPolicy="no-referrer"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg font-semibold transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Buka di Sheets
            </a>
          )}

          <button
            onClick={handleRefreshData}
            disabled={isLoadingData || !connectedSpreadsheet}
            className="p-1.5 sm:p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg sm:rounded-xl transition border border-slate-200 cursor-pointer disabled:opacity-50"
            title="Refresh Data dari Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoadingData ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-bold rounded-lg sm:rounded-xl text-[10px] sm:text-xs transition cursor-pointer shrink-0 shadow-xs"
            title="Keluar dari Akun Google"
          >
            <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 z-50 md:hidden backdrop-blur-xs"
            />
            
            {/* Drawer Content */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-50 md:hidden flex flex-col border-r border-slate-200"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
                    <FileSpreadsheet className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-extrabold text-slate-800 tracking-tight text-xs uppercase tracking-wider">
                    Navigasi Menu
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
                <button
                  onClick={() => {
                    setActiveTab('recap');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'recap'
                      ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <PieChart className={`w-4 h-4 ${activeTab === 'recap' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    <span>Rekap &amp; Analisis</span>
                  </div>
                  {activeTab === 'recap' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('attendance');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'attendance'
                      ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className={`w-4 h-4 ${activeTab === 'attendance' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    <span>Absensi Harian</span>
                  </div>
                  {activeTab === 'attendance' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('notes');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'notes'
                      ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ClipboardList className={`w-4 h-4 ${activeTab === 'notes' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    <span>Catatan Siswa</span>
                  </div>
                  {activeTab === 'notes' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('grades');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'grades'
                      ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <GraduationCap className={`w-4 h-4 ${activeTab === 'grades' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    <span>Nilai Akademik</span>
                  </div>
                  {activeTab === 'grades' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </button>

                {role === 'admin' && (
                  <button
                    onClick={() => {
                      setActiveTab('extra_tik');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                      activeTab === 'extra_tik'
                        ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                        : 'bg-white hover:bg-indigo-50/50 hover:text-indigo-600 hover:translate-x-1 text-slate-600 border border-slate-200/60 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <BookOpen className={`w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${activeTab === 'extra_tik' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                      <span>Extra TIK</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all duration-200 ${
                        activeTab === 'extra_tik'
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                      }`}>
                        {extraTikDaysCount} Hari
                      </span>
                      {activeTab === 'extra_tik' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                    </div>
                  </button>
                )}

                {/* Section Separator */}
                <div className="pt-4 pb-1">
                  <div className="border-t border-slate-200/60 my-1.5" />
                  <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase px-1 block select-none">
                    Kelola &amp; Administrasi
                  </span>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('students');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    activeTab === 'students'
                      ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className={`w-4 h-4 ${activeTab === 'students' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    <span>Kelola Roster Siswa</span>
                  </div>
                  {activeTab === 'students' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </button>

                {role === 'admin' && (
                  <button
                    onClick={() => {
                      setActiveTab('professional_report');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'professional_report'
                        ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className={`w-4 h-4 ${activeTab === 'professional_report' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                      <span>Laporan Profesional</span>
                    </div>
                    {activeTab === 'professional_report' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                  </button>
                )}

                {role === 'admin' && (
                  <button
                    onClick={() => {
                      setActiveTab('database');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      activeTab === 'database'
                        ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Database className={`w-4 h-4 ${activeTab === 'database' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                      <span>{isPermanentConnection ? 'Status Database' : 'Koneksi Spreadsheet'}</span>
                    </div>
                    {activeTab === 'database' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                  </button>
                )}
              </nav>

              {connectedSpreadsheet && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-700 block">Koneksi Aktif</span>
                  <p>Database ini disinkronkan secara aman. Seluruh data rekapitulasi dikalkulasi menggunakan fungsi bawaan Google Sheets.</p>
                  <a
                    href={connectedSpreadsheet.url}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="text-indigo-600 font-bold hover:underline flex items-center gap-1.5 mt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Spreadsheet
                  </a>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-grow flex flex-col md:flex-row w-full px-4 sm:px-6 md:px-8 py-6 gap-6">
        
        {/* Sidebar Navigation (Desktop only) */}
        <aside className="hidden md:block w-full md:w-64 shrink-0">
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('recap')}
              className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                activeTab === 'recap'
                  ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100'
                  : 'bg-white hover:bg-indigo-50/40 hover:text-indigo-600 text-slate-600 border border-slate-200/60 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PieChart className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'recap' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                <span>Rekap &amp; Analisis</span>
              </div>
              {activeTab === 'recap' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                activeTab === 'attendance'
                  ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100'
                  : 'bg-white hover:bg-indigo-50/40 hover:text-indigo-600 text-slate-600 border border-slate-200/60 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarDays className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'attendance' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                <span>Absensi Harian</span>
              </div>
              {activeTab === 'attendance' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100'
                  : 'bg-white hover:bg-indigo-50/40 hover:text-indigo-600 text-slate-600 border border-slate-200/60 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'notes' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                <span>Catatan Siswa</span>
              </div>
              {activeTab === 'notes' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </button>

            <button
              onClick={() => setActiveTab('grades')}
              className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                activeTab === 'grades'
                  ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100'
                  : 'bg-white hover:bg-indigo-50/40 hover:text-indigo-600 text-slate-600 border border-slate-200/60 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <GraduationCap className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'grades' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                <span>Nilai Akademik</span>
              </div>
              {activeTab === 'grades' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </button>

            {role === 'admin' && (
              <button
                onClick={() => setActiveTab('extra_tik')}
                className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'extra_tik'
                    ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100'
                    : 'bg-white hover:bg-indigo-50/50 hover:text-indigo-600 hover:translate-x-1 text-slate-600 border border-slate-200/60 shadow-xs'
                }`}
                id="sidebar-extra-tik"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className={`w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${activeTab === 'extra_tik' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                  <span>Extra TIK</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all duration-200 ${
                    activeTab === 'extra_tik'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                  }`}>
                    {extraTikDaysCount} Hari
                  </span>
                  {activeTab === 'extra_tik' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                </div>
              </button>
            )}

            {/* Section Separator */}
            <div className="pt-4 pb-1">
              <div className="border-t border-slate-200/60 my-1.5" />
              <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase px-4 block select-none">
                Kelola &amp; Administrasi
              </span>
            </div>

            <button
              onClick={() => setActiveTab('students')}
              className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100'
                  : 'bg-white hover:bg-indigo-50/40 hover:text-indigo-600 text-slate-600 border border-slate-200/60 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'students' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                <span>Kelola Roster Siswa</span>
              </div>
              {activeTab === 'students' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </button>

            {role === 'admin' && (
              <button
                onClick={() => setActiveTab('professional_report')}
                className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                  activeTab === 'professional_report'
                    ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100'
                    : 'bg-white hover:bg-indigo-50/40 hover:text-indigo-600 text-slate-600 border border-slate-200/60 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'professional_report' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                  <span>Laporan Profesional</span>
                </div>
                {activeTab === 'professional_report' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            )}

            {role === 'admin' && (
              <button
                onClick={() => setActiveTab('database')}
                className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer ${
                  activeTab === 'database'
                    ? 'bg-linear-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100'
                    : 'bg-white hover:bg-indigo-50/40 hover:text-indigo-600 text-slate-600 border border-slate-200/60 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Database className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${activeTab === 'database' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                  <span>{isPermanentConnection ? 'Status Database' : 'Koneksi Spreadsheet'}</span>
                </div>
                {activeTab === 'database' && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            )}
          </nav>

          {connectedSpreadsheet && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mt-6 space-y-2 text-xs text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700 block">Koneksi Aktif</span>
              <p>Database ini disinkronkan secara aman. Seluruh data rekapitulasi dikalkulasi menggunakan fungsi bawaan Google Sheets.</p>
              <a
                href={connectedSpreadsheet.url}
                target="_blank"
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
                className="text-indigo-600 font-bold hover:underline flex items-center gap-1.5 mt-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Buka Spreadsheet
              </a>
            </div>
          )}
        </aside>

        {/* Dynamic Content Panel */}
        <main className="flex-grow min-w-0 space-y-4">
          {activeTab === 'database' ? (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-8 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600" />
                  Pengaturan Koneksi Database Google Spreadsheet
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  Hubungkan spreadsheet Anda yang terintegrasi langsung dengan data murid, sistem absensi otomatis, nilai kelas, dan presensi Extra TIK.
                </p>
              </div>

              {connectedSpreadsheet ? (
                /* CONNECTED STATE (MANUAL CONNECTION) */
                <div className="space-y-6">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6 animate-in fade-in duration-200">
                    <div className="flex items-start gap-4">
                      <div className="p-3.5 bg-emerald-500 text-white rounded-2xl shrink-0">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-emerald-900">Koneksi Database Aktif (Google Sheets)</h4>
                        <p className="text-emerald-700 text-xs">
                          Aplikasi Anda saat ini disinkronkan secara aman dan langsung menggunakan API Google Sheets.
                        </p>
                        <div className="pt-2 space-y-1">
                          <p className="text-emerald-800 text-xs font-semibold flex items-center gap-1">
                            <span className="text-slate-400 font-normal">Spreadsheet:</span> {connectedSpreadsheet.name}
                          </p>
                          <p className="text-emerald-700 text-[11px] font-mono select-all">
                            ID: {connectedSpreadsheet.id}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                      <a
                        href={connectedSpreadsheet.url}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <ExternalLink className="w-4 h-4" /> Buka Spreadsheet
                      </a>
                      <button
                        onClick={handleDisconnectAppsScript}
                        className="px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                      >
                        Putuskan Hubungan
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
                    <h3 className="text-sm font-black text-slate-800">💡 Sinkronisasi Langsung Berhasil!</h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Sistem Anda sekarang terhubung secara mandiri langsung ke Google Drive & Sheets Anda. Seluruh penulisan absensi siswa, nilai akademik, rekapitulasi, dan presensi Extra TIK akan diposting secara real-time.
                    </p>
                  </div>
                </div>
              ) : (
                /* DISCONNECTED / CONFIGURATION STATE */
                <div className="space-y-8 animate-in fade-in duration-200">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <Link className="w-4 h-4 text-indigo-600" />
                        Lakukan Koneksi Database Baru
                      </h3>
                      <p className="text-slate-500 text-xs">
                        Tempel URL atau ID Google Spreadsheet Anda untuk mulai menghubungkan sistem.
                      </p>
                    </div>

                    <form onSubmit={handleConnectCustomUrl} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          URL atau ID Google Spreadsheet Anda
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                            value={urlOrIdInput}
                            onChange={e => setUrlOrIdInput(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                          />
                          <FileSpreadsheet className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isConnectingCustom}
                        className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        {isConnectingCustom ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sedang Menghubungkan & Menyiapkan Sheets...
                          </>
                        ) : (
                          <>
                            <Database className="w-4 h-4" />
                            Uji & Hubungkan Database
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Simple list of spreadsheets in user's Drive for one-click connection */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 pt-6">
                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-indigo-600" />
                          Pilih Spreadsheet dari Google Drive Anda
                        </h3>
                        <p className="text-slate-500 text-xs">
                          Berikut adalah daftar spreadsheet terbaru di Drive Anda. Klik salah satu untuk langsung terhubung.
                        </p>
                      </div>
                      <div className="relative max-w-xs w-full">
                        <input
                          type="text"
                          placeholder="Cari file..."
                          value={spreadsheetSearchQuery}
                          onChange={e => {
                            setSpreadsheetSearchQuery(e.target.value);
                            loadSpreadsheetsList(token!, e.target.value);
                          }}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      </div>
                    </div>

                    {isLoadingSpreadsheets ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      </div>
                    ) : spreadsheets.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                        {spreadsheets.map(sheet => (
                          <div
                            key={sheet.id}
                            onClick={() => handleConnectSpreadsheet(sheet)}
                            className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 cursor-pointer transition flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <FileSpreadsheet className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700">
                                  {sheet.name}
                                </p>
                                <p className="text-[9px] font-mono text-slate-400 truncate">
                                  ID: {sheet.id}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-slate-400">
                        Tidak ada spreadsheet ditemukan di Drive Anda. Silakan buat yang baru di bawah ini.
                      </div>
                    )}
                  </div>

                  {/* Form to create a new spreadsheet */}
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-indigo-600" />
                        Buat Spreadsheet Baru Otomatis
                      </h3>
                      <p className="text-slate-500 text-xs">
                        Kami akan membuat file Google Spreadsheet baru di Drive Anda yang langsung terformat dengan database absensi, akademik, dan rekapitulasi.
                      </p>
                    </div>

                    <form onSubmit={handleCreateNewSpreadsheet} className="flex gap-3 max-w-md">
                      <input
                        type="text"
                        required
                        placeholder="Nama Spreadsheet Baru..."
                        value={newSheetTitle}
                        onChange={e => setNewSheetTitle(e.target.value)}
                        className="flex-grow px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                      <button
                        type="submit"
                        disabled={isCreatingSheet}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shrink-0 cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        {isCreatingSheet ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Membuat...
                          </>
                        ) : (
                          'Buat & Hubungkan'
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ) : isLoadingData ? (
            <div className="bg-white rounded-3xl p-16 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center gap-4 h-[400px]">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
              <div className="space-y-1">
                <p className="font-bold text-slate-800">Menghubungkan ke Google Sheets...</p>
                <p className="text-xs text-slate-400">Sinkronisasi formula rekapitulasi dan memuat daftar siswa.</p>
              </div>
            </div>
          ) : errorMsg ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center gap-4 h-[350px]">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div className="space-y-1 max-w-sm">
                <p className="font-bold text-slate-800">Gagal Memuat Data</p>
                <p className="text-xs text-slate-400">{errorMsg}</p>
              </div>
              <button
                onClick={handleRefreshData}
                className="bg-indigo-600 text-white font-semibold text-xs px-4 py-2 rounded-xl"
              >
                Coba Lagi
              </button>
            </div>
          ) : (() => {
            const activeClassName = classes.find(c => c.id === selectedClassId)?.name || 'Kelas 8.1';
            const filteredStudents = students.filter(s => s.kelas === activeClassName);
            const filteredAttendance = attendance.filter(r => r.kelas === activeClassName);
            const filteredFormativeGrades = formativeGrades.filter(f => f.kelas === activeClassName);
            const filteredSummativeGrades = summativeGrades.filter(s => s.kelas === activeClassName);
            const activeRecap = calculatedRecap.length > 0 ? calculatedRecap : recap;
            const filteredRecap = activeRecap.filter(r => r.kelas === activeClassName);
            const filteredNotes = notes.filter(n => n.kelas === activeClassName);

            // Intercept if spreadsheet is not connected yet and trying to use features
            if (!connectedSpreadsheet) {
              return (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs text-center space-y-6 max-w-lg mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
                  <div className="mx-auto h-16 w-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-800">Database Belum Terhubung</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Sistem membutuhkan sambungan ke Google Spreadsheet Anda untuk memuat daftar murid, merekap data absensi, mencatat nilai formatif/sumatif, dan mengelola akun login.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('database')}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-2xl text-sm transition cursor-pointer shadow-sm"
                  >
                    <Database className="w-4 h-4" />
                    Buka Pengaturan Koneksi
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {/* Class Selector Header Bar */}
                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kelas Terpilih:</span>
                    <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-2xl border border-indigo-100">
                      {activeClassName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500">Pilih Kelas Lain:</label>
                    <select
                      value={selectedClassId}
                      onChange={e => setSelectedClassId(Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeTab}-${selectedClassId}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {activeTab === 'attendance' && (
                      <AttendanceTab
                        students={filteredStudents}
                        attendance={filteredAttendance}
                        onSave={handleSaveAttendance}
                      />
                    )}

                    {activeTab === 'grades' && (
                      <GradesTab
                        students={filteredStudents}
                        formativeGrades={filteredFormativeGrades}
                        summativeGrades={filteredSummativeGrades}
                        onSave={handleSaveGrades}
                        formativeCols={formativeCols}
                        setFormativeCols={setFormativeCols}
                        summativeCols={summativeCols}
                        setSummativeCols={setSummativeCols}
                      />
                    )}

                    {activeTab === 'notes' && (
                      <StudentNotesTab
                        students={filteredStudents}
                        notes={filteredNotes}
                        onAddNote={handleAddNote}
                        onDeleteNote={handleDeleteNote}
                        onUpdateNote={handleUpdateNote}
                      />
                    )}

                    {activeTab === 'recap' && (
                      <RecapTab
                        students={filteredStudents}
                        formativeGrades={filteredFormativeGrades}
                        summativeGrades={filteredSummativeGrades}
                        recap={filteredRecap}
                        formativeCols={formativeCols}
                        summativeCols={summativeCols}
                        notes={filteredNotes}
                      />
                    )}

                    {activeTab === 'students' && (
                      <StudentsTab
                        students={filteredStudents}
                        allStudents={students}
                        onSyncRoster={handleSyncStudentRoster}
                        role={role}
                        classes={classes}
                        selectedClassId={selectedClassId}
                        onSelectClassId={setSelectedClassId}
                        onSyncClasses={handleSyncClasses}
                        accessToken={token}
                      />
                    )}

                    {activeTab === 'extra_tik' && (
                      <ExtraTIKTab
                        students={students}
                        extraTikPeserta={extraTikPeserta}
                        extraTikAbsensi={extraTikAbsensi}
                        extraTikNilai={extraTikNilai}
                        onSyncPeserta={handleSyncExtraTikPeserta}
                        onSyncAbsensi={handleSyncExtraTikAbsensi}
                        onSyncNilai={handleSyncExtraTikNilai}
                        onBackToDashboard={() => setActiveTab('attendance')}
                        classes={classes}
                        selectedClassId={selectedClassId}
                      />
                    )}

                    {activeTab === 'professional_report' && (
                      <ProfessionalReportTab
                        students={filteredStudents}
                        formativeGrades={filteredFormativeGrades}
                        summativeGrades={filteredSummativeGrades}
                        recap={filteredRecap}
                        formativeCols={formativeCols}
                        summativeCols={summativeCols}
                        notes={filteredNotes}
                        activeClassName={activeClassName}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            );
          })()}
        </main>
      </div>

      {/* Incompatible Spreadsheet Repair Modal */}
      {showIncompatibleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-950">
                  Format Spreadsheet Belum Sesuai
                </h3>
                <p className="text-xs text-slate-500 font-mono truncate max-w-[280px]">
                  "{incompatibleSheetTitle}"
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
              <p>
                File spreadsheet yang Anda pilih tidak memiliki struktur lembar (sheets) yang dibutuhkan oleh sistem untuk melakukan sinkronisasi data.
              </p>
              <div className="space-y-1">
                <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider">
                  Lembar data yang akan dibuat:
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {missingSheetsToInit.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[10px] font-bold"
                    >
                      + {s}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic pt-1">
                Catatan: Lembar data yang ada tidak akan dihapus, kami hanya akan menambahkan lembar data di atas yang belum ada beserta formula standarnya.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowIncompatibleModal(false);
                  setIncompatibleSheetId(null);
                  setIncompatibleSheetTitle(null);
                  setMissingSheetsToInit([]);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRepairSpreadsheet}
                disabled={isCreatingSheet}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {isCreatingSheet ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menyiapkan Database...
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    Konfigurasi & Hubungkan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Toasts Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-lg transition-all duration-300 flex items-start gap-3 bg-white ${
              t.type === 'success' 
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900' 
                : 'border-indigo-200 bg-indigo-50 text-indigo-900'
            }`}
          >
            <div className={`p-1.5 rounded-xl shrink-0 ${t.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-black">{t.type === 'success' ? 'Ujian Selesai!' : 'Informasi'}</p>
              <p className="text-[11px] font-semibold leading-relaxed text-slate-700">{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
