import { Student, AttendanceRecord, GradeFormative, GradeSummative, MonthlyRecap, SpreadsheetInfo, GradeColumn, Question, StudentSubmission, ExercisePackage, ActiveAssessment, RetakePermission, BankSoalQuestion, JadwalUjian, ExtraTikPeserta, ExtraTikAbsensi, ExtraTikNilai } from '../types';

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

const DEFAULT_FORMATIVE_COLS: GradeColumn[] = [
  { key: 'rataRata', label: 'Rata-Rata' },
  { key: 'f1', label: 'F1: Teks Deskripsi' },
  { key: 'f2', label: 'F2: Teks Eksposisi' },
  { key: 'f3', label: 'F3: Teks Laporan' },
  { key: 'f4', label: 'F4: Puisi Rakyat' },
];

const DEFAULT_SUMMATIVE_COLS: GradeColumn[] = [
  { key: 'rataRata', label: 'Rata-Rata' },
  { key: 's1', label: 'S1: Bab 1' },
  { key: 's2', label: 'S2: Bab 2' },
  { key: 'uts', label: 'UTS (Tengah Semester)' },
  { key: 'uas', label: 'UAS (Akhir Semester)' },
];

const DEFAULT_BANK_SOAL: BankSoalQuestion[] = [
  {
    id_soal: 'Q001',
    mata_pelajaran: 'Bahasa Indonesia',
    materi: 'Teks Deskripsi',
    kelas: 'Kelas 8.1, Kelas 8.2',
    jenis_soal: 'Pilihan Ganda',
    tingkat_kesulitan: 'Mudah',
    pertanyaan: 'Manakah yang merupakan definisi teks deskripsi?',
    opsi_a: 'Teks yang memaparkan data statistik',
    opsi_b: 'Teks yang menggambarkan suatu objek secara rinci sehingga pembaca seolah melihat atau merasakan sendiri',
    opsi_c: 'Teks yang memuat argumen pro dan kontra',
    opsi_d: 'Teks yang berisi langkah-langkah membuat sesuatu',
    jawaban: 'B',
    pembahasan: 'Teks deskripsi bertujuan untuk menggambarkan objek secara detail agar pembaca mendapatkan impresi visual/indrawi.',
    bobot: 10,
    tanggal_dibuat: '2026-07-01',
    tanggal_update: '2026-07-01',
    dibuat_oleh: 'Administrator',
    status: 'Aktif'
  },
  {
    id_soal: 'Q002',
    mata_pelajaran: 'Bahasa Indonesia',
    materi: 'Teks Eksposisi',
    kelas: 'Kelas 8.1',
    jenis_soal: 'Pilihan Ganda',
    tingkat_kesulitan: 'Sedang',
    pertanyaan: 'Struktur teks eksposisi yang berisi sudut pandang penulis terhadap topik yang dibahas disebut...',
    opsi_a: 'Rekomendasi',
    opsi_b: 'Tesis (Pernyataan Pendapat)',
    opsi_c: 'Argumentasi',
    opsi_d: 'Penegasan Ulang',
    jawaban: 'B',
    pembahasan: 'Tesis adalah bagian pembuka teks eksposisi yang memuat sudut pandang atau opini utama penulis.',
    bobot: 10,
    tanggal_dibuat: '2026-07-01',
    tanggal_update: '2026-07-01',
    dibuat_oleh: 'Administrator',
    status: 'Aktif'
  }
];

const DEFAULT_SCHEDULES: JadwalUjian[] = [
  {
    id: 'SCH-001',
    nama_ulangan: 'Ulangan Harian 1: Deskripsi',
    jenis_ulangan: 'Formatif',
    mata_pelajaran: 'Bahasa Indonesia',
    materi: 'Teks Deskripsi',
    jumlah_soal: 1,
    target_kelas: 'Semua Kelas',
    tanggal: new Date().toISOString().substring(0, 10),
    jam_mulai: '07:00',
    jam_selesai: '14:00',
    durasi: 60,
    token: 'DESK8',
    status: 'Aktif',
    soal_ids: ['Q001'],
    nilai_key: 'f1'
  }
];

const DEFAULT_ACCOUNTS = [
  {
    id_user: 'usr-admin',
    username: 'admin',
    password: 'admin',
    role: 'Admin',
    nis: '',
    status: 'Aktif',
    tanggal_dibuat: '2026-07-01',
    terakhir_login: ''
  },
  {
    id_user: 'usr-12001',
    username: '12001',
    password: '12001_password',
    role: 'Siswa',
    nis: '12001',
    status: 'Aktif',
    tanggal_dibuat: '2026-07-01',
    terakhir_login: ''
  }
];

// Helper to load/save from localStorage
function getLocal<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(`mock_sheet_${key}`);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T): void {
  localStorage.setItem(`mock_sheet_${key}`, JSON.stringify(value));
}

// Exported Mocks
export async function listSpreadsheets(accessToken: string, searchQuery?: string): Promise<SpreadsheetInfo[]> {
  return [
    {
      id: 'mock-offline-spreadsheet',
      name: 'Database Demo (Offline Mode)',
      url: '#'
    }
  ];
}

export async function checkAndPrepareSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{ incompatible: boolean; missingSheets: string[] }> {
  return { incompatible: false, missingSheets: [] };
}

export async function setupMissingSheets(
  accessToken: string,
  spreadsheetId: string,
  missingSheets: string[]
): Promise<void> {
  return;
}

export async function createSpreadsheet(
  accessToken: string,
  title: string
): Promise<SpreadsheetInfo> {
  return {
    id: 'mock-offline-spreadsheet',
    name: title || 'Database Demo (Offline Mode)',
    url: '#'
  };
}

export async function getSpreadsheetData(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  students: Student[];
  attendance: AttendanceRecord[];
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  formativeCols: GradeColumn[];
  summativeCols: GradeColumn[];
  recap: MonthlyRecap[];
  classes: { id: number; name: string }[];
  bankSoalQuestions: BankSoalQuestion[];
  schedules: JadwalUjian[];
  accounts: any[];
  hasilUlangan: any[];
  extraTikPeserta: ExtraTikPeserta[];
  extraTikAbsensi: ExtraTikAbsensi[];
  extraTikNilai: ExtraTikNilai[];
}> {
  const students = getLocal<Student[]>('students', DEFAULT_SAMPLE_STUDENTS);
  const attendance = getLocal<AttendanceRecord[]>('attendance', []);
  const classes = getLocal<{ id: number; name: string }[]>('classes', DEFAULT_CLASSES);
  const formativeCols = getLocal<GradeColumn[]>('formativeCols', DEFAULT_FORMATIVE_COLS);
  const summativeCols = getLocal<GradeColumn[]>('summativeCols', DEFAULT_SUMMATIVE_COLS);
  const bankSoalQuestions: any[] = [];
  const schedules: any[] = [];
  const accounts: any[] = [];
  const hasilUlangan: any[] = [];
  const extraTikPeserta = getLocal<ExtraTikPeserta[]>('extraTikPeserta', []);
  const extraTikAbsensi = getLocal<ExtraTikAbsensi[]>('extraTikAbsensi', []);
  const extraTikNilai = getLocal<ExtraTikNilai[]>('extraTikNilai', []);

  // Initialize grades for all students if empty
  const formativeGrades = getLocal<GradeFormative[]>('formativeGrades', students.map(s => {
    const row: any = { nis: s.nis, nama: s.nama, kelas: s.kelas, jenisKelamin: s.jenisKelamin, rataRata: null };
    formativeCols.forEach(col => {
      if (col.key !== 'rataRata') row[col.key] = null;
    });
    return row;
  }));

  const summativeGrades = getLocal<GradeSummative[]>('summativeGrades', students.map(s => {
    const row: any = { nis: s.nis, nama: s.nama, kelas: s.kelas, jenisKelamin: s.jenisKelamin, rataRata: null };
    summativeCols.forEach(col => {
      if (col.key !== 'rataRata') row[col.key] = null;
    });
    return row;
  }));

  // Simple monthly recap mockup
  const recap = students.map(s => {
    const sAtt = attendance.filter(a => a.nis === s.nis);
    const hadir = sAtt.filter(a => a.status === 'Hadir').length;
    const sakit = sAtt.filter(a => a.status === 'Sakit').length;
    const izin = sAtt.filter(a => a.status === 'Izin').length;
    const alfa = sAtt.filter(a => a.status === 'Alfa').length;
    const terlambatCount = sAtt.filter(a => a.terlambat > 0).length;
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
      persentaseKehadiran
    };
  });

  return {
    students,
    attendance,
    formativeGrades,
    summativeGrades,
    formativeCols,
    summativeCols,
    recap,
    classes,
    bankSoalQuestions,
    schedules,
    accounts,
    hasilUlangan,
    extraTikPeserta,
    extraTikAbsensi,
    extraTikNilai
  };
}

export async function syncStudentRoster(
  accessToken: string,
  spreadsheetId: string,
  students: Student[],
  formativeGrades?: GradeFormative[],
  summativeGrades?: GradeSummative[]
): Promise<void> {
  setLocal<Student[]>('students', students);
  if (formativeGrades) setLocal<GradeFormative[]>('formativeGrades', formativeGrades);
  if (summativeGrades) setLocal<GradeSummative[]>('summativeGrades', summativeGrades);
}

export async function saveAllAttendance(
  accessToken: string,
  spreadsheetId: string,
  records: AttendanceRecord[]
): Promise<void> {
  setLocal<AttendanceRecord[]>('attendance', records);
}

export async function saveGrades(
  accessToken: string,
  spreadsheetId: string,
  type: 'Formatif' | 'Sumatif',
  grades: any[],
  columns: GradeColumn[]
): Promise<void> {
  if (type === 'Formatif') {
    setLocal<any[]>('formativeGrades', grades);
    setLocal<GradeColumn[]>('formativeCols', columns);
  } else {
    setLocal<any[]>('summativeGrades', grades);
    setLocal<GradeColumn[]>('summativeCols', columns);
  }
}

export async function syncClasses(
  accessToken: string,
  spreadsheetId: string,
  classes: { id: number; name: string }[]
): Promise<void> {
  setLocal<{ id: number; name: string }[]>('classes', classes);
}

export async function downloadExportFile(
  accessToken: string,
  spreadsheetId: string,
  format: 'pdf' | 'xlsx'
): Promise<void> {
  alert(`Mode Demo Offline: Unduhan file format ${format.toUpperCase()} sedang disimulasikan. Silakan hubungkan ke akun Google asli Anda di tab baru untuk memproses dokumen resmi.`);
}

export async function uploadStudentPhotoToDrive(
  accessToken: string,
  fileName: string,
  base64Data: string
): Promise<string> {
  return base64Data; // Just return base64 for local preview
}

export async function ensureSheetExists(
  accessToken: string,
  spreadsheetId: string,
  title: string,
  headers: string[]
): Promise<void> {
  return;
}

export async function getCbtData(
  accessToken: string,
  spreadsheetId: string
): Promise<{ packages: ExercisePackage[]; assessments: ActiveAssessment[]; submissions: StudentSubmission[]; retakePermissions: RetakePermission[] }> {
  const packages = getLocal<ExercisePackage[]>('packages', []);
  const assessments = getLocal<ActiveAssessment[]>('assessments', []);
  const submissions = getLocal<StudentSubmission[]>('submissions', []);
  const retakePermissions = getLocal<RetakePermission[]>('retakePermissions', []);
  return { packages, assessments, submissions, retakePermissions };
}

export async function syncPackagesToSheets(
  accessToken: string,
  spreadsheetId: string,
  packages: ExercisePackage[]
): Promise<void> {
  setLocal<ExercisePackage[]>('packages', packages);
}

export async function syncAssessmentsToSheets(
  accessToken: string,
  spreadsheetId: string,
  assessments: ActiveAssessment[]
): Promise<void> {
  setLocal<ActiveAssessment[]>('assessments', assessments);
}

export async function saveStudentSubmissionToSheets(
  accessToken: string,
  spreadsheetId: string,
  submission: StudentSubmission
): Promise<void> {
  const list = getLocal<StudentSubmission[]>('submissions', []);
  list.push(submission);
  setLocal<StudentSubmission[]>('submissions', list);
}

export async function getQuestionsAndSubmissions(
  accessToken: string,
  spreadsheetId: string
): Promise<{ questions: Question[]; submissions: StudentSubmission[] }> {
  const { packages, submissions } = await getCbtData(accessToken, spreadsheetId);
  const questions: Question[] = [];
  packages.forEach(p => {
    p.soalList.forEach(q => {
      questions.push(q);
    });
  });
  return { questions, submissions };
}

export async function syncQuestions(
  accessToken: string,
  spreadsheetId: string,
  questions: Question[]
): Promise<void> {
  const mockPackage: ExercisePackage = {
    id: 'P001',
    nama: 'Paket Latihan Utama',
    kategori: 'Formatif',
    soalList: questions.map(q => ({ ...q, idPaket: 'P001' }))
  };
  await syncPackagesToSheets(accessToken, spreadsheetId, [mockPackage]);
}

export async function saveStudentSubmission(
  accessToken: string,
  spreadsheetId: string,
  sub: any
): Promise<void> {
  const mappedSub: StudentSubmission = {
    id: sub.id,
    nis: sub.nis,
    nama: sub.nama,
    kelas: sub.kelas,
    idPaket: sub.idSoal || 'P001',
    namaPaket: 'Latihan Soal',
    kategoriPaket: 'Formatif',
    nilaiTotal: sub.status === 'Benar' ? 10 : 0,
    nilaiMaksimal: 10,
    persentase: sub.status === 'Benar' ? 100 : 0,
    detailJawaban: JSON.stringify({ [sub.idSoal]: sub.jawaban }),
    tanggal: sub.tanggal,
  };
  await saveStudentSubmissionToSheets(accessToken, spreadsheetId, mappedSub);
}

export async function syncRetakePermissionsToSheets(
  accessToken: string,
  spreadsheetId: string,
  permissions: RetakePermission[]
): Promise<void> {
  setLocal<RetakePermission[]>('retakePermissions', permissions);
}

export async function getSpreadsheetSheetTitles(accessToken: string, spreadsheetId: string): Promise<string[]> {
  return ['Siswa', 'Absensi', 'Nilai Formatif', 'Nilai Sumatif', 'Rekap Bulanan', 'Daftar Kelas'];
}

export async function deleteUnusedSheets(accessToken: string, spreadsheetId: string): Promise<string[]> {
  return [];
}

export async function getBankSoalQuestions(accessToken: string, spreadsheetId: string): Promise<BankSoalQuestion[]> {
  return [];
}

export async function syncBankSoalSubject(
  accessToken: string,
  spreadsheetId: string,
  questions: BankSoalQuestion[],
  subject?: string
): Promise<void> {
  return;
}

export async function getJadwalUjian(accessToken: string, spreadsheetId: string): Promise<JadwalUjian[]> {
  return [];
}

export async function syncJadwalUjian(
  accessToken: string,
  spreadsheetId: string,
  schedules: JadwalUjian[]
): Promise<void> {
  return;
}

export async function ensureLoginSheetExistsAndPopulated(
  accessToken: string,
  spreadsheetId: string,
  enrichedStudents: Student[]
): Promise<void> {
  return;
}

export async function getLoginAccounts(accessToken: string, spreadsheetId: string): Promise<any[]> {
  return [];
}

export async function saveLoginAccounts(
  accessToken: string,
  spreadsheetId: string,
  accounts: any[]
): Promise<void> {
  setLocal<any[]>('accounts', accounts);
}

export async function updateTerakhirLogin(
  accessToken: string,
  spreadsheetId: string,
  username: string
): Promise<void> {
  const list = await getLoginAccounts(accessToken, spreadsheetId);
  const updated = list.map(acc => {
    if (acc.username === username) {
      return { ...acc, terakhir_login: new Date().toISOString() };
    }
    return acc;
  });
  setLocal<any[]>('accounts', updated);
}

export async function ensureHasilUlanganSheetExists(
  accessToken: string,
  spreadsheetId: string
): Promise<void> {
  return;
}

export async function saveHasilUlangan(
  accessToken: string,
  spreadsheetId: string,
  record: any
): Promise<void> {
  const list = getLocal<any[]>('hasilUlangan', []);
  list.push(record);
  setLocal<any[]>('hasilUlangan', list);
}

export async function getHasilUlangan(accessToken: string, spreadsheetId: string): Promise<any[]> {
  return getLocal<any[]>('hasilUlangan', []);
}

export async function syncHasilUlangan(
  accessToken: string,
  spreadsheetId: string,
  records: any[]
): Promise<void> {
  setLocal<any[]>('hasilUlangan', records);
}

export async function syncExtraTikPeserta(
  accessToken: string,
  spreadsheetId: string,
  peserta: ExtraTikPeserta[]
): Promise<void> {
  setLocal<ExtraTikPeserta[]>('extraTikPeserta', peserta);
}

export async function syncExtraTikAbsensi(
  accessToken: string,
  spreadsheetId: string,
  absensi: ExtraTikAbsensi[]
): Promise<void> {
  setLocal<ExtraTikAbsensi[]>('extraTikAbsensi', absensi);
}

export async function syncExtraTikNilai(
  accessToken: string,
  spreadsheetId: string,
  nilai: ExtraTikNilai[]
): Promise<void> {
  setLocal<ExtraTikNilai[]>('extraTikNilai', nilai);
}

