import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Student, AttendanceRecord, GradeFormative, GradeSummative, StudentNote, SpreadsheetInfo } from '../types';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  HelpCircle, 
  Loader2, 
  Printer, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  Calendar, 
  User, 
  BookOpen, 
  Settings,
  X,
  FileSpreadsheet,
  Award,
  ChevronDown,
  GraduationCap,
  CheckSquare,
  Users
} from 'lucide-react';

interface ExportTabProps {
  connectedSpreadsheet: SpreadsheetInfo | null;
  onDownloadFile: (format: 'pdf' | 'xlsx') => Promise<void>;
  students: Student[];
  attendance: AttendanceRecord[];
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  notes: StudentNote[];
  activeClassName: string;
}

export default function ExportTab({ 
  connectedSpreadsheet, 
  onDownloadFile,
  students = [],
  attendance = [],
  formativeGrades = [],
  summativeGrades = [],
  notes = [],
  activeClassName = 'Kelas 8.1'
}: ExportTabProps) {
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'xlsx' | null>(null);
  
  // Customizer state for printable report
  const [kepalaSekolah, setKepalaSekolah] = useState<string>('Dra. H. Siti Maryam, M.Pd.');
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState<string>('19740812 199903 2 001');
  const [waliKelas, setWaliKelas] = useState<string>('Ahmad Rosadi, S.Pd.');
  const [nipWaliKelas, setNipWaliKelas] = useState<string>('19850615 201101 1 003');
  const [tahunAjaran, setTahunAjaran] = useState<string>('2026/2027');
  const [semester, setSemester] = useState<string>('Ganjil');
  const [tanggalLaporan, setTanggalLaporan] = useState<string>(
    new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  );

  // Layout selection states
  const [includePresensi, setIncludePresensi] = useState<boolean>(true);
  const [includeNilai, setIncludeNilai] = useState<boolean>(true);
  const [includeCatatan, setIncludeCatatan] = useState<boolean>(true);

  // Status Alerts
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Handle Google Drive Download fallback if iframe blocks
  const handleDriveDownload = async (format: 'pdf' | 'xlsx') => {
    if (!connectedSpreadsheet) return;
    setDownloadingFormat(format);
    setErrorMessage('');
    setSuccessMessage('');

    if (format === 'pdf') {
      // Temporary patch for oklch colors in parent document styles to prevent html2canvas parsing crashes
      const styleBackups: { element: HTMLStyleElement; originalText: string }[] = [];
      const styleTags = document.querySelectorAll('style');
      styleTags.forEach((tag) => {
        if (tag.textContent && tag.textContent.includes('oklch')) {
          styleBackups.push({ element: tag, originalText: tag.textContent });
          // Replace oklch(...) with solid fallback color strings so the parser does not fail
          tag.textContent = tag.textContent.replace(/oklch\([^)]+\)/g, 'rgb(100, 116, 139)');
        }
      });

      try {
        const element = document.getElementById('printable-report-sheet');
        if (!element) {
          throw new Error('Elemen laporan tidak ditemukan.');
        }

        // Generate the canvas from the HTML element
        const canvas = await html2canvas(element, {
          scale: 2, // Double resolution for ultra-sharp text and graphics
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true,
          onclone: (clonedDoc) => {
            // 1. Clean all `<style>` tags in the cloned document to avoid html2canvas stylesheet parsing errors
            const clonedStyles = clonedDoc.querySelectorAll('style');
            clonedStyles.forEach(tag => {
              if (tag.textContent && tag.textContent.includes('oklch')) {
                tag.textContent = tag.textContent.replace(/oklch\([^)]+\)/g, 'rgb(100, 110, 120)');
              }
            });

            // 2. Remove box shadow, borders and round corners from the cloned container for flat document styling
            const clonedSheet = clonedDoc.getElementById('printable-report-sheet');
            if (clonedSheet) {
              clonedSheet.style.boxShadow = 'none';
              clonedSheet.style.borderRadius = '0';
              clonedSheet.style.border = 'none';
              clonedSheet.style.backgroundColor = '#ffffff';
            }

            // 3. Create a 1x1 canvas to resolve oklch colors using browser's native engine
            const helperCanvas = clonedDoc.createElement('canvas');
            helperCanvas.width = 1;
            helperCanvas.height = 1;
            const helperCtx = helperCanvas.getContext('2d');
            
            const resolveColor = (colorStr: string): string => {
              if (!colorStr || !colorStr.includes('oklch')) return colorStr;
              if (!helperCtx) return colorStr;
              try {
                helperCtx.fillStyle = colorStr;
                return helperCtx.fillStyle;
              } catch (e) {
                return 'rgb(100, 110, 120)';
              }
            };

            // 4. Traverse all elements in the cloned document and replace oklch computed styles and inline style attributes
            const elements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              if (!el) continue;

              // Clean direct inline style attributes
              if (el.getAttribute && el.getAttribute('style')) {
                const inlineStyle = el.getAttribute('style') || '';
                if (inlineStyle.includes('oklch')) {
                  el.setAttribute('style', inlineStyle.replace(/oklch\([^)]+\)/g, 'rgb(100, 110, 120)'));
                }
              }

              if (!el.style) continue;

              const computed = window.getComputedStyle(el);
              const props = [
                'color',
                'backgroundColor',
                'borderColor',
                'borderTopColor',
                'borderBottomColor',
                'borderLeftColor',
                'borderRightColor',
                'outlineColor',
                'fill',
                'stroke'
              ];

              for (const prop of props) {
                try {
                  const val = computed[prop as any];
                  if (val && val.includes('oklch')) {
                    const resolved = resolveColor(val);
                    if (resolved && !resolved.includes('oklch')) {
                      el.style[prop as any] = resolved;
                    } else {
                      el.style[prop as any] = 'rgb(100, 110, 120)';
                    }
                  }
                } catch (e) {
                  // Ignore any access errors for computed properties
                }
              }
            }

            // 5. Remove/clean any style rule from clonedDoc stylesheets containing 'oklch'
            const sheets = clonedDoc.styleSheets;
            for (let i = 0; i < sheets.length; i++) {
              const sheet = sheets[i];
              try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) continue;
                for (let j = rules.length - 1; j >= 0; j--) {
                  const rule = rules[j];
                  if (rule.cssText && rule.cssText.includes('oklch')) {
                    sheet.deleteRule(j);
                  }
                }
              } catch (e) {
                // Ignore security/cross-origin access errors
              }
            }
          }
        });

        const W = canvas.width;
        const H = canvas.height;
        const scale = W / 210; // pixels per mm

        // A4 page dimensions in mm (Portrait)
        const pageHeightMm = 297;
        const topMarginMm = 15;
        const bottomMarginMm = 15;
        const maxContentHeightMm = pageHeightMm - topMarginMm - bottomMarginMm; // 267mm

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        let y_start_px = 0;
        let spanCount = 0;
        let pdfPageCounter = 1;

        while (y_start_px < H) {
          let y_end_px = H;
          let isLastSlice = false;

          // Determine maximum possible end pixel for this slice
          const maxSliceHeightMm = (spanCount === 0) ? (pageHeightMm - bottomMarginMm) : maxContentHeightMm;
          const maxSliceHeightPx = Math.floor(maxSliceHeightMm * scale);

          if (y_start_px + maxSliceHeightPx >= H) {
            y_end_px = H;
            isLastSlice = true;
          } else {
            // We need to find a split point in the range [y_start + maxSliceHeight - 45mm, y_start + maxSliceHeight]
            // This gives a 45mm search range to find a blank line or a table row gap
            const searchRangeMinPx = y_start_px + Math.floor((maxSliceHeightMm - 45) * scale);
            const searchRangeMaxPx = y_start_px + maxSliceHeightPx;

            let foundSplit = false;
            let bestSplitPx = searchRangeMaxPx;

            const ctx = canvas.getContext('2d');
            if (ctx) {
              const stripHeight = searchRangeMaxPx - searchRangeMinPx;
              if (stripHeight > 0) {
                const imgData = ctx.getImageData(0, searchRangeMinPx, W, stripHeight);
                const data = imgData.data;

                let minContentCount = W;
                let bestR = -1;

                for (let r = stripHeight - 1; r >= 0; r--) {
                  let contentCount = 0;
                  for (let c = 0; c < W; c++) {
                    const idx = (r * W + c) * 4;
                    const rVal = data[idx];
                    const gVal = data[idx + 1];
                    const bVal = data[idx + 2];
                    const aVal = data[idx + 3];
                    if (aVal > 0) {
                      // Check for average brightness less than 225 (detects text/borders and dark accents)
                      const brightness = (rVal + gVal + bVal) / 3;
                      if (brightness < 225) {
                        contentCount++;
                      }
                    }
                  }

                  // If we find a completely white/background row (contentCount === 0), it's the best split point!
                  if (contentCount === 0) {
                    bestSplitPx = searchRangeMinPx + r;
                    foundSplit = true;
                    break;
                  }

                  // Otherwise, record the row with the absolute minimum content count
                  if (contentCount < minContentCount) {
                    minContentCount = contentCount;
                    bestR = r;
                  }
                }

                if (!foundSplit && bestR !== -1) {
                  // A row representing a gap between table rows will only have vertical lines
                  // which typically account for less than 3% of the width.
                  // We set the threshold at 8% of the width to be very safe and robust.
                  const maxAllowedContentCols = Math.floor(W * 0.08);
                  if (minContentCount <= maxAllowedContentCols) {
                    bestSplitPx = searchRangeMinPx + bestR;
                    foundSplit = true;
                  }
                }
              }
            }

            y_end_px = bestSplitPx;
          }

          // Create temporary canvas for this slice
          const sliceHeightPx = y_end_px - y_start_px;
          if (sliceHeightPx > 0) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = W;
            tempCanvas.height = sliceHeightPx;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.drawImage(
                canvas,
                0, y_start_px, W, sliceHeightPx, // source
                0, 0, W, sliceHeightPx // destination
              );
            }

            const croppedImgData = tempCanvas.toDataURL('image/jpeg', 0.95);
            const sliceHeightMm = sliceHeightPx / scale;

            if (pdfPageCounter > 1) {
              pdf.addPage();
            }

            const yPdfPos = (spanCount === 0) ? 0 : topMarginMm;
            pdf.addImage(croppedImgData, 'JPEG', 0, yPdfPos, 210, sliceHeightMm);

            spanCount++;
            pdfPageCounter++;
          }

          y_start_px = y_end_px;
        }

        const sanitizedClassName = activeClassName.replace(/[^a-zA-Z0-9]/g, '_');
        pdf.save(`Laporan_Evaluasi_Siswa_${sanitizedClassName}.pdf`);
        
        setSuccessMessage(`Ekspor PDF berhasil diunduh secara instan!`);
        setTimeout(() => setSuccessMessage(''), 4000);
      } catch (err: any) {
        console.error(err);
        setErrorMessage(
          `Gagal merender PDF lokal: ${err.message || err}. Silakan gunakan tombol "Cetak PDF Resmi" atau hubungi administrator.`
        );
      } finally {
        // Restore styles immediately to ensure main layout has original style configuration
        styleBackups.forEach(({ element, originalText }) => {
          element.textContent = originalText;
        });
        setDownloadingFormat(null);
      }
    } else {
      try {
        await onDownloadFile(format);
        setSuccessMessage(`Ekspor ${format.toUpperCase()} via Google Drive berhasil diproses!`);
        setTimeout(() => setSuccessMessage(''), 4000);
      } catch (err: any) {
        console.error(err);
        setErrorMessage(
          `Gagal mengunduh langsung dari iframe. Hal ini lumrah terjadi karena batasan keamanan browser.`
        );
      } finally {
        setDownloadingFormat(null);
      }
    }
  };

  // Calculate statistics helper for students
  const getStudentStats = (studentNis: string) => {
    // 1. Attendance Counts
    const studentAttendance = attendance.filter(a => a.nis === studentNis);
    const presentCount = studentAttendance.filter(a => ['Hadir', 'H', 'hadir'].includes(a.status)).length;
    const sickCount = studentAttendance.filter(a => ['Sakit', 'S', 'sakit'].includes(a.status)).length;
    const permissionCount = studentAttendance.filter(a => ['Izin', 'I', 'izin'].includes(a.status)).length;
    const absentCount = studentAttendance.filter(a => ['Alfa', 'A', 'alfa'].includes(a.status)).length;
    const totalDays = presentCount + sickCount + permissionCount + absentCount;
    const attendancePercent = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 100;

    // 2. Formative Grades
    const fGrade = formativeGrades.find(f => f.nis === studentNis);
    const avgFormative = fGrade?.rataRata !== undefined && fGrade?.rataRata !== null ? fGrade.rataRata : 80;

    // 3. Summative Grades
    const sGrade = summativeGrades.find(s => s.nis === studentNis);
    const avgSummative = sGrade?.rataRata !== undefined && sGrade?.rataRata !== null ? sGrade.rataRata : 78;

    // 4. Combined Final Grade (60% Formatif + 40% Sumatif)
    const finalGrade = Math.round((avgFormative * 0.6) + (avgSummative * 0.4));

    // Predikat
    let predikat = 'C';
    let keterangan = 'Perlu Bimbingan';
    if (finalGrade >= 85) {
      predikat = 'A';
      keterangan = 'Sangat Baik (Tuntas)';
    } else if (finalGrade >= 75) {
      predikat = 'B';
      keterangan = 'Baik (Tuntas)';
    } else if (finalGrade >= 60) {
      predikat = 'C';
      keterangan = 'Cukup (Tuntas)';
    } else {
      predikat = 'D';
      keterangan = 'Kurang (Perlu Perbaikan)';
    }

    // 5. Jurnal Notes
    const studentNotes = notes.filter(n => n.nis === studentNis);
    const activeNotes = studentNotes.filter(n => n.tipe === 'aktif');
    const problemNotes = studentNotes.filter(n => n.tipe === 'bermasalah');

    return {
      presentCount,
      sickCount,
      permissionCount,
      absentCount,
      totalDays,
      attendancePercent,
      avgFormative,
      avgSummative,
      finalGrade,
      predikat,
      keterangan,
      activeNotes,
      problemNotes,
      studentNotes
    };
  };

  const handlePrint = () => {
    window.print();
  };

  if (!connectedSpreadsheet) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs text-center text-slate-500 font-bold text-sm max-w-xl mx-auto my-12">
        <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        Silakan hubungkan spreadsheet database terlebih dahulu untuk dapat menggunakan fitur ekspor laporan.
      </div>
    );
  }

  return (
    <div id="export-section" className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 print:hidden">
        <div className="space-y-1.5 text-center md:text-left">
          <h3 className="text-lg font-black tracking-tight flex items-center gap-2 justify-center md:justify-start">
            🖨️ Pusat Cetak Laporan & Jurnal Kelas
          </h3>
          <p className="text-slate-300 text-xs max-w-xl leading-relaxed">
            Mesin pelaporan otomatis yang memadukan data presensi, rata-rata nilai akademik (Formatif/Sumatif), dan log Catatan Siswa harian menjadi dokumen PDF formal siap pakai.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <a
            href={connectedSpreadsheet.url}
            target="_blank"
            referrerPolicy="no-referrer"
            rel="noopener noreferrer"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            Spreadsheet Utama ↗
          </a>
        </div>
      </div>

      {/* 2. Main Interface split into Configuration (Left) and Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Controls & Config (Hides during printing) */}
        <div className="space-y-6 lg:col-span-4 print:hidden">
          
          {/* Config Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <h4 className="font-extrabold text-slate-800 text-xs tracking-wider uppercase flex items-center gap-2 pb-3 border-b border-slate-100">
              <Settings className="w-4 h-4 text-indigo-500" /> Kredensial Laporan
            </h4>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nama Guru Mata Pelajaran
                </label>
                <input
                  type="text"
                  value={waliKelas}
                  onChange={e => setWaliKelas(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  NIP Guru Mata Pelajaran
                </label>
                <input
                  type="text"
                  value={nipWaliKelas}
                  onChange={e => setNipWaliKelas(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-600"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nama Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={kepalaSekolah}
                  onChange={e => setKepalaSekolah(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  NIP Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={nipKepalaSekolah}
                  onChange={e => setNipKepalaSekolah(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Tahun Ajaran
                  </label>
                  <input
                    type="text"
                    value={tahunAjaran}
                    onChange={e => setTahunAjaran(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={semester}
                    onChange={e => setSemester(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tanggal Laporan
                </label>
                <input
                  type="text"
                  value={tanggalLaporan}
                  onChange={e => setTanggalLaporan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Report Sections Config Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-extrabold text-slate-800 text-xs tracking-wider uppercase flex items-center gap-2 pb-3 border-b border-slate-100">
              📂 Bagian Dokumen
            </h4>
            <div className="space-y-3.5 text-xs font-semibold text-slate-700">
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={includePresensi}
                  onChange={e => setIncludePresensi(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                />
                <span>Tabel I: Rekapitulasi Presensi</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={includeNilai}
                  onChange={e => setIncludeNilai(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                />
                <span>Tabel II: Nilai & Predikat Akademik</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={includeCatatan}
                  onChange={e => setIncludeCatatan(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                />
                <span>Bagian III: Jurnal Karakter Siswa</span>
              </label>
            </div>
          </div>

          {/* Trigger Print Button */}
          <button
            onClick={handlePrint}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5"
          >
            <Printer className="w-5 h-5" />
            Cetak PDF Resmi (Presisi)
          </button>

          {/* Backup Google Drive Exporter */}
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
            <div>
              <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Ekspor Alternatif (Spreadsheet)</h5>
              <p className="text-[10px] text-slate-400 leading-normal mt-1">
                Jika membutuhkan file master mentah, Anda dapat menarik data langsung dari Drive server.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-[10px] font-bold space-y-1.5 leading-relaxed">
                <div className="flex gap-1.5 items-center">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span>Sistem Iframe Membatasi Blob</span>
                </div>
                <p className="font-medium text-slate-500">
                  {errorMessage} silakan gunakan tombol <strong>"Cetak PDF Resmi"</strong> di atas atau buka di tab baru dengan tombol di bawah.
                </p>
                <div className="pt-1.5">
                  <a
                    href={connectedSpreadsheet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold transition uppercase tracking-wider text-[9px] cursor-pointer"
                  >
                    Buka Spreadsheet Baru ↗
                  </a>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-bold flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleDriveDownload('xlsx')}
                disabled={downloadingFormat !== null}
                className="py-2 px-3 bg-white hover:bg-slate-100 disabled:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-1.5 text-[11px] cursor-pointer shadow-2xs"
              >
                {downloadingFormat === 'xlsx' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-indigo-500" />
                    Unduh .XLSX
                  </>
                )}
              </button>

              <button
                onClick={() => handleDriveDownload('pdf')}
                disabled={downloadingFormat !== null}
                className="py-2 px-3 bg-white hover:bg-slate-100 disabled:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-1.5 text-[11px] cursor-pointer shadow-2xs"
              >
                {downloadingFormat === 'pdf' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-rose-500" />
                    Unduh .PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Print Report Sheet (Simulated A4 Paper Layout) */}
        <div className="lg:col-span-8 bg-slate-100/50 p-3 sm:p-6 rounded-3xl border border-slate-200 overflow-x-auto print:p-0 print:m-0 print:border-none print:bg-white print:w-full">
          <div id="printable-report-sheet" className="bg-white p-6 sm:p-12 border border-slate-200 rounded-2xl shadow-xl max-w-[210mm] min-h-[297mm] mx-auto text-slate-800 font-sans leading-relaxed text-xs relative select-text print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none">
            
            {/* Top Premium Color Stripe */}
            <div className="h-2 w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-500 rounded-t-lg -mt-6 sm:-mt-12 -mx-6 sm:-mx-12 mb-6 sm:mb-8" />

            {/* Kop Surat Sekolah / Header */}
            <div className="flex items-center gap-4 border-b-2 border-slate-800 pb-5 mb-6 relative">
              {/* Logo / Badge Emblem Placeholder */}
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl border-2 border-indigo-600 bg-indigo-50 flex items-center justify-center text-indigo-700 shadow-xs">
                <GraduationCap className="w-10 h-10 stroke-[2]" />
              </div>
              
              <div className="flex-1 text-left">
                <span className="text-[9px] font-extrabold tracking-widest text-indigo-600 uppercase block font-sans">
                  SISTEM ADMINISTRASI EVALUASI BELAJAR RESMI
                </span>
                <h2 className="text-sm font-black tracking-wide uppercase text-slate-900 mt-0.5">
                  PEMERINTAH KOTA ADMINISTRASI PENDIDIKAN
                </h2>
                <h1 className="text-base font-black tracking-wider uppercase text-slate-900">
                  DINAS PENDIDIKAN DAN KEBUDAYAAN SMP NEGERI
                </h1>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-snug">
                  Jl. Pendidikan Luhur No. 23, Sektor V, Jakarta Raya • Telp: (021) 555-8291 • Email: info@kemdikbud.go.id
                </p>
              </div>
              
              {/* Secondary Emblem */}
              <div className="hidden sm:flex flex-shrink-0 w-12 h-12 rounded-full border border-emerald-500 bg-emerald-50 items-center justify-center text-emerald-600">
                <Award className="w-7 h-7" />
              </div>
            </div>

            {/* Document Title & Number */}
            <div className="text-center space-y-1 mb-8">
              <h3 className="text-sm font-black tracking-wider uppercase text-slate-900">
                LAPORAN REKAPITULASI EVALUASI & KARAKTER SISWA
              </h3>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[9px] font-extrabold text-slate-600 uppercase tracking-widest">
                <span>Tahun Pelajaran: {tahunAjaran}</span>
                <span className="w-1 h-1 rounded-full bg-slate-400" />
                <span>Semester: {semester}</span>
              </div>
            </div>

            {/* Document Metadata Cards Grid */}
            <div className="grid grid-cols-2 gap-4 text-[10px] mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <div className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Informasi Lembaga
                </div>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between border-b border-slate-200/50 pb-1">
                    <span className="text-slate-400 font-medium">Satuan Pendidikan</span>
                    <span className="font-bold text-slate-800">SMP Negeri Administrasi</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1">
                    <span className="text-slate-400 font-medium">Roster / Rombel</span>
                    <span className="font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">{activeClassName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Total Peserta Didik</span>
                    <span className="font-bold text-slate-800">{students.length} Siswa</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <div className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Otorisasi Dokumen
                </div>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between border-b border-slate-200/50 pb-1">
                    <span className="text-slate-400 font-medium">Wali Kelas</span>
                    <span className="font-bold text-slate-800">{waliKelas}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1">
                    <span className="text-slate-400 font-medium">NIP Wali Kelas</span>
                    <span className="font-bold text-slate-800">{nipWaliKelas || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Tanggal Penerbitan</span>
                    <span className="font-bold text-slate-800">{tanggalLaporan}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL I: PRESENSI */}
            {includePresensi && (
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                  <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg">
                    <CheckSquare className="w-4 h-4" />
                  </span>
                  <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                    Bagian I: Rekapitulasi Presensi / Kehadiran Siswa
                  </h4>
                </div>
                
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-wider">
                        <th className="p-2.5 text-center w-16">No. Absen</th>
                        <th className="p-2.5 w-24">NIS</th>
                        <th className="p-2.5">Nama Siswa</th>
                        <th className="p-2.5 text-center w-14">Hadir</th>
                        <th className="p-2.5 text-center w-14">Sakit</th>
                        <th className="p-2.5 text-center w-14">Izin</th>
                        <th className="p-2.5 text-center w-14 text-rose-300">Alfa</th>
                        <th className="p-2.5 text-center w-24">Persentase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((student, idx) => {
                        const stats = getStudentStats(student.nis);
                        return (
                          <tr key={student.nis} className="hover:bg-slate-50/50 transition-colors odd:bg-white even:bg-slate-50/20">
                            <td className="p-2.5 text-center text-slate-500 font-mono font-bold">{student.noAbsen || (idx + 1)}</td>
                            <td className="p-2.5 font-mono text-slate-600 font-bold">{student.nis}</td>
                            <td className="p-2.5 font-bold text-slate-900">{student.nama}</td>
                            <td className="p-2.5 text-center font-semibold text-slate-700">{stats.presentCount}</td>
                            <td className="p-2.5 text-center font-semibold text-yellow-600">{stats.sickCount}</td>
                            <td className="p-2.5 text-center font-semibold text-blue-600">{stats.permissionCount}</td>
                            <td className="p-2.5 text-center font-black text-rose-600">{stats.absentCount}</td>
                            <td className="p-2.5 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full font-black text-[9px] ${
                                stats.attendancePercent < 80 
                                  ? 'bg-rose-50 text-rose-700' 
                                  : stats.attendancePercent < 90 
                                  ? 'bg-amber-50 text-amber-700' 
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {stats.attendancePercent}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABEL II: NILAI AKADEMIK */}
            {includeNilai && (
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                  <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </span>
                  <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                    Bagian II: Rekapitulasi Penilaian Hasil Belajar Akademik
                  </h4>
                </div>

                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-wider">
                        <th className="p-2.5 text-center w-16">No. Absen</th>
                        <th className="p-2.5 w-24">NIS</th>
                        <th className="p-2.5">Nama Siswa</th>
                        <th className="p-2.5 text-center w-20">Formatif</th>
                        <th className="p-2.5 text-center w-20">Sumatif</th>
                        <th className="p-2.5 text-center w-20 bg-indigo-900 text-indigo-100">Nilai Akhir</th>
                        <th className="p-2.5 text-center w-16">Predikat</th>
                        <th className="p-2.5 w-36">Evaluasi Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((student, idx) => {
                        const stats = getStudentStats(student.nis);
                        return (
                          <tr key={student.nis} className="hover:bg-slate-50/50 transition-colors odd:bg-white even:bg-slate-50/20">
                            <td className="p-2.5 text-center text-slate-500 font-mono font-bold">{student.noAbsen || (idx + 1)}</td>
                            <td className="p-2.5 font-mono text-slate-600 font-bold">{student.nis}</td>
                            <td className="p-2.5 font-bold text-slate-900">{student.nama}</td>
                            <td className="p-2.5 text-center font-semibold text-slate-600">{stats.avgFormative}</td>
                            <td className="p-2.5 text-center font-semibold text-slate-600">{stats.avgSummative}</td>
                            <td className="p-2.5 text-center font-extrabold bg-indigo-50/50 text-indigo-950 text-[11px]">{stats.finalGrade}</td>
                            <td className="p-2.5 text-center font-black text-slate-800">{stats.predikat}</td>
                            <td className="p-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded font-black text-[8px] uppercase tracking-wider border ${
                                stats.finalGrade >= 75
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                  : 'bg-rose-50 text-rose-800 border-rose-100'
                              }`}>
                                {stats.keterangan}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABEL III: CATATAN SISWA & JURNAL KEPRIBADIAN */}
            {includeCatatan && (
              <div className="space-y-3 mb-8 page-break-before">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                  <span className="p-1 bg-amber-50 text-amber-600 rounded-lg">
                    <Users className="w-4 h-4" />
                  </span>
                  <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                    Bagian III: Jurnal Karakter & Catatan Keaktifan Harian
                  </h4>
                </div>
                
                {notes.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
                    Tidak ditemukan data catatan jurnal karakter harian untuk kelas ini.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[9px] text-slate-500 leading-normal font-medium">
                      Berikut rekapitulasi data keaktifan (siswa aktif) dan kendala perilaku (siswa bermasalah) harian yang diinput sebagai pertimbangan penilaian sikap karakter:
                    </p>
                    
                    <div className="overflow-hidden border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-[10px] border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-wider">
                            <th className="p-2.5 text-center w-10">No</th>
                            <th className="p-2.5 w-32">Waktu / Jam</th>
                            <th className="p-2.5 w-44">Siswa</th>
                            <th className="p-2.5 w-28 text-center">Klasifikasi</th>
                            <th className="p-2.5">Isi Catatan Peristiwa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {notes.map((n, idx) => (
                            <tr key={n.id} className="hover:bg-slate-50/50 transition-colors odd:bg-white even:bg-slate-50/20 items-start align-top">
                              <td className="p-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                              <td className="p-2.5">
                                <span className="font-extrabold text-slate-800 block">{n.tanggal}</span>
                                <span className="text-[8px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded inline-block mt-0.5">{n.jamPembelajaran}</span>
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(() => {
                                    const studentObj = students.find(s => s.nis === n.nis);
                                    return studentObj?.noAbsen && (
                                      <span className="px-1 py-0.2 bg-indigo-50 border border-indigo-100 rounded text-indigo-700 font-mono font-extrabold text-[8px] shrink-0">
                                        No. {studentObj.noAbsen}
                                      </span>
                                    );
                                  })()}
                                  <span className="font-bold text-slate-900 block">{n.nama}</span>
                                </div>
                                <span className="text-[8px] text-slate-400 font-mono">NIS: {n.nis}</span>
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                                  n.tipe === 'aktif'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                    : 'bg-rose-50 text-rose-800 border border-rose-100'
                                }`}>
                                  {n.tipe === 'aktif' ? '🌟 Aktif' : '⚠️ Kendala'}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600 italic leading-relaxed text-[9.5px]">
                                "{n.catatan}"
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Signatures / Tanda Tangan */}
            <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 text-[10px]">
              <div className="space-y-16">
                <div className="space-y-1">
                  <p className="text-slate-500 font-medium">Mengetahui,</p>
                  <p className="font-extrabold text-slate-900">Kepala Sekolah SMP Negeri Administrasi</p>
                </div>
                <div className="space-y-0.5 relative">
                  {/* Decorative stamp watermark behind principal signature */}
                  <div className="absolute -top-10 left-6 w-24 h-24 rounded-full border-4 border-double border-indigo-200/40 flex items-center justify-center -rotate-12 pointer-events-none">
                    <div className="text-[8px] font-bold text-indigo-300/40 text-center tracking-widest uppercase leading-snug">
                      SMP NEGERI<br />ADMINISTRASI<br />★ RESMI ★
                    </div>
                  </div>
                  <p className="font-black text-slate-900 underline text-xs">{kepalaSekolah}</p>
                  <p className="text-slate-400 text-[9px] font-bold">NIP. {nipKepalaSekolah || '-'}</p>
                </div>
              </div>

              <div className="space-y-16 text-right">
                <div className="space-y-1">
                  <p className="text-slate-500 font-medium">Ditetapkan di Jakarta, {tanggalLaporan}</p>
                  <p className="font-extrabold text-slate-900">Guru Mata Pelajaran {activeClassName}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="font-black text-slate-900 underline text-xs">{waliKelas}</p>
                  <p className="text-slate-400 text-[9px] font-bold">NIP. {nipWaliKelas || '-'}</p>
                </div>
              </div>
            </div>

            {/* Official Stamps Placeholder / Watermark */}
            <div className="mt-12 pt-4 border-t border-slate-100 text-center text-[8px] text-slate-400 font-mono tracking-widest uppercase">
              Dokumen ini dihasilkan secara otomatis oleh sistem evaluasi akademik resmi terintegrasi.
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
