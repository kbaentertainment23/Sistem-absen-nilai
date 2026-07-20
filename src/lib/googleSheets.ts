import * as mockSheets from './mockGoogleSheets';
import { appsScriptConfig } from './appsScriptConfig';
import {
  Student,
  AttendanceRecord,
  GradeFormative,
  GradeSummative,
  MonthlyRecap,
  SpreadsheetInfo,
  GradeColumn,
  Question,
  StudentSubmission,
  ExercisePackage,
  ActiveAssessment,
  RetakePermission,
  BankSoalQuestion,
  JadwalUjian,
  ExtraTikPeserta,
  ExtraTikAbsensi,
  ExtraTikNilai
} from '../types';

// Constants
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

const DEFAULT_CLASSES = Array.from({ length: 11 }, (_, i) => {
  return { id: i + 1, name: `Kelas 8.${i + 1}` };
});

// Legacy Template String (Left intact for build/import safety, but no longer used)
export const APPS_SCRIPT_TEMPLATE_CODE = `// Legacy Apps Script template code. Connection is now direct-to-API.`;

// Helper: Check if token is mock or offline
const isMockToken = (token: string): boolean => {
  return !token || token === 'apps-script-token' || token === 'mock-offline-token';
};

// Helper: Get Apps Script URL (Legacy support, no longer used)
export function getAppsScriptUrl(): string {
  return '';
}

// Helper: Get Spreadsheet ID
export function getSpreadsheetId(): string {
  const saved = localStorage.getItem('connected_spreadsheet');
  if (saved) {
    try {
      return JSON.parse(saved).id;
    } catch {}
  }
  return appsScriptConfig.spreadsheetId || '';
}

// Parsing utilities
function parseSheetNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  let str = val.toString().trim();
  const isPercent = str.includes('%');
  if (isPercent) {
    str = str.replace('%', '');
  }
  str = str.replace(',', '.');
  const num = Number(str);
  if (isNaN(num)) return 0;
  return isPercent ? num / 100 : num;
}

function parseSheetGrade(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  let str = val.toString().trim();
  str = str.replace(',', '.');
  const num = Number(str);
  return isNaN(num) ? null : num;
}

function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Helper to clear and write a sheet directly via Sheets REST API
async function writeSheetData(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: any[][]
): Promise<void> {
  // 1. Clear the sheet content first
  const clearRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:Z5000:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  if (!clearRes.ok) {
    console.warn(`Warning: Could not clear sheet: ${sheetName}`);
  }

  if (rows.length === 0) return;

  // 2. Write the values back starting at A1
  const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: rows
    })
  });

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    throw new Error(`Gagal menyimpan data ke Google Sheets (${sheetName}): ${errText}`);
  }
}

// EXPORTED FUNCTIONS

export async function listSpreadsheets(accessToken: string, searchQuery?: string): Promise<SpreadsheetInfo[]> {
  if (isMockToken(accessToken)) {
    return mockSheets.listSpreadsheets(accessToken, searchQuery);
  }
  try {
    const q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false${
      searchQuery ? ` and name contains '${searchQuery.replace(/'/g, "\\'")}'` : ''
    }`;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&fields=files(id,name,webViewLink)&pageSize=25`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (!response.ok) {
      throw new Error(`Drive API responded with ${response.status}`);
    }
    const data = await response.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}`
    }));
  } catch (err) {
    console.warn('Drive API spreadsheet list fetch failed. Falling back to mock.', err);
    return mockSheets.listSpreadsheets(accessToken, searchQuery);
  }
}

export async function checkAndPrepareSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{ compatible: boolean; missingSheets: string[]; sheetMap: Record<string, number> }> {
  if (isMockToken(accessToken)) {
    const res = await mockSheets.checkAndPrepareSpreadsheet(accessToken, spreadsheetId);
    return {
      compatible: !res.incompatible,
      missingSheets: res.missingSheets,
      sheetMap: {}
    };
  }
  
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat info spreadsheet. Status: ${response.status}`);
    }
    const data = await response.json();
    const existing = (data.sheets || []).map((s: any) => s.properties?.title || '');
    const required = [
      'Siswa', 'Absensi', 'Nilai Formatif', 'Nilai Sumatif', 'Rekap Bulanan', 'Daftar Kelas',
      'Extra TIK Peserta', 'Extra TIK Absensi', 'Extra TIK Nilai'
    ];
    const missing = required.filter(title => !existing.includes(title));
    
    return {
      compatible: missing.length === 0,
      missingSheets: missing,
      sheetMap: {}
    };
  } catch (err) {
    console.error('Spreadsheet check failed:', err);
    throw err;
  }
}

export async function setupMissingSheets(
  accessToken: string,
  spreadsheetId: string,
  missingSheets: string[],
  sampleStudents: Student[]
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.setupMissingSheets(accessToken, spreadsheetId, missingSheets);
  }

  if (missingSheets.length === 0) return;

  try {
    // 1. Create missing worksheets using batchUpdate
    const requests = missingSheets.map(title => ({
      addSheet: {
        properties: { title }
      }
    }));
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
    if (!updateRes.ok) {
      throw new Error(`Gagal membuat sheet baru: ${updateRes.statusText}`);
    }

    // 2. Setup standard headers for each created sheet
    const keySheets: Record<string, string[]> = {
      "Siswa": ["No. Absen", "NIS", "Nama", "Jenis Kelamin", "Kelas", "Foto"],
      "Absensi": [
        "Bulan", "NIS", "Nama", "Jenis Kelamin", "Kelas",
        "H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9", "H10",
        "H11", "H12", "H13", "H14", "H15", "H16", "H17", "H18", "H19", "H20",
        "H21", "H22", "H23", "H24", "H25", "H26", "H27", "H28", "H29", "H30", "H31"
      ],
      "Nilai Formatif": ["No. Absen", "NIS", "Nama", "Jenis Kelamin", "Kelas", "Formatif 1 (F1)", "Formatif 2 (F2)", "Formatif 3 (F3)", "Formatif 4 (F4)", "Rata-rata Formatif"],
      "Nilai Sumatif": ["No. Absen", "NIS", "Nama", "Jenis Kelamin", "Kelas", "Sumatif 1 (S1)", "Sumatif 2 (S2)", "Sumatif 3 (S3)", "UTS", "UAS", "Rata-rata Sumatif"],
      "Rekap Bulanan": [
        "No. Absen", "NIS", "Nama", "Jenis Kelamin", "Kelas",
        "Total Hadir", "Total Sakit", "Total Izin", "Total Alfa", "Total Terlambat", "Persentase Kehadiran"
      ],
      "Daftar Kelas": ["ID Kelas", "Nama Kelas"],
      "Extra TIK Peserta": ["NIS", "Nama", "Kelas", "Tanggal Daftar", "Status"],
      "Extra TIK Absensi": [
        "Bulan", "NIS", "Nama", "Kelas",
        "H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8", "H9", "H10",
        "H11", "H12", "H13", "H14", "H15", "H16", "H17", "H18", "H19", "H20",
        "H21", "H22", "H23", "H24", "H25", "H26", "H27", "H28", "H29", "H30", "H31"
      ],
      "Extra TIK Nilai": ["NIS", "Nama", "Kelas", "Nilai Tugas", "Nilai Praktik", "Nilai Teori", "Rata-rata", "Predikat"]
    };

    const dataPayloads: any[] = [];
    missingSheets.forEach(name => {
      const headers = keySheets[name];
      if (headers) {
        if (name === "Daftar Kelas") {
          const defaultClasses = Array.from({ length: 11 }, (_, i) => [String(i + 1), `Kelas 8.${i + 1}`]);
          dataPayloads.push({
            range: `${name}!A1:B12`,
            values: [headers, ...defaultClasses]
          });
        } else {
          dataPayloads.push({
            range: `${name}!A1:${getColumnLetter(headers.length - 1)}1`,
            values: [headers]
          });
        }
      }
    });

    if (dataPayloads.length > 0) {
      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: dataPayloads
        })
      });
      if (!writeRes.ok) {
        throw new Error('Gagal menulis header awal ke sheet baru.');
      }
    }
  } catch (err) {
    console.error('Error during setupMissingSheets:', err);
    throw err;
  }
}

export async function createSpreadsheet(
  accessToken: string,
  title: string,
  sampleStudents: Student[]
): Promise<SpreadsheetInfo> {
  if (isMockToken(accessToken)) {
    return mockSheets.createSpreadsheet(accessToken, title);
  }

  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title }
      })
    });
    if (!response.ok) {
      throw new Error('Gagal membuat file spreadsheet baru.');
    }
    const resData = await response.json();
    const spreadsheetId = resData.spreadsheetId;

    // Create required sheets
    const requiredSheets = [
      'Siswa', 'Absensi', 'Nilai Formatif', 'Nilai Sumatif', 'Rekap Bulanan', 'Daftar Kelas',
      'Extra TIK Peserta', 'Extra TIK Absensi', 'Extra TIK Nilai'
    ];
    await setupMissingSheets(accessToken, spreadsheetId, requiredSheets, sampleStudents);

    // Try deleting the default empty "Sheet1"
    try {
      const updatedMetaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (updatedMetaRes.ok) {
        const updatedMeta = await updatedMetaRes.json();
        const defaultSheet = (updatedMeta.sheets || []).find((s: any) => s.properties?.title === 'Sheet1' || s.properties?.title === 'Sheet 1');
        if (defaultSheet) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              requests: [{
                deleteSheet: { sheetId: defaultSheet.properties?.sheetId }
              }]
            })
          });
        }
      }
    } catch {}

    const sheetInfo: SpreadsheetInfo = {
      id: spreadsheetId,
      name: title,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    };

    // Write initial sample roster
    await syncStudentRoster(accessToken, spreadsheetId, sampleStudents);

    return sheetInfo;
  } catch (err) {
    console.error('Error creating spreadsheet:', err);
    throw err;
  }
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
  if (isMockToken(accessToken)) {
    return mockSheets.getSpreadsheetData(accessToken, spreadsheetId);
  }

  try {
    // 1. Fetch metadata first to see what sheets exist
    const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!metaResponse.ok) {
      throw new Error(`Gagal membuka spreadsheet. Status: ${metaResponse.status}`);
    }
    const metaData = await metaResponse.json();
    const existingTitles = (metaData.sheets || []).map((s: any) => s.properties?.title || '');

    const requiredSheets = [
      'Siswa', 'Absensi', 'Nilai Formatif', 'Nilai Sumatif', 'Rekap Bulanan', 'Daftar Kelas',
      'Extra TIK Peserta', 'Extra TIK Absensi', 'Extra TIK Nilai'
    ];

    const presentRequiredSheets = requiredSheets.filter(t => existingTitles.includes(t));
    const rangesQuery = presentRequiredSheets.map(title => `ranges=${encodeURIComponent(title)}!A1:Z5000`).join('&');

    const valuesResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesQuery}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!valuesResponse.ok) {
      throw new Error(`Gagal memuat nilai-nilai tabel. Status: ${valuesResponse.status}`);
    }
    const valuesData = await valuesResponse.json();

    const getSheetValues = (sheetName: string): any[][] => {
      const vr = (valuesData.valueRanges || []).find((r: any) => {
        const rStr = r.range || '';
        return rStr.startsWith(`'${sheetName}'!`) || rStr.startsWith(`${sheetName}!`);
      });
      return vr?.values || [];
    };

    const data = {
      siswa: getSheetValues('Siswa'),
      absensi: getSheetValues('Absensi'),
      nilaiFormatif: getSheetValues('Nilai Formatif'),
      nilaiSumatif: getSheetValues('Nilai Sumatif'),
      rekapBulanan: getSheetValues('Rekap Bulanan'),
      daftarKelas: getSheetValues('Daftar Kelas'),
      extraTikPeserta: getSheetValues('Extra TIK Peserta'),
      extraTikAbsensi: getSheetValues('Extra TIK Absensi'),
      extraTikNilai: getSheetValues('Extra TIK Nilai'),
    };

    // Parse Siswa
    const studentRows = data.siswa || [];
    let headers: string[] = [];
    let dataRows: string[][] = [];
    if (studentRows.length > 0) {
      const firstRow = studentRows[0];
      const isHeader = firstRow.some((cell: any) => {
        const s = cell?.toString().toLowerCase() || '';
        return s === 'nis' || s === 'nama' || s === 'no. absen' || s === 'no absen' || s === 'no_absen';
      });
      if (isHeader) {
        headers = firstRow.map((h: any) => h?.toString().trim().toLowerCase() || '');
        dataRows = studentRows.slice(1);
      } else {
        headers = ['nis', 'nama', 'jenis kelamin', 'kelas', 'foto'];
        dataRows = studentRows;
      }
    }

    const idxNoAbsen = headers.findIndex(h => h.includes('no') && h.includes('absen'));
    const idxNis = headers.indexOf('nis') !== -1 ? headers.indexOf('nis') : 0;
    const idxNama = headers.indexOf('nama') !== -1 ? headers.indexOf('nama') : 1;
    const idxGender = headers.findIndex(h => h.includes('kelamin') || h.includes('gender') || h.includes('jenis kelamin'));
    const idxKelas = headers.indexOf('kelas') !== -1 ? headers.indexOf('kelas') : 3;
    const idxFoto = headers.indexOf('foto') !== -1 ? headers.indexOf('foto') : 4;

    const students: Student[] = [];
    const seenStudentNis = new Set<string>();

    dataRows.forEach((row: string[]) => {
      const nisVal = row[idxNis !== -1 ? idxNis : 0];
      const namaVal = row[idxNama !== -1 ? idxNama : 1];
      if (nisVal && namaVal) {
        const nis = nisVal.toString().trim();
        if (nis && !seenStudentNis.has(nis)) {
          seenStudentNis.add(nis);
          const rawGender = (idxGender !== -1 ? row[idxGender] : 'L')?.toString().trim().toUpperCase() || 'L';
          
          let fotoUrl: string | undefined = undefined;
          const fotoCell = idxFoto !== -1 ? row[idxFoto] : undefined;
          if (fotoCell) {
            const cellStr = fotoCell.toString();
            const match = cellStr.match(/=IMAGE\s*\(\s*["']([^"']+)["']\s*/i);
            if (match) {
              fotoUrl = match[1];
            } else if (cellStr.startsWith('http')) {
              fotoUrl = cellStr;
            }
          }

          if (fotoUrl) {
            localStorage.setItem(`student_photo_${nis}`, fotoUrl);
          }

          const noAbsenVal = idxNoAbsen !== -1 ? row[idxNoAbsen]?.toString().trim() : undefined;

          students.push({
            noAbsen: noAbsenVal || '',
            nis,
            nama: namaVal.toString().trim(),
            jenisKelamin: (rawGender === 'P' || rawGender === 'PEREMPUAN') ? 'P' : 'L',
            kelas: (idxKelas !== -1 ? row[idxKelas] : 'Kelas 8.1')?.toString().trim() || 'Kelas 8.1',
            foto: fotoUrl || localStorage.getItem(`student_photo_${nis}`) || undefined,
          });
        }
      }
    });

    // Parse Absensi (Supports both legacy Daily Rows and new Monthly Grid)
    const attendanceRows = data.absensi || [];
    const firstCell = attendanceRows[0]?.[0]?.toString().toLowerCase() || '';
    
    const attendance: AttendanceRecord[] = [];
    const sessions = new Set<string>(); // set of "kelas|tanggal" where attendance was taken
    
    if (firstCell.includes('bulan')) {
      // Modern Monthly Grid format
      const realAbsRows = attendanceRows.slice(1);
      
      // First pass: find all session markers to know which days attendance was taken
      const sessionRows = realAbsRows.filter((row: any[]) => row[1]?.toString() === 'SESSION_MARKER');
      sessionRows.forEach((row: any[]) => {
        const bulan = row[0]?.toString() || '';
        const kelas = row[4]?.toString() || '';
        if (bulan && kelas) {
          for (let day = 1; day <= 31; day++) {
            const colIdx = 4 + day; // Day 1 is index 5
            const val = row[colIdx]?.toString();
            if (val === 'Y') {
              const dateStr = `${bulan}-${String(day).padStart(2, '0')}`;
              sessions.add(`${kelas}|${dateStr}`);
            }
          }
        }
      });

      // Second pass: read explicit student records (for non-default statuses like S, I, A, or Lateness)
      const studentRows = realAbsRows.filter((row: any[]) => row[0] && row[1] && row[1]?.toString() !== 'SESSION_MARKER');
      const explicitRecords = new Map<string, AttendanceRecord>(); // key: "nis|tanggal"

      studentRows.forEach((row: any[]) => {
        const bulan = row[0]?.toString() || '';
        const nis = row[1]?.toString() || '';
        const nama = row[2]?.toString() || '';
        const rawGender = row[3]?.toString().trim().toUpperCase() || 'L';
        const jenisKelamin = (rawGender === 'P' || rawGender === 'PEREMPUAN') ? 'P' : 'L';
        const kelas = row[4]?.toString().trim() || 'Kelas 8.1';

        for (let day = 1; day <= 31; day++) {
          const colIdx = 4 + day;
          const val = row[colIdx]?.toString() || '';
          if (val) {
            const dateStr = `${bulan}-${String(day).padStart(2, '0')}`;
            // Deserialize cell value (e.g. "S", "H|15|Ban bocor")
            const parts = val.split('|');
            const code = parts[0]?.trim().toUpperCase() || 'H';
            let status: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa' = 'Hadir';
            if (code === 'S') status = 'Sakit';
            else if (code === 'I') status = 'Izin';
            else if (code === 'A') status = 'Alfa';

            const terlambat = parseInt(parts[1]) || 0;
            const keterangan = parts[2] || '';

            explicitRecords.set(`${nis}|${dateStr}`, {
              tanggal: dateStr,
              nis,
              nama,
              jenisKelamin,
              kelas,
              status,
              terlambat,
              keterangan
            });
          }
        }
      });

      // Reconstruct the full attendance list for every student on every session day
      sessions.forEach(sessionStr => {
        const [kelas, tanggal] = sessionStr.split('|');
        const classStudents = students.filter(s => s.kelas === kelas);
        
        classStudents.forEach(student => {
          const key = `${student.nis}|${tanggal}`;
          const match = explicitRecords.get(key);
          if (match) {
            attendance.push(match);
          } else {
            // Default to present if there is no explicit record
            attendance.push({
              tanggal,
              nis: student.nis,
              nama: student.nama,
              jenisKelamin: student.jenisKelamin as 'L' | 'P' | undefined,
              kelas,
              status: 'Hadir' as const,
              terlambat: 0,
              keterangan: '',
            });
          }
        });
      });

    } else {
      // Legacy Daily rows format for backward compatibility
      const hasAbsHeaders = attendanceRows[0] && attendanceRows[0][0]?.toString().toLowerCase().includes('tanggal');
      const realAbsRows = hasAbsHeaders ? attendanceRows.slice(1) : attendanceRows;
      const rawAttendance = realAbsRows
        .filter((row: any[]) => row[0] && row[1] && row[2])
        .map((row: any[]) => {
          const rawGender = row[3]?.toString().trim().toUpperCase() || 'L';
          return {
            tanggal: row[0]?.toString() || '',
            nis: row[1]?.toString() || '',
            nama: row[2]?.toString() || '',
            jenisKelamin: (rawGender === 'P' || rawGender === 'PEREMPUAN') ? 'P' : 'L' as 'L' | 'P',
            kelas: row[4]?.toString().trim() || 'Kelas 8.1',
            status: (row[5]?.toString() || 'Hadir') as AttendanceRecord['status'],
            terlambat: parseSheetNumber(row[6]),
            keterangan: row[7]?.toString() || '',
          };
        });

      const legacySessions = new Set<string>();
      rawAttendance.forEach(r => {
        legacySessions.add(`${r.kelas}|${r.tanggal}`);
      });

      const explicitRecords = rawAttendance.filter(r => r.nis !== 'SESSION_MARKER');

      legacySessions.forEach(sessionStr => {
        const [kelas, tanggal] = sessionStr.split('|');
        const classStudents = students.filter(s => s.kelas === kelas);
        
        classStudents.forEach(student => {
          const match = explicitRecords.find(r => r.tanggal === tanggal && r.nis === student.nis);
          if (match) {
            attendance.push(match as AttendanceRecord);
          } else {
            attendance.push({
              tanggal,
              nis: student.nis,
              nama: student.nama,
              jenisKelamin: student.jenisKelamin as 'L' | 'P' | undefined,
              kelas,
              status: 'Hadir' as const,
              terlambat: 0,
              keterangan: '',
            });
          }
        });
      });
    }

    // Parse Formative Grades
    const formativeValues = data.nilaiFormatif || [];
    const formativeHeaders: string[] = formativeValues[0] || [
      'No. Absen', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas',
      'Formatif 1 (F1)', 'Formatif 2 (F2)', 'Formatif 3 (F3)', 'Formatif 4 (F4)', 'Rata-rata Formatif'
    ];

    const formativeNisColIdx = formativeHeaders.findIndex(h => h.toLowerCase() === 'nis') !== -1 
      ? formativeHeaders.findIndex(h => h.toLowerCase() === 'nis') 
      : 1;
    const formativeKelasColIdx = formativeHeaders.findIndex(h => h.toLowerCase() === 'kelas') !== -1 
      ? formativeHeaders.findIndex(h => h.toLowerCase() === 'kelas') 
      : 4;
    const formativeGradeStartIdx = formativeKelasColIdx + 1;

    const formativeAvgIdx = formativeHeaders.findIndex(
      h => h.toLowerCase().includes('rata-rata') || h.toLowerCase().includes('rata rata')
    );
    const lastFormativeGradeIdx = formativeAvgIdx !== -1 ? formativeAvgIdx - 1 : formativeHeaders.length - 2;

    const formativeCols: GradeColumn[] = [];
    for (let i = formativeGradeStartIdx; i <= lastFormativeGradeIdx; i++) {
      const label = formativeHeaders[i] || `Formatif ${i - formativeGradeStartIdx + 1} (F${i - formativeGradeStartIdx + 1})`;
      const key = `f${i - formativeGradeStartIdx + 1}`;
      formativeCols.push({ key, label });
    }

    if (formativeCols.length === 0) {
      formativeCols.push(
        { key: 'f1', label: 'Formatif 1 (F1)' },
        { key: 'f2', label: 'Formatif 2 (F2)' },
        { key: 'f3', label: 'Formatif 3 (F3)' },
        { key: 'f4', label: 'Formatif 4 (F4)' }
      );
    }

    const formativeStudentRows = formativeValues.slice(1);
    const formativeGrades: GradeFormative[] = students.map(s => {
      const row = formativeStudentRows.find((r: any[]) => r[formativeNisColIdx]?.toString().trim() === s.nis?.toString().trim()) || [];
      const item: GradeFormative = {
        nis: s.nis,
        nama: s.nama,
        jenisKelamin: s.jenisKelamin,
        kelas: s.kelas,
        rataRata: parseSheetGrade(row[formativeAvgIdx !== -1 ? formativeAvgIdx : formativeHeaders.length - 1]),
      };
      formativeCols.forEach((col, idx) => {
        item[col.key] = parseSheetGrade(row[formativeGradeStartIdx + idx]);
      });
      return item;
    });

    // Parse Summative Grades
    const summativeValues = data.nilaiSumatif || [];
    const summativeHeaders: string[] = summativeValues[0] || [
      'No. Absen', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas',
      'Sumatif 1 (S1)', 'Sumatif 2 (S2)', 'Sumatif 3 (S3)', 'UTS', 'UAS', 'Rata-rata Sumatif'
    ];

    const summativeNisColIdx = summativeHeaders.findIndex(h => h.toLowerCase() === 'nis') !== -1 
      ? summativeHeaders.findIndex(h => h.toLowerCase() === 'nis') 
      : 1;
    const summativeKelasColIdx = summativeHeaders.findIndex(h => h.toLowerCase() === 'kelas') !== -1 
      ? summativeHeaders.findIndex(h => h.toLowerCase() === 'kelas') 
      : 4;
    const summativeGradeStartIdx = summativeKelasColIdx + 1;

    const summativeAvgIdx = summativeHeaders.findIndex(
      h => h.toLowerCase().includes('rata-rata') || h.toLowerCase().includes('rata rata')
    );
    const lastSummativeGradeIdx = summativeAvgIdx !== -1 ? summativeAvgIdx - 1 : summativeHeaders.length - 2;

    const summativeCols: GradeColumn[] = [];
    for (let i = summativeGradeStartIdx; i <= lastSummativeGradeIdx; i++) {
      const label = summativeHeaders[i] || `Sumatif ${i - summativeGradeStartIdx + 1} (S${i - summativeGradeStartIdx + 1})`;
      const key = label.toLowerCase().includes('uts') ? 'uts' : label.toLowerCase().includes('uas') ? 'uas' : `s${i - summativeGradeStartIdx + 1}`;
      summativeCols.push({ key, label });
    }

    if (summativeCols.length === 0) {
      summativeCols.push(
        { key: 's1', label: 'Sumatif 1 (S1)' },
        { key: 's2', label: 'Sumatif 2 (S2)' },
        { key: 's3', label: 'Sumatif 3 (S3)' },
        { key: 'uts', label: 'UTS' },
        { key: 'uas', label: 'UAS' }
      );
    }

    const summativeStudentRows = summativeValues.slice(1);
    const summativeGrades: GradeSummative[] = students.map(s => {
      const row = summativeStudentRows.find((r: any[]) => r[summativeNisColIdx]?.toString().trim() === s.nis?.toString().trim()) || [];
      const item: GradeSummative = {
        nis: s.nis,
        nama: s.nama,
        jenisKelamin: s.jenisKelamin,
        kelas: s.kelas,
        rataRata: parseSheetGrade(row[summativeAvgIdx !== -1 ? summativeAvgIdx : summativeHeaders.length - 1]),
      };
      summativeCols.forEach((col, idx) => {
        item[col.key] = parseSheetGrade(row[summativeGradeStartIdx + idx]);
      });
      return item;
    });

    // Parse Recap
    const recapValues = data.rekapBulanan || [];
    const hasRecapHeaders = recapValues[0] && recapValues[0][0]?.toString().toLowerCase().includes('absen');
    const realRecapRows = hasRecapHeaders ? recapValues.slice(1) : recapValues;
    const recap: MonthlyRecap[] = realRecapRows.map((row: any[]) => ({
      nis: row[1]?.toString() || '',
      nama: row[2]?.toString() || '',
      jenisKelamin: row[3]?.toString() === 'P' ? 'P' : 'L',
      kelas: row[4]?.toString() || 'Kelas 8.1',
      hadir: Number(row[5]) || 0,
      sakit: Number(row[6]) || 0,
      izin: Number(row[7]) || 0,
      alfa: Number(row[8]) || 0,
      terlambatCount: Number(row[9]) || 0,
      persentaseKehadiran: Number(row[10]) || 0
    }));

    // Parse Classes
    const classesRows = data.daftarKelas || [];
    const hasClassHeaders = classesRows[0] && classesRows[0][0]?.toString().toLowerCase().includes('id');
    const realClassRows = hasClassHeaders ? classesRows.slice(1) : classesRows;
    const classes = realClassRows.map((row: any[]) => ({
      id: Number(row[0]) || 0,
      name: row[1]?.toString() || '',
    })).filter((c: any) => c.id && c.name);

    // Parse Extra TIK Peserta
    const extraTikPesertaRows = data.extraTikPeserta || [];
    const firstPesertaRow = extraTikPesertaRows[0];
    const hasPesertaHeaders = firstPesertaRow && firstPesertaRow.some((cell: any) => {
      const s = cell?.toString().toLowerCase() || '';
      return s === 'nis' || s === 'nama' || s === 'status';
    });

    const pesertaHeaders = hasPesertaHeaders 
      ? firstPesertaRow.map((h: any) => h?.toString().trim().toLowerCase() || '')
      : ['nis', 'nama', 'kelas', 'tanggal daftar', 'status'];

    const realPesertaRows = hasPesertaHeaders ? extraTikPesertaRows.slice(1) : extraTikPesertaRows;

    const idxPesertaNis = pesertaHeaders.indexOf('nis');
    const idxPesertaNama = pesertaHeaders.indexOf('nama');
    const idxPesertaKelas = pesertaHeaders.indexOf('kelas');
    const idxPesertaTgl = pesertaHeaders.findIndex(h => h.includes('tanggal') || h.includes('daftar') || h.includes('tgl'));
    const idxPesertaStatus = pesertaHeaders.indexOf('status');

    const extraTikPeserta: ExtraTikPeserta[] = realPesertaRows
      .filter((row: any[]) => row[idxPesertaNis !== -1 ? idxPesertaNis : 0])
      .map((row: any[]) => {
        const nis = row[idxPesertaNis !== -1 ? idxPesertaNis : 0]?.toString().trim() || '';
        const nama = idxPesertaNama !== -1 ? (row[idxPesertaNama]?.toString() || '') : '';
        const kelas = idxPesertaKelas !== -1 ? (row[idxPesertaKelas]?.toString() || '') : '';
        const tanggalDaftar = idxPesertaTgl !== -1 ? (row[idxPesertaTgl]?.toString() || '') : '';
        const status = (idxPesertaStatus !== -1 ? (row[idxPesertaStatus]?.toString() || 'Aktif') : 'Aktif') as ExtraTikPeserta['status'];
        return { nis, nama, kelas, tanggalDaftar, status };
      });

    // Parse Extra TIK Absensi
    const extraTikAbsensiRows = data.extraTikAbsensi || [];
    const firstAbsRow = extraTikAbsensiRows[0];
    const firstAbsCell = firstAbsRow?.[0]?.toString().toLowerCase() || '';

    const extraTikAbsensi: ExtraTikAbsensi[] = [];
    
    if (firstAbsCell.includes('bulan')) {
      // Modern Monthly Grid format for Extra TIK
      const realAbsRows = extraTikAbsensiRows.slice(1);
      const tikSessions = new Set<string>(); // set of "kelas|tanggal" where attendance was taken
      
      // First pass: find all session markers to know which days attendance was taken
      const sessionRows = realAbsRows.filter((row: any[]) => row[1]?.toString() === 'SESSION_MARKER');
      sessionRows.forEach((row: any[]) => {
        const bulan = row[0]?.toString() || '';
        const kelas = row[3]?.toString() || ''; // index 3 is Kelas
        if (bulan && kelas) {
          for (let day = 1; day <= 31; day++) {
            const colIdx = 3 + day; // Day 1 is index 4
            const val = row[colIdx]?.toString();
            if (val === 'Y') {
              const dateStr = `${bulan}-${String(day).padStart(2, '0')}`;
              tikSessions.add(`${kelas}|${dateStr}`);
            }
          }
        }
      });

      // Second pass: read explicit student records (for non-default statuses like S, I, A, or Remarks)
      const studentRows = realAbsRows.filter((row: any[]) => row[0] && row[1] && row[1]?.toString() !== 'SESSION_MARKER');
      const explicitRecords = new Map<string, ExtraTikAbsensi>(); // key: "nis|tanggal"

      studentRows.forEach((row: any[]) => {
        const bulan = row[0]?.toString() || '';
        const nis = row[1]?.toString() || '';
        const nama = row[2]?.toString() || '';
        const kelas = row[3]?.toString().trim() || 'Kelas 8.1';

        for (let day = 1; day <= 31; day++) {
          const colIdx = 3 + day;
          const val = row[colIdx]?.toString() || '';
          if (val) {
            const dateStr = `${bulan}-${String(day).padStart(2, '0')}`;
            // Deserialize cell value (e.g. "S", "H|Ban bocor")
            const parts = val.split('|');
            const code = parts[0]?.trim().toUpperCase() || 'H';
            let statusKehadiran: 'Hadir' | 'Sakit' | 'Izin' | 'Alfa' = 'Hadir';
            if (code === 'S') statusKehadiran = 'Sakit';
            else if (code === 'I') statusKehadiran = 'Izin';
            else if (code === 'A') statusKehadiran = 'Alfa';

            const keterangan = parts[1] || '';

            explicitRecords.set(`${nis}|${dateStr}`, {
              tanggal: dateStr,
              nis,
              nama,
              kelas,
              statusKehadiran,
              keterangan
            });
          }
        }
      });

      // Reconstruct the full attendance list for every registered student on every session day
      tikSessions.forEach(sessionStr => {
        const [kelas, tanggal] = sessionStr.split('|');
        const classStudents = extraTikPeserta.filter(s => s.kelas === kelas);
        
        classStudents.forEach(student => {
          const key = `${student.nis}|${tanggal}`;
          const match = explicitRecords.get(key);
          if (match) {
            extraTikAbsensi.push(match);
          } else {
            // Default to present if there is no explicit record
            extraTikAbsensi.push({
              tanggal,
              nis: student.nis,
              nama: student.nama,
              kelas,
              statusKehadiran: 'Hadir' as const,
              keterangan: '',
            });
          }
        });
      });

    } else {
      // Legacy Daily rows format for backward compatibility
      const hasAbsensiHeaders = firstAbsRow && firstAbsRow.some((cell: any) => {
        const s = cell?.toString().toLowerCase() || '';
        return s === 'tanggal' || s === 'nis' || s === 'status kehadiran' || s === 'kehadiran';
      });

      const absHeaders = hasAbsensiHeaders
        ? firstAbsRow.map((h: any) => h?.toString().trim().toLowerCase() || '')
        : ['tanggal', 'nis', 'nama', 'kelas', 'status kehadiran', 'keterangan'];

      const realAbsensiRows = hasAbsensiHeaders ? extraTikAbsensiRows.slice(1) : extraTikAbsensiRows;

      const idxAbsTanggal = absHeaders.indexOf('tanggal');
      const idxAbsNis = absHeaders.indexOf('nis');
      const idxAbsNama = absHeaders.indexOf('nama');
      const idxAbsKelas = absHeaders.indexOf('kelas');
      const idxAbsStatus = absHeaders.findIndex(h => h.includes('status') || h.includes('kehadiran') || h.includes('absen'));
      const idxAbsKet = absHeaders.findIndex(h => h.includes('keterangan') || h.includes('ket'));

      const rawAttendance = realAbsensiRows
        .filter((row: any[]) => row[idxAbsNis !== -1 ? idxAbsNis : 1])
        .map((row: any[]) => {
          const tanggal = idxAbsTanggal !== -1 ? (row[idxAbsTanggal]?.toString() || '') : '';
          const nis = idxAbsNis !== -1 ? (row[idxAbsNis]?.toString() || '') : '';
          const nama = idxAbsNama !== -1 ? (row[idxAbsNama]?.toString() || '') : '';
          const kelas = idxAbsKelas !== -1 ? (row[idxAbsKelas]?.toString() || '') : '';
          const statusKehadiran = (idxAbsStatus !== -1 ? (row[idxAbsStatus]?.toString() || 'Hadir') : 'Hadir') as ExtraTikAbsensi['statusKehadiran'];
          const keterangan = idxAbsKet !== -1 ? (row[idxAbsKet]?.toString() || '') : '';
          return { tanggal, nis, nama, kelas, statusKehadiran, keterangan };
        });

      const legacySessions = new Set<string>();
      rawAttendance.forEach(r => {
        legacySessions.add(`${r.kelas}|${r.tanggal}`);
      });

      const explicitRecords = rawAttendance.filter(r => r.nis !== 'SESSION_MARKER');

      legacySessions.forEach(sessionStr => {
        const [kelas, tanggal] = sessionStr.split('|');
        const classStudents = extraTikPeserta.filter(s => s.kelas === kelas);
        
        classStudents.forEach(student => {
          const match = explicitRecords.find(r => r.tanggal === tanggal && r.nis === student.nis);
          if (match) {
            extraTikAbsensi.push(match as ExtraTikAbsensi);
          } else {
            extraTikAbsensi.push({
              tanggal,
              nis: student.nis,
              nama: student.nama,
              kelas,
              statusKehadiran: 'Hadir' as const,
              keterangan: '',
            });
          }
        });
      });
    }

    // Parse Extra TIK Nilai
    const extraTikNilaiRows = data.extraTikNilai || [];
    const firstNilaiRow = extraTikNilaiRows[0];
    const hasNilaiHeaders = firstNilaiRow && firstNilaiRow.some((cell: any) => {
      const s = cell?.toString().toLowerCase() || '';
      return s === 'nis' || s === 'nama' || s === 'nilai tugas' || s === 'tugas';
    });

    const nilaiHeaders = hasNilaiHeaders
      ? firstNilaiRow.map((h: any) => h?.toString().trim().toLowerCase() || '')
      : ['nis', 'nama', 'kelas', 'nilai tugas', 'nilai praktik', 'nilai teori', 'rata-rata', 'predikat'];

    const realNilaiRows = hasNilaiHeaders ? extraTikNilaiRows.slice(1) : extraTikNilaiRows;

    const idxNilaiNis = nilaiHeaders.indexOf('nis');
    const idxNilaiNama = nilaiHeaders.indexOf('nama');
    const idxNilaiKelas = nilaiHeaders.indexOf('kelas');
    const idxNilaiTugas = nilaiHeaders.findIndex(h => h.includes('tugas'));
    const idxNilaiPraktik = nilaiHeaders.findIndex(h => h.includes('praktik') || h.includes('praktek'));
    const idxNilaiTeori = nilaiHeaders.findIndex(h => h.includes('teori'));
    const idxNilaiRata = nilaiHeaders.findIndex(h => h.includes('rata') || h.includes('average'));
    const idxNilaiPredikat = nilaiHeaders.findIndex(h => h.includes('predikat'));

    const extraTikNilai: ExtraTikNilai[] = realNilaiRows
      .filter((row: any[]) => row[idxNilaiNis !== -1 ? idxNilaiNis : 0])
      .map((row: any[]) => {
        const nis = idxNilaiNis !== -1 ? (row[idxNilaiNis]?.toString() || '') : '';
        const nama = idxNilaiNama !== -1 ? (row[idxNilaiNama]?.toString() || '') : '';
        const kelas = idxNilaiKelas !== -1 ? (row[idxNilaiKelas]?.toString() || '') : '';
        const nilaiTugas = idxNilaiTugas !== -1 ? parseSheetGrade(row[idxNilaiTugas]) : null;
        const nilaiPraktik = idxNilaiPraktik !== -1 ? parseSheetGrade(row[idxNilaiPraktik]) : null;
        const nilaiTeori = idxNilaiTeori !== -1 ? parseSheetGrade(row[idxNilaiTeori]) : null;
        const rataRata = idxNilaiRata !== -1 ? parseSheetGrade(row[idxNilaiRata]) : null;
        const predikat = idxNilaiPredikat !== -1 ? (row[idxNilaiPredikat]?.toString() || '') : '';
        return { nis, nama, kelas, nilaiTugas, nilaiPraktik, nilaiTeori, rataRata, predikat };
      });

    return {
      students,
      attendance,
      formativeGrades,
      summativeGrades,
      formativeCols,
      summativeCols,
      recap,
      classes: classes.length > 0 ? classes : DEFAULT_CLASSES,
      bankSoalQuestions: [],
      schedules: [],
      accounts: [],
      hasilUlangan: [],
      extraTikPeserta,
      extraTikAbsensi,
      extraTikNilai
    };
  } catch (err: any) {
    console.warn('Error fetching spreadsheet data via REST API. Falling back to offline mock data:', err);
    return mockSheets.getSpreadsheetData(accessToken, spreadsheetId);
  }
}

export async function syncStudentRoster(
  accessToken: string,
  spreadsheetId: string,
  students: Student[],
  existingFormative: GradeFormative[] = [],
  existingSummative: GradeSummative[] = [],
  formativeCols: GradeColumn[] = [],
  summativeCols: GradeColumn[] = []
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.syncStudentRoster(accessToken, spreadsheetId, students, existingFormative, existingSummative);
  }

  try {
    const activeFormativeCols = formativeCols.length > 0 ? formativeCols : DEFAULT_FORMATIVE_COLS;
    const activeSummativeCols = summativeCols.length > 0 ? summativeCols : DEFAULT_SUMMATIVE_COLS;

    // 1. Siswa
    const studentRows = [['No. Absen', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas', 'Foto']];
    students.forEach((s, idx) => {
      let cellFotoValue = '';
      if (s.foto) {
        if (s.foto.startsWith('http')) {
          cellFotoValue = `=IMAGE("${s.foto}")`;
        } else {
          const cachedDrive = localStorage.getItem(`student_photo_${s.nis}`);
          if (cachedDrive && cachedDrive.startsWith('http')) {
            cellFotoValue = `=IMAGE("${cachedDrive}")`;
          }
        }
      }
      studentRows.push([
        s.noAbsen || (idx + 1).toString(),
        s.nis,
        s.nama,
        s.jenisKelamin || 'L',
        s.kelas || 'Kelas 8.1',
        cellFotoValue
      ]);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Siswa', studentRows);

    // 2. Nilai Formatif
    const formativeHeaders = [
      'No. Absen', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas',
      ...activeFormativeCols.map(c => c.label), 'Rata-rata Formatif'
    ];
    const formativeRows = [formativeHeaders];
    students.forEach((s, idx) => {
      const rowNum = idx + 2;
      const match = existingFormative.find(f => f.nis?.toString().trim() === s.nis?.toString().trim());
      const rowValues: any[] = [
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!A${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!B${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!C${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!D${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!E${rowNum})`,
      ];
      activeFormativeCols.forEach(col => {
        const val = match ? match[col.key] : null;
        rowValues.push(val !== undefined && val !== null ? val : '');
      });
      const startCol = 'F';
      const endCol = getColumnLetter(4 + activeFormativeCols.length);
      rowValues.push(`=IFERROR(AVERAGE(${startCol}${rowNum}:${endCol}${rowNum}); 0)`);
      formativeRows.push(rowValues);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Nilai Formatif', formativeRows);

    // 3. Nilai Sumatif
    const summativeHeaders = [
      'No. Absen', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas',
      ...activeSummativeCols.map(c => c.label), 'Rata-rata Sumatif'
    ];
    const summativeRows = [summativeHeaders];
    students.forEach((s, idx) => {
      const rowNum = idx + 2;
      const match = existingSummative.find(sum => sum.nis?.toString().trim() === s.nis?.toString().trim());
      const rowValues: any[] = [
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!A${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!B${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!C${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!D${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!E${rowNum})`,
      ];
      activeSummativeCols.forEach(col => {
        const val = match ? match[col.key] : null;
        rowValues.push(val !== undefined && val !== null ? val : '');
      });
      const startCol = 'F';
      const endCol = getColumnLetter(4 + activeSummativeCols.length);
      rowValues.push(`=IFERROR(AVERAGE(${startCol}${rowNum}:${endCol}${rowNum}); 0)`);
      summativeRows.push(rowValues);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Nilai Sumatif', summativeRows);

    // 4. Rekap Bulanan
    const rekapHeaders = [
      'No. Absen', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas',
      'Total Hadir', 'Total Sakit', 'Total Izin', 'Total Alfa', 'Total Terlambat', 'Persentase Kehadiran'
    ];
    const rekapRows = [rekapHeaders];
    students.forEach((s, idx) => {
      const rowNum = idx + 2;
      rekapRows.push([
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!A${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!B${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!C${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!D${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!E${rowNum})`,
        `=SUMPRODUCT((Absensi!$B$2:$B$10000 = "SESSION_MARKER") * (Absensi!$E$2:$E$10000 = $E${rowNum}) * (Absensi!$F$2:$AJ$10000 = "Y")) - G${rowNum} - H${rowNum} - I${rowNum}`,
        `=SUMPRODUCT((Absensi!$B$2:$B$10000 = $B${rowNum}) * (LEFT(Absensi!$F$2:$AJ$10000; 1) = "S"))`,
        `=SUMPRODUCT((Absensi!$B$2:$B$10000 = $B${rowNum}) * (LEFT(Absensi!$F$2:$AJ$10000; 1) = "I"))`,
        `=SUMPRODUCT((Absensi!$B$2:$B$10000 = $B${rowNum}) * (LEFT(Absensi!$F$2:$AJ$10000; 1) = "A"))`,
        `=SUMPRODUCT((Absensi!$B$2:$B$10000 = $B${rowNum}) * (REGEXMATCH(TO_TEXT(Absensi!$F$2:$AJ$10000); "\|")))`,
        `=IFERROR(F${rowNum}/SUM(F${rowNum}:I${rowNum}); 0)`,
      ]);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Rekap Bulanan', rekapRows);

  } catch (err) {
    console.error('Error syncing student roster directly:', err);
    throw err;
  }
}

export async function saveAllAttendance(
  accessToken: string,
  spreadsheetId: string,
  records: AttendanceRecord[]
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.saveAllAttendance(accessToken, spreadsheetId, records);
  }
  
  try {
    const headers = [
      'Bulan', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10',
      'H11', 'H12', 'H13', 'H14', 'H15', 'H16', 'H17', 'H18', 'H19', 'H20',
      'H21', 'H22', 'H23', 'H24', 'H25', 'H26', 'H27', 'H28', 'H29', 'H30', 'H31'
    ];
    const rows: any[][] = [headers];

    // Group records by unique (Bulan, Kelas)
    const classMonths = new Map<string, { bulan: string; kelas: string; records: AttendanceRecord[] }>();
    records.forEach(r => {
      if (!r.tanggal || !r.kelas) return;
      const bulan = r.tanggal.substring(0, 7); // YYYY-MM
      const key = `${bulan}|${r.kelas}`;
      if (!classMonths.has(key)) {
        classMonths.set(key, { bulan, kelas: r.kelas, records: [] });
      }
      classMonths.get(key)!.records.push(r);
    });

    classMonths.forEach(({ bulan, kelas, records: monthRecords }) => {
      // Find all unique session dates in this month for this class
      const datesInMonth = new Set<string>();
      monthRecords.forEach(r => {
        datesInMonth.add(r.tanggal);
      });

      // 1. Create the SESSION_MARKER row to track on which days attendance was taken
      const sessionRow: any[] = [
        bulan,
        'SESSION_MARKER',
        'Attendance Session',
        'L',
        kelas,
        ...Array(31).fill('')
      ];
      datesInMonth.forEach(dateStr => {
        const dayNum = parseInt(dateStr.split('-')[2]);
        if (dayNum >= 1 && dayNum <= 31) {
          sessionRow[4 + dayNum] = 'Y';
        }
      });
      rows.push(sessionRow);

      // 2. Group records by student NIS to write their horizontal month history
      const studentRecords = new Map<string, { nis: string; nama: string; gender: string; records: AttendanceRecord[] }>();
      monthRecords.forEach(r => {
        if (r.nis === 'SESSION_MARKER') return;
        if (!studentRecords.has(r.nis)) {
          studentRecords.set(r.nis, {
            nis: r.nis,
            nama: r.nama,
            gender: r.jenisKelamin || 'L',
            records: []
          });
        }
        studentRecords.get(r.nis)!.records.push(r);
      });

      studentRecords.forEach(({ nis, nama, gender, records: sRecords }) => {
        const studentRow: any[] = [
          bulan,
          nis,
          nama,
          gender,
          kelas,
          ...Array(31).fill('')
        ];

        sRecords.forEach(r => {
          const dayNum = parseInt(r.tanggal.split('-')[2]);
          if (dayNum >= 1 && dayNum <= 31) {
            const isDefaultPresent = r.status === 'Hadir' && Number(r.terlambat) === 0 && (!r.keterangan || r.keterangan.trim() === '');
            if (!isDefaultPresent) {
              const code = r.status === 'Sakit' ? 'S' : r.status === 'Izin' ? 'I' : r.status === 'Alfa' ? 'A' : 'H';
              const cleanRemark = (r.keterangan || '').trim().replace(/\|/g, ' ');
              const cellVal = (r.terlambat > 0 || cleanRemark) 
                ? `${code}|${r.terlambat}|${cleanRemark}` 
                : code;
              
              studentRow[4 + dayNum] = cellVal;
            }
          }
        });

        rows.push(studentRow);
      });
    });

    await writeSheetData(accessToken, spreadsheetId, 'Absensi', rows);
  } catch (err) {
    console.error('Error saving attendance:', err);
    throw err;
  }
}

export async function saveGrades(
  accessToken: string,
  spreadsheetId: string,
  formativeGrades: GradeFormative[],
  summativeGrades: GradeSummative[],
  students: Student[],
  formativeCols: GradeColumn[],
  summativeCols: GradeColumn[]
): Promise<void> {
  if (isMockToken(accessToken)) {
    await mockSheets.saveGrades(accessToken, spreadsheetId, 'Formatif', formativeGrades, formativeCols);
    await mockSheets.saveGrades(accessToken, spreadsheetId, 'Sumatif', summativeGrades, summativeCols);
    return;
  }

  try {
    // Save Formative Grades
    const formativeHeaders = [
      'No. Absen', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas',
      ...formativeCols.map(c => c.label), 'Rata-rata Formatif'
    ];
    const formativeRows = [formativeHeaders];
    students.forEach((s, idx) => {
      const rowNum = idx + 2;
      const match = formativeGrades.find(g => g.nis?.toString().trim() === s.nis?.toString().trim());
      const rowValues: any[] = [
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!A${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!B${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!C${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!D${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!E${rowNum})`,
      ];
      formativeCols.forEach(col => {
        const val = match ? (match as any)[col.key] : null;
        rowValues.push(val !== undefined && val !== null ? val : '');
      });
      const startCol = 'F';
      const endCol = getColumnLetter(4 + formativeCols.length);
      rowValues.push(`=IFERROR(AVERAGE(${startCol}${rowNum}:${endCol}${rowNum}); 0)`);
      formativeRows.push(rowValues);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Nilai Formatif', formativeRows);

    // Save Summative Grades
    const summativeHeaders = [
      'No. Absen', 'NIS', 'Nama', 'Jenis Kelamin', 'Kelas',
      ...summativeCols.map(c => c.label), 'Rata-rata Sumatif'
    ];
    const summativeRows = [summativeHeaders];
    students.forEach((s, idx) => {
      const rowNum = idx + 2;
      const match = summativeGrades.find(g => g.nis?.toString().trim() === s.nis?.toString().trim());
      const rowValues: any[] = [
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!A${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!B${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!C${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!D${rowNum})`,
        `=IF(ISBLANK(Siswa!B${rowNum}); ""; Siswa!E${rowNum})`,
      ];
      summativeCols.forEach(col => {
        const val = match ? (match as any)[col.key] : null;
        rowValues.push(val !== undefined && val !== null ? val : '');
      });
      const startCol = 'F';
      const endCol = getColumnLetter(4 + summativeCols.length);
      rowValues.push(`=IFERROR(AVERAGE(${startCol}${rowNum}:${endCol}${rowNum}); 0)`);
      summativeRows.push(rowValues);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Nilai Sumatif', summativeRows);

  } catch (err) {
    console.error('Error saving grades:', err);
    throw err;
  }
}

export async function syncClasses(
  accessToken: string,
  spreadsheetId: string,
  classes: { id: number; name: string }[]
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.syncClasses(accessToken, spreadsheetId, classes);
  }

  try {
    const rows = [['ID Kelas', 'Nama Kelas']];
    classes.forEach(c => {
      rows.push([String(c.id), c.name]);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Daftar Kelas', rows);
  } catch (err) {
    console.error('Error syncing classes:', err);
    throw err;
  }
}

export async function downloadExportFile(
  accessToken: string,
  fileId: string,
  format: 'pdf' | 'xlsx'
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.downloadExportFile(accessToken, fileId, format);
  }
  
  const downloadUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=${format}`;
  const fileExtension = format === 'pdf' ? 'pdf' : 'xlsx';
  
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `Laporan_Siswa_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Convert base64 to binary helper
function base64ToBlob(base64: string, mime: string): Blob {
  const byteString = atob(base64.split(',')[1] || base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

export async function uploadStudentPhotoToDrive(
  accessToken: string,
  nis: string,
  base64Image: string
): Promise<string> {
  if (isMockToken(accessToken)) {
    return mockSheets.uploadStudentPhotoToDrive(accessToken, nis, base64Image);
  }

  try {
    // 1. Locate or create "Foto Siswa - App Absensi" folder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        "name='Foto Siswa - App Absensi' and mimeType='application/vnd.google-apps.folder' and trashed=false"
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!searchRes.ok) throw new Error('Failed to query Drive folder');
    const searchData = await searchRes.json();
    
    let folderId = '';
    if (searchData.files && searchData.files.length > 0) {
      folderId = searchData.files[0].id;
    } else {
      const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Foto Siswa - App Absensi',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      if (!createFolderRes.ok) throw new Error('Failed to create Drive folder');
      const createFolderData = await createFolderRes.json();
      folderId = createFolderData.id;
    }

    // 2. Clean up old photos for this NIS
    const oldFilesRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name='photo_${nis}.jpg' and trashed=false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (oldFilesRes.ok) {
      const oldFilesData = await oldFilesRes.json();
      for (const file of oldFilesData.files || []) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      }
    }

    // 3. Create file metadata in Drive
    const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `photo_${nis}.jpg`,
        parents: [folderId]
      })
    });
    if (!metaRes.ok) throw new Error('Failed to create file metadata');
    const fileMeta = await metaRes.json();
    const fileId = fileMeta.id;

    // 4. Upload binary content
    const blob = base64ToBlob(base64Image, 'image/jpeg');
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg'
      },
      body: blob
    });
    if (!uploadRes.ok) throw new Error('Failed to upload file content');

    // 5. Make anyone can read public permissions so `=IMAGE` works
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });

    const url = `https://lh3.googleusercontent.com/d/${fileId}`;
    localStorage.setItem(`student_photo_${nis}`, url);
    return url;
  } catch (err) {
    console.error('Error uploading student photo directly:', err);
    throw err;
  }
}

/**
 * Converts various Google Drive photo link formats into direct and iframe-friendly CDN URLs.
 * Bypasses Chrome/Safari cross-origin iframe and third-party download restrictions.
 */
export function getStudentPhotoUrl(photoUrl: string | undefined): string | undefined {
  if (!photoUrl) return undefined;
  
  if (photoUrl.startsWith('data:image')) {
    return photoUrl;
  }
  
  let fileId = '';
  
  if (photoUrl.includes('drive.google.com') || photoUrl.includes('docs.google.com') || photoUrl.includes('googleusercontent.com')) {
    // Match id=...
    const idMatch = photoUrl.match(/[?&]id=([^&]+)/);
    if (idMatch) {
      fileId = idMatch[1];
    } else {
      // Match /file/d/FILE_ID
      const dMatch = photoUrl.match(/\/file\/d\/([^\/]+)/);
      if (dMatch) {
        fileId = dMatch[1];
      } else {
        // Match /d/FILE_ID
        const dShortMatch = photoUrl.match(/\/d\/([^\/]+)/);
        if (dShortMatch) {
          fileId = dShortMatch[1];
        } else {
          // Match direct /d/ in googleusercontent URL
          const ucdnMatch = photoUrl.match(/\/d\/([^\/]+)/);
          if (ucdnMatch) {
            fileId = ucdnMatch[1];
          }
        }
      }
    }
  }
  
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return photoUrl;
}

export async function ensureSheetExists(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.ensureSheetExists(accessToken, spreadsheetId, sheetName, []);
  }
  
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!metaRes.ok) return;
    const meta = await metaRes.json();
    const existing = (meta.sheets || []).map((s: any) => s.properties?.title || '');
    if (!existing.includes(sheetName)) {
      await setupMissingSheets(accessToken, spreadsheetId, [sheetName], []);
    }
  } catch (e) {
    console.error(`Error in ensureSheetExists for ${sheetName}:`, e);
  }
}

// CBT legacy stubs (unused)
export async function getCbtData(
  accessToken: string,
  spreadsheetId: string
): Promise<{ packages: ExercisePackage[]; assessments: ActiveAssessment[]; submissions: StudentSubmission[]; retakePermissions: RetakePermission[] }> {
  return { packages: [], assessments: [], submissions: [], retakePermissions: [] };
}

export async function syncPackagesToSheets(): Promise<void> { return; }
export async function syncAssessmentsToSheets(): Promise<void> { return; }
export async function saveStudentSubmissionToSheets(): Promise<void> { return; }
export async function getQuestionsAndSubmissions(): Promise<{ questions: Question[]; submissions: StudentSubmission[] }> { return { questions: [], submissions: [] }; }
export async function syncQuestions(): Promise<void> { return; }
export async function saveStudentSubmission(): Promise<void> { return; }
export async function syncRetakePermissionsToSheets(): Promise<void> { return; }

export async function getSpreadsheetSheetTitles(accessToken: string, spreadsheetId: string): Promise<string[]> {
  if (isMockToken(accessToken)) return mockSheets.getSpreadsheetSheetTitles(accessToken, spreadsheetId);
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.sheets || []).map((s: any) => s.properties?.title || '');
  } catch {
    return [];
  }
}

export async function deleteUnusedSheets(): Promise<string[]> { return []; }
export async function getBankSoalQuestions(): Promise<BankSoalQuestion[]> { return []; }
export async function syncBankSoalSubject(): Promise<void> { return; }
export async function getJadwalUjian(): Promise<JadwalUjian[]> { return []; }
export async function syncJadwalUjian(): Promise<void> { return; }

// User logins (Legacy stubs, we now connect only via standard Google login)
export async function ensureLoginSheetExistsAndPopulated(accessToken: string, spreadsheetId: string, students: Student[]): Promise<void> { return; }
export async function getLoginAccounts(accessToken: string, spreadsheetId: string): Promise<any[]> { return []; }
export async function saveLoginAccounts(accessToken: string, spreadsheetId: string, accounts: any[]): Promise<void> { return; }
export async function updateTerakhirLogin(accessToken: string, spreadsheetId: string, username: string): Promise<void> { return; }
export async function ensureHasilUlanganSheetExists(accessToken: string, spreadsheetId: string): Promise<void> { return; }
export async function getHasilUlangan(accessToken: string, spreadsheetId: string): Promise<any[]> { return []; }
export async function saveHasilUlangan(accessToken: string, spreadsheetId: string, result: any): Promise<void> { return; }
export async function syncHasilUlangan(accessToken: string, spreadsheetId: string, results: any[]): Promise<void> { return; }

// Extra TIK Sync Functions
export async function syncExtraTikPeserta(
  accessToken: string,
  spreadsheetId: string,
  peserta: ExtraTikPeserta[]
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.syncExtraTikPeserta(accessToken, spreadsheetId, peserta);
  }
  try {
    const rows = [['NIS', 'Nama', 'Kelas', 'Tanggal Daftar', 'Status']];
    peserta.forEach(p => {
      rows.push([p.nis, p.nama, p.kelas, p.tanggalDaftar, p.status]);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Extra TIK Peserta', rows);
  } catch (err) {
    console.warn('syncExtraTikPeserta REST API failed. Syncing locally.', err);
    return mockSheets.syncExtraTikPeserta(accessToken, spreadsheetId, peserta);
  }
}

export async function syncExtraTikAbsensi(
  accessToken: string,
  spreadsheetId: string,
  absensi: ExtraTikAbsensi[]
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.syncExtraTikAbsensi(accessToken, spreadsheetId, absensi);
  }
  try {
    const headers = [
      'Bulan', 'NIS', 'Nama', 'Kelas',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10',
      'H11', 'H12', 'H13', 'H14', 'H15', 'H16', 'H17', 'H18', 'H19', 'H20',
      'H21', 'H22', 'H23', 'H24', 'H25', 'H26', 'H27', 'H28', 'H29', 'H30', 'H31'
    ];
    const rows: any[][] = [headers];

    // Group records by unique (Bulan, Kelas)
    const classMonths = new Map<string, { bulan: string; kelas: string; records: ExtraTikAbsensi[] }>();
    absensi.forEach(r => {
      if (!r.tanggal || !r.kelas) return;
      const bulan = r.tanggal.substring(0, 7); // YYYY-MM
      const key = `${bulan}|${r.kelas}`;
      if (!classMonths.has(key)) {
        classMonths.set(key, { bulan, kelas: r.kelas, records: [] });
      }
      classMonths.get(key)!.records.push(r);
    });

    classMonths.forEach(({ bulan, kelas, records: monthRecords }) => {
      // Find all unique session dates in this month for this class
      const datesInMonth = new Set<string>();
      monthRecords.forEach(r => {
        datesInMonth.add(r.tanggal);
      });

      // 1. Create the SESSION_MARKER row to track on which days attendance was taken
      const sessionRow: any[] = [
        bulan,
        'SESSION_MARKER',
        'Attendance Session',
        kelas,
        ...Array(31).fill('')
      ];
      datesInMonth.forEach(dateStr => {
        const dayNum = parseInt(dateStr.split('-')[2]);
        if (dayNum >= 1 && dayNum <= 31) {
          sessionRow[3 + dayNum] = 'Y'; // index 3 + dayNum (e.g. Day 1 is index 4)
        }
      });
      rows.push(sessionRow);

      // 2. Group records by student NIS to write their horizontal month history
      const studentRecords = new Map<string, { nis: string; nama: string; records: ExtraTikAbsensi[] }>();
      monthRecords.forEach(r => {
        if (r.nis === 'SESSION_MARKER') return;
        if (!studentRecords.has(r.nis)) {
          studentRecords.set(r.nis, {
            nis: r.nis,
            nama: r.nama,
            records: []
          });
        }
        studentRecords.get(r.nis)!.records.push(r);
      });

      studentRecords.forEach(({ nis, nama, records: sRecords }) => {
        const studentRow: any[] = [
          bulan,
          nis,
          nama,
          kelas,
          ...Array(31).fill('')
        ];

        sRecords.forEach(r => {
          const dayNum = parseInt(r.tanggal.split('-')[2]);
          if (dayNum >= 1 && dayNum <= 31) {
            const isDefaultPresent = r.statusKehadiran === 'Hadir' && (!r.keterangan || r.keterangan.trim() === '');
            if (!isDefaultPresent) {
              const code = r.statusKehadiran === 'Sakit' ? 'S' : r.statusKehadiran === 'Izin' ? 'I' : r.statusKehadiran === 'Alfa' ? 'A' : 'H';
              const cleanRemark = (r.keterangan || '').trim().replace(/\|/g, ' ');
              const cellVal = cleanRemark 
                ? `${code}|${cleanRemark}` 
                : code;
              
              studentRow[3 + dayNum] = cellVal;
            }
          }
        });

        rows.push(studentRow);
      });
    });

    await writeSheetData(accessToken, spreadsheetId, 'Extra TIK Absensi', rows);
  } catch (err) {
    console.warn('syncExtraTikAbsensi REST API failed. Syncing locally.', err);
    return mockSheets.syncExtraTikAbsensi(accessToken, spreadsheetId, absensi);
  }
}

export async function syncExtraTikNilai(
  accessToken: string,
  spreadsheetId: string,
  nilai: ExtraTikNilai[]
): Promise<void> {
  if (isMockToken(accessToken)) {
    return mockSheets.syncExtraTikNilai(accessToken, spreadsheetId, nilai);
  }
  try {
    const rows = [['NIS', 'Nama', 'Kelas', 'Nilai Tugas', 'Nilai Praktik', 'Nilai Teori', 'Rata-rata', 'Predikat']];
    nilai.forEach(n => {
      rows.push([
        n.nis,
        n.nama,
        n.kelas,
        n.nilaiTugas !== null ? String(n.nilaiTugas) : '',
        n.nilaiPraktik !== null ? String(n.nilaiPraktik) : '',
        n.nilaiTeori !== null ? String(n.nilaiTeori) : '',
        n.rataRata !== null ? String(n.rataRata) : '',
        n.predikat
      ]);
    });
    await writeSheetData(accessToken, spreadsheetId, 'Extra TIK Nilai', rows);
  } catch (err) {
    console.warn('syncExtraTikNilai REST API failed. Syncing locally.', err);
    return mockSheets.syncExtraTikNilai(accessToken, spreadsheetId, nilai);
  }
}
