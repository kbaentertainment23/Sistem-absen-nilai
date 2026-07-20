export interface Student {
  noAbsen?: string;
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  foto?: string; // Base64 encoded compressed photo
}

export interface AttendanceRecord {
  tanggal: string; // YYYY-MM-DD
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  status: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa';
  terlambat: number; // minutes
  keterangan: string;
}

export interface GradeColumn {
  key: string;
  label: string;
}

export interface GradeFormative {
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  rataRata: number | null;
  [key: string]: any; // supports f1, f2, f3, f4, etc. dynamically
}

export interface GradeSummative {
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  rataRata: number | null;
  [key: string]: any; // supports s1, s2, s3, uts, uas, etc. dynamically
}

export interface MonthlyRecap {
  nis: string;
  nama: string;
  jenisKelamin?: 'L' | 'P';
  kelas?: string;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  terlambatCount: number;
  persentaseKehadiran: number;
}

export interface SpreadsheetInfo {
  id: string;
  name: string;
  url: string;
}

export interface StudentNote {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nis: string;
  nama: string;
  kelas: string;
  jamPembelajaran: string; // e.g. "Jam 1-2 (07:00-08:30)"
  tipe: 'aktif' | 'bermasalah';
  catatan: string;
}

export interface Question {
  id: string;
  idPaket: string; // References the ExercisePackage
  teks: string;
  pilihanA: string;
  pilihanB: string;
  pilihanC: string;
  pilihanD: string;
  kunci: 'A' | 'B' | 'C' | 'D';
  bobot: number; // Manual points weight if correct, e.g. 10 or 25
}

export interface ExercisePackage {
  id: string;
  nama: string;
  kategori: 'Formatif' | 'Sumatif';
  targetKelas?: string; // Optional target class tracking
  targetNilaiKey?: string; // Links package CBT with specific Formative/Summative column key in grades
  soalList: Question[];
}

export interface ActiveAssessment {
  id: string;
  idPaket: string;
  targetKelas: string; // "Semua Kelas" or "Kelas 8.1", etc.
  token: string;
  status: 'Aktif' | 'Tidak Aktif';
}

export interface StudentSubmission {
  id: string; // SUB-unique
  nis: string;
  nama: string;
  noAbsen?: string;
  kelas: string;
  idPaket: string; // References ExercisePackage
  namaPaket: string;
  kategoriPaket: 'Formatif' | 'Sumatif';
  nilaiTotal: number;
  nilaiMaksimal: number;
  persentase: number;
  tanggal: string;
  detailJawaban: string; // JSON serialized string of questionId -> studentAnswer map
  idSoal?: string; // For backwards compatibility
  jawaban?: string; // For backwards compatibility
  status?: string; // For backwards compatibility
}

export interface RetakePermission {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  idPaket: string;
  namaPaket: string;
  tanggalDisetujui: string;
  status: 'Aktif' | 'Digunakan';
}

export interface BankSoalQuestion {
  id_soal: string;
  mata_pelajaran: string;
  materi: string;
  kelas: string; // Target kelas (comma-separated if multiple, e.g. "VII A, VII B")
  jenis_soal: 'Pilihan Ganda' | 'Essay' | 'Isian Singkat' | 'Benar Salah' | 'Menjodohkan';
  tingkat_kesulitan: 'Mudah' | 'Sedang' | 'Sulit';
  pertanyaan: string;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  opsi_e?: string;
  jawaban: string;
  pembahasan: string;
  bobot: number;
  tanggal_dibuat: string;
  tanggal_update: string;
  dibuat_oleh: string;
  status: 'Aktif' | 'Tidak Aktif';
}

export interface JadwalUjian {
  id: string;
  nama_ulangan: string;
  jenis_ulangan: 'Formatif' | 'Sumatif';
  mata_pelajaran: string;
  materi: string;
  jumlah_soal: number;
  target_kelas: string; // "Semua Kelas" or comma-separated list of classes
  tanggal: string; // YYYY-MM-DD
  jam_mulai: string; // HH:MM
  jam_selesai: string; // HH:MM
  durasi: number; // in minutes
  token: string;
  status: 'Aktif' | 'Tidak Aktif';
  soal_ids: string[]; // List of reference IDs to BankSoalQuestion
  nilai_key?: string; // Optional target academic grade column key (e.g. f1, f2, s1...)
}

export interface UserAccount {
  id_user: string;
  username: string;
  password: string;
  role: 'admin' | 'siswa';
  nis: string;
  status: 'Aktif' | 'Nonaktif';
  tanggal_dibuat: string;
  terakhir_login: string;
}

export interface ExtraTikPeserta {
  nis: string;
  nama: string;
  kelas: string;
  tanggalDaftar: string;
  status: 'Aktif' | 'Alumni' | 'Keluar';
}

export interface ExtraTikAbsensi {
  tanggal: string;
  nis: string;
  nama: string;
  kelas: string;
  statusKehadiran: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa';
  keterangan: string;
}

export interface ExtraTikNilai {
  nis: string;
  nama: string;
  kelas: string;
  nilaiTugas: number | null;
  nilaiPraktik: number | null;
  nilaiTeori: number | null;
  rataRata: number | null;
  predikat: string;
}




