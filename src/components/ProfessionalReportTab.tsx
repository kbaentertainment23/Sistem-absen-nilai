import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Student, 
  GradeFormative, 
  GradeSummative, 
  MonthlyRecap, 
  GradeColumn, 
  StudentNote 
} from '../types';
import { 
  FileText, 
  Settings, 
  Printer, 
  Download, 
  Check, 
  AlertCircle, 
  Info, 
  Building, 
  MapPin, 
  Phone, 
  User, 
  Calendar, 
  Palette, 
  Layout, 
  Eye, 
  Sparkles,
  Award,
  CheckSquare,
  Square,
  Upload,
  Trash
} from 'lucide-react';

interface ProfessionalReportTabProps {
  students: Student[];
  formativeGrades: GradeFormative[];
  summativeGrades: GradeSummative[];
  recap: MonthlyRecap[];
  formativeCols: GradeColumn[];
  summativeCols: GradeColumn[];
  notes: StudentNote[];
  activeClassName: string;
}

type ReportType = 'collective' | 'individual';
type ThemeColor = 'indigo' | 'slate' | 'emerald' | 'rose' | 'amber' | 'cyan';

const compressLogo = (base64Str: string, callback: (compressedStr: string) => void) => {
  const img = new Image();
  img.src = base64Str;
  img.onload = () => {
    const MAX_WIDTH = 200;
    const MAX_HEIGHT = 200;
    let width = img.width;
    let height = img.height;

    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      if (width > height) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      } else {
        width = Math.round((width * MAX_HEIGHT) / height);
        height = MAX_HEIGHT;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/png'));
    } else {
      callback(base64Str);
    }
  };
  img.onerror = () => {
    callback(base64Str);
  };
};

export default function ProfessionalReportTab({
  students,
  formativeGrades,
  summativeGrades,
  recap,
  formativeCols,
  summativeCols,
  notes,
  activeClassName
}: ProfessionalReportTabProps) {
  // Report Config States
  const [reportType, setReportType] = useState<ReportType>('collective');
  const [includeAttendance, setIncludeAttendance] = useState<boolean>(true);
  const [includeGrades, setIncludeGrades] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);
  const [themeColor, setThemeColor] = useState<ThemeColor>('indigo');
  
  // Custom official headers (Kop Surat)
  const [govName, setGovName] = useState('PEMERINTAH KABUPATEN / KOTA ADMINISTRATIF');
  const [deptName, setDeptName] = useState('DINAS PENDIDIKAN, KEPEMUDAAN, DAN OLAHRAGA');
  const [schoolName, setSchoolName] = useState('SMP NEGERI INDONESIA HEBAT');
  const [schoolAddress, setSchoolAddress] = useState('Jl. Pendidikan Luhur No. 88, Kota Harapan Bangsa');
  const [schoolPhone, setSchoolPhone] = useState('Telepon: (021) 7654321 | Email: info@smpnindonesia.sch.id');

  // Custom logo states with local persistence
  const [logoKiri, setLogoKiri] = useState<string | null>(() => {
    try {
      return localStorage.getItem('custom_report_logo_kiri');
    } catch (err) {
      console.warn('Failed to read logoKiri from localStorage:', err);
      return null;
    }
  });
  const [logoKanan, setLogoKanan] = useState<string | null>(() => {
    try {
      return localStorage.getItem('custom_report_logo_kanan');
    } catch (err) {
      console.warn('Failed to read logoKanan from localStorage:', err);
      return null;
    }
  });

  const handleLogoKiriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultStr = reader.result as string;
        compressLogo(resultStr, (compressedStr) => {
          setLogoKiri(compressedStr);
          try {
            localStorage.setItem('custom_report_logo_kiri', compressedStr);
          } catch (err) {
            console.error('Quota exceeded or failed to save custom_report_logo_kiri to localStorage:', err);
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoKananChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultStr = reader.result as string;
        compressLogo(resultStr, (compressedStr) => {
          setLogoKanan(compressedStr);
          try {
            localStorage.setItem('custom_report_logo_kanan', compressedStr);
          } catch (err) {
            console.error('Quota exceeded or failed to save custom_report_logo_kanan to localStorage:', err);
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogoKiri = () => {
    setLogoKiri(null);
    try {
      localStorage.removeItem('custom_report_logo_kiri');
    } catch (err) {
      console.error('Failed to remove custom_report_logo_kiri from localStorage:', err);
    }
  };

  const removeLogoKanan = () => {
    setLogoKanan(null);
    try {
      localStorage.removeItem('custom_report_logo_kanan');
    } catch (err) {
      console.error('Failed to remove custom_report_logo_kanan from localStorage:', err);
    }
  };

  // Signature Configs
  const [cityName, setCityName] = useState('Jakarta');
  const [teacherName, setTeacherName] = useState('Dra. Riana Amalia, M.Pd.');
  const [teacherNip, setTeacherNip] = useState('NIP. 19780516 200501 2 003');
  const [headmasterName, setHeadmasterName] = useState('Drs. Hermawan Prasetyo, M.Si.');
  const [headmasterNip, setHeadmasterNip] = useState('NIP. 19710814 199803 1 001');

  // Academic Meta Options
  const [semester, setSemester] = useState('Semester Ganjil (Semester 1)');
  const [academicYear, setAcademicYear] = useState('2026/2027');

  // Individual student filter
  const [selectedStudentNis, setSelectedStudentNis] = useState<string>('all');

  // PDF processing state
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  const previewRef = useRef<HTMLDivElement>(null);

  // Helper to calculate average from non-null values dynamically
  const calculateAvg = (scores: (number | null)[]): number => {
    const validScores = scores.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
    if (validScores.length === 0) return 0;
    const total = validScores.reduce((acc, curr) => acc + curr, 0);
    return parseFloat((total / validScores.length).toFixed(1));
  };

  const getThemeClasses = (type: 'bg' | 'text' | 'border' | 'accent' | 'headerBg') => {
    switch (themeColor) {
      case 'indigo':
        return {
          bg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          text: 'text-indigo-600',
          border: 'border-indigo-200',
          accent: 'indigo',
          headerBg: 'bg-indigo-50 text-indigo-950'
        }[type];
      case 'slate':
        return {
          bg: 'bg-slate-800 hover:bg-slate-900 text-white',
          text: 'text-slate-800',
          border: 'border-slate-300',
          accent: 'slate',
          headerBg: 'bg-slate-100 text-slate-950'
        }[type];
      case 'emerald':
        return {
          bg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          text: 'text-emerald-600',
          border: 'border-emerald-200',
          accent: 'emerald',
          headerBg: 'bg-emerald-50 text-emerald-950'
        }[type];
      case 'rose':
        return {
          bg: 'bg-rose-600 hover:bg-rose-700 text-white',
          text: 'text-rose-600',
          border: 'border-rose-200',
          accent: 'rose',
          headerBg: 'bg-rose-50 text-rose-950'
        }[type];
      case 'amber':
        return {
          bg: 'bg-amber-600 hover:bg-amber-700 text-white',
          text: 'text-amber-600',
          border: 'border-amber-200',
          accent: 'amber',
          headerBg: 'bg-amber-50 text-amber-950'
        }[type];
      case 'cyan':
        return {
          bg: 'bg-cyan-600 hover:bg-cyan-700 text-white',
          text: 'text-cyan-600',
          border: 'border-cyan-200',
          accent: 'cyan',
          headerBg: 'bg-cyan-50 text-cyan-950'
        }[type];
    }
  };

  const handleDownloadPDF = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);

    // Keep track of styles modified/added/disabled to restore them in finally block
    const originalStyleText = new Map<HTMLStyleElement, string>();
    const originalInlineStyles = new Map<HTMLElement, string>();
    const disabledLinks: HTMLLinkElement[] = [];
    const temporaryStyles: HTMLStyleElement[] = [];
    let originalAdoptedStyleSheets: readonly CSSStyleSheet[] | undefined;
    const originalGetComputedStyle = window.getComputedStyle;

    try {
      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);

      // Helper to dynamically resolve oklch/oklab to rgb/rgba using the browser's CSS parser & Canvas fallback
      const resolveColorToRgb = (colorStr: string): string => {
        // Simple client-side cache
        if (!(window as any).__unsupportedColorCache) {
          (window as any).__unsupportedColorCache = new Map<string, string>();
        }
        const cache = (window as any).__unsupportedColorCache;
        if (cache.has(colorStr)) {
          return cache.get(colorStr);
        }

        try {
          // 1. Let the browser parse/resolve the variable (it inherits from active body/root variables)
          const dummy = document.createElement('div');
          dummy.style.color = colorStr;
          document.body.appendChild(dummy);
          let resolved = originalGetComputedStyle(dummy).color;
          document.body.removeChild(dummy);

          if (!resolved) {
            resolved = colorStr;
          }

          // 2. If it is already in standard sRGB formats, use it immediately
          if (resolved.startsWith('rgb') || resolved.startsWith('#')) {
            cache.set(colorStr, resolved);
            return resolved;
          }

          // 3. If the browser natively returned "oklch(...)" or "oklab(...)" or similar, convert it to sRGB using HTML5 Canvas
          const lowerResolved = resolved.toLowerCase();
          if (lowerResolved.includes('oklch') || lowerResolved.includes('oklab')) {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = resolved;
              ctx.fillRect(0, 0, 1, 1);
              const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
              const alpha = (a / 255).toFixed(3);
              const rgbResult = `rgba(${r}, ${g}, ${b}, ${alpha})`;
              cache.set(colorStr, rgbResult);
              return rgbResult;
            }
          }

          cache.set(colorStr, resolved);
          return resolved;
        } catch (e) {
          console.error('Error resolving unsupported color:', colorStr, e);
          return 'rgb(0,0,0)';
        }
      };

      // Helper to scan and replace oklch(...) and oklab(...) expressions with balanced parentheses
      const replaceUnsupportedColorsInCss = (cssText: string): string => {
        let result = '';
        let i = 0;
        while (i < cssText.length) {
          const sub6 = cssText.substring(i, i + 6).toLowerCase();
          const isOklch = sub6 === 'oklch(';
          const isOklab = sub6 === 'oklab(';
          if (isOklch || isOklab) {
            let parenCount = 1;
            let start = i;
            i += 6;
            while (i < cssText.length && parenCount > 0) {
              if (cssText[i] === '(') {
                parenCount++;
              } else if (cssText[i] === ')') {
                parenCount--;
              }
              i++;
            }
            const colorStr = cssText.substring(start, i);
            result += resolveColorToRgb(colorStr);
          } else {
            result += cssText[i];
            i++;
          }
        }
        return result;
      };

      // 1. Process and convert all <style> elements containing oklch or oklab
      const styleElements = Array.from(document.querySelectorAll('style'));
      styleElements.forEach(el => {
        try {
          const sheet = el.sheet as CSSStyleSheet;
          if (sheet && sheet.cssRules) {
            // Reconstruct the CSS text from the actual rules (handles programmatically inserted rules too)
            let cssText = '';
            const rules = Array.from(sheet.cssRules);
            rules.forEach(rule => {
              cssText += rule.cssText + '\n';
            });
            
            if (cssText.toLowerCase().includes('oklch') || cssText.toLowerCase().includes('oklab')) {
              originalStyleText.set(el, el.textContent || '');
              el.textContent = replaceUnsupportedColorsInCss(cssText);
            }
          } else {
            const text = el.textContent || '';
            const lowerText = text.toLowerCase();
            if (lowerText.includes('oklch') || lowerText.includes('oklab')) {
              originalStyleText.set(el, text);
              el.textContent = replaceUnsupportedColorsInCss(text);
            }
          }
        } catch (e) {
          const text = el.textContent || '';
          const lowerText = text.toLowerCase();
          if (lowerText.includes('oklch') || lowerText.includes('oklab')) {
            originalStyleText.set(el, text);
            el.textContent = replaceUnsupportedColorsInCss(text);
          }
        }
      });

      // 2. Process external <link rel="stylesheet"> tags if any
      const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
      for (const link of linkElements) {
        try {
          const response = await fetch(link.href);
          if (response.ok) {
            const cssText = await response.text();
            const tempStyle = document.createElement('style');
            tempStyle.textContent = replaceUnsupportedColorsInCss(cssText);
            document.head.appendChild(tempStyle);
            temporaryStyles.push(tempStyle);
            
            link.disabled = true;
            disabledLinks.push(link);
          }
        } catch (e) {
          console.warn('Failed to clean link stylesheet:', link.href, e);
        }
      }

      // 3. Process inline style attributes of elements in the preview area
      const inlineElements = Array.from(previewRef.current.querySelectorAll('[style]')) as HTMLElement[];
      inlineElements.forEach(el => {
        const styleAttr = el.getAttribute('style') || '';
        const lowerStyle = styleAttr.toLowerCase();
        if (lowerStyle.includes('oklch') || lowerStyle.includes('oklab')) {
          originalInlineStyles.set(el, styleAttr);
          el.setAttribute('style', replaceUnsupportedColorsInCss(styleAttr));
        }
      });

      // 4. Temporarily override adoptedStyleSheets to prevent html2canvas parsing crashes
      try {
        if ((document as any).adoptedStyleSheets) {
          originalAdoptedStyleSheets = (document as any).adoptedStyleSheets;
          (document as any).adoptedStyleSheets = [];
        }
      } catch (e) {
        console.warn('Failed to temporarily clear adoptedStyleSheets:', e);
      }

      // 5. Proxy getComputedStyle to intercept and clean any unsupported colors (oklch, oklab) returned to html2canvas on-the-fly
      window.getComputedStyle = function(elt, pseudoElt) {
        const style = originalGetComputedStyle(elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop) {
            const value = Reflect.get(target, prop);
            if (typeof prop === 'string' && typeof value === 'string') {
              const lowerVal = value.toLowerCase();
              if (lowerVal.includes('oklch') || lowerVal.includes('oklab')) {
                return replaceUnsupportedColorsInCss(value);
              }
            }
            if (typeof value === 'function') {
              if (prop === 'getPropertyValue') {
                return function(propertyName: string) {
                  const val = target.getPropertyValue(propertyName);
                  if (typeof val === 'string') {
                    const lowerVal = val.toLowerCase();
                    if (lowerVal.includes('oklch') || lowerVal.includes('oklab')) {
                      return replaceUnsupportedColorsInCss(val);
                    }
                  }
                  return val;
                };
              }
              return value.bind(target);
            }
            return value;
          }
        });
      };

      // Wait for React to re-render with isGenerating = true so all .report-page-container are in the DOM
      await new Promise(resolve => setTimeout(resolve, 800));

      // We want to process each page-container individually to guarantee pixel-perfect page break
      const pages = previewRef.current.querySelectorAll('.report-page-container');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      let pdfPageCounter = 1;

      interface ContainerMeta {
        startIndex: number;
        pageCount: number;
        title: string;
      }
      const containerMetaList: ContainerMeta[] = [];
      const pagesWithTableCutAtBottom = new Set<number>();
      const pageBottomEdgesMm = new Map<number, number>();

      for (let i = 0; i < pages.length; i++) {
        const pageElement = pages[i] as HTMLElement;
        
        // Render current page container to a canvas
        const canvas = await html2canvas(pageElement, {
          scale: 2.5, // Crisp retina render scaling
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true
        });

        const W = canvas.width;
        const H = canvas.height;
        const scale = W / 210; // pixels per mm

        const pageHeightMm = 297;
        const topMarginMm = 30;
        const bottomMarginMm = 25; // 25mm bottom margin allows more content space
        const maxContentHeightMm = pageHeightMm - topMarginMm - bottomMarginMm; // 242mm

        let y_start_px = 0;
        let spanCount = 0;
        let startIndex = pdfPageCounter;

        while (y_start_px < H) {
          // If we have already rendered at least one slice, check if the remaining area [y_start_px, H] has any visible content.
          // This avoids trailing empty pages caused by excess padding/margins/flex containers.
          if (spanCount > 0) {
            let hasVisibleContentLeft = false;
            const scanHeight = H - y_start_px;
            const ctx = canvas.getContext('2d');
            if (scanHeight > 0 && ctx) {
              try {
                const remainingImgData = ctx.getImageData(0, y_start_px, W, scanHeight);
                const rData = remainingImgData.data;
                const len = rData.length;
                // We sample every 16th pixel to keep performance ultra-fast
                for (let idx = 0; idx < len; idx += 16) {
                  const rVal = rData[idx];
                  const gVal = rData[idx + 1];
                  const bVal = rData[idx + 2];
                  const aVal = rData[idx + 3];
                  // If pixel is not fully transparent and is darker than 248 average brightness, it has visible content
                  if (aVal > 0) {
                    const brightness = (rVal + gVal + bVal) / 3;
                    if (brightness < 248) {
                      hasVisibleContentLeft = true;
                      break;
                    }
                  }
                }
              } catch (e) {
                // Fallback to true if getImageData fails to prevent skipping content
                hasVisibleContentLeft = true;
              }
            }
            if (!hasVisibleContentLeft) {
              break;
            }
          }

          let y_end_px = H;
          let isLastSlice = false;

          // Determine maximum possible end pixel for this slice
          // First page has pt-[10mm] padding in HTML, so we can draw from 0 up to 267mm.
          // Subsequent pages are drawn starting at y = 30mm on PDF, so max height is 237mm.
          const maxSliceHeightMm = (spanCount === 0) ? (pageHeightMm - bottomMarginMm) : maxContentHeightMm;
          const maxSliceHeightPx = Math.floor(maxSliceHeightMm * scale);

          let splitInsideTable = false;

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
                    if (minContentCount > 0) {
                      splitInsideTable = true;
                    }
                  }
                }

                if (!foundSplit) {
                  splitInsideTable = true;
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

            // Add to PDF
            if (pdfPageCounter > 1) {
              pdf.addPage();
            }

            // If it's the first page of this container, draw at y = 0 (since HTML has built-in top padding)
            // If it's a subsequent page, draw starting at y = 30mm
            const yPdfPos = (spanCount === 0) ? 0 : topMarginMm;
            pdf.addImage(croppedImgData, 'JPEG', 0, yPdfPos, 210, sliceHeightMm);

            if (splitInsideTable) {
              pagesWithTableCutAtBottom.add(pdfPageCounter);
            }
            pageBottomEdgesMm.set(pdfPageCounter, yPdfPos + sliceHeightMm);

            spanCount++;
            if (spanCount === 1) {
              startIndex = pdfPageCounter;
            }
            pdfPageCounter++;
          }

          y_start_px = y_end_px;
        }

        const studentName = pageElement.getAttribute('data-student-name');
        const reportTitle = pageElement.getAttribute('data-report-title');
        const containerTitle = reportType === 'collective'
          ? (reportTitle || `Rekapitulasi Hasil Belajar Kelas - ${activeClassName}`)
          : `Laporan Hasil Belajar${studentName ? ` - ${studentName}` : ''}`;

        containerMetaList.push({
          startIndex,
          pageCount: spanCount,
          title: containerTitle
        });
      }

      // Now, apply professional headers and footers (page numbers) on each physical page
      const totalPages = pdf.getNumberOfPages();
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        pdf.setPage(pageNum);

        const containerMeta = containerMetaList.find(
          meta => pageNum >= meta.startIndex && pageNum < meta.startIndex + meta.pageCount
        );

        if (containerMeta) {
          const relativePageNum = pageNum - containerMeta.startIndex + 1;
          const totalContainerPages = containerMeta.pageCount;

          // 1. Top Running Header (only on relative page >= 2 of this container)
          if (relativePageNum > 1) {
            pdf.setFont('helvetica', 'normal');
            let fontSize = 8;
            pdf.setFontSize(fontSize);
            pdf.setTextColor(100, 116, 139); // slate-500

            // Clean up title for headers to make it naturally more concise
            const cleanTitle = containerMeta.title
              .replace('Rekapitulasi Hasil Belajar Kelas - ', 'Rekap: ')
              .replace('Laporan Hasil Belajar - ', 'Rapor: ');

            let headerLeft = cleanTitle;

            // Shorten semester string to prevent overlaps
            const simpleSemester = semester
              .replace('Semester Ganjil (Semester 1)', 'Smtr Ganjil (1)')
              .replace('Semester Genap (Semester 2)', 'Smtr Genap (2)')
              .replace('Semester Ganjil', 'Ganjil')
              .replace('Semester Genap', 'Genap')
              .replace('Semester ', 'Sem. ');

            const simpleSchool = schoolName
              .replace('SMP NEGERI INDONESIA HEBAT', 'SMPN Indonesia Hebat')
              .replace('SMP NEGERI', 'SMPN');

            const headerRight = `${simpleSchool} | ${simpleSemester} (T.A. ${academicYear})`;

            // Dynamically scale down font size if they still risk overlapping
            let leftWidth = pdf.getTextWidth(headerLeft);
            let rightWidth = pdf.getTextWidth(headerRight);
            const maxAllowedWidth = 170; // page width (210) minus margins (20 + 20) = 170mm

            while (leftWidth + rightWidth + 10 > maxAllowedWidth && fontSize > 5.0) {
              fontSize -= 0.5;
              pdf.setFontSize(fontSize);
              leftWidth = pdf.getTextWidth(headerLeft);
              rightWidth = pdf.getTextWidth(headerRight);
            }

            // Ensure they never overlap by truncating left if necessary
            if (leftWidth + rightWidth + 10 > maxAllowedWidth) {
              const allowedLeftWidth = maxAllowedWidth - rightWidth - 10;
              let truncatedLeft = headerLeft;
              while (pdf.getTextWidth(truncatedLeft + '...') > allowedLeftWidth && truncatedLeft.length > 5) {
                truncatedLeft = truncatedLeft.substring(0, truncatedLeft.length - 1);
              }
              headerLeft = truncatedLeft + '...';
            }

            // Draw header text
            pdf.text(headerLeft, 20, 17);
            pdf.text(headerRight, 190, 17, { align: 'right' });

            // Thin border line below the header
            pdf.setDrawColor(226, 232, 240); // slate-200
            pdf.setLineWidth(0.3);
            pdf.line(20, 20, 190, 20);
          }

          // 2. Bottom Footer Page Numbers (always show if the container spans more than 1 page)
          if (totalContainerPages > 1) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(100, 116, 139); // slate-500

            const footerText = `Halaman ${relativePageNum} dari ${totalContainerPages}`;
            pdf.text(footerText, 190, 282, { align: 'right' });

            const footerLeft = `Dokumen Hasil Belajar Resmi | Kelas: ${activeClassName}`;
            pdf.text(footerLeft, 20, 282);

            // Thin border line above the footer
            pdf.setDrawColor(226, 232, 240); // slate-200
            pdf.setLineWidth(0.3);
            pdf.line(20, 277, 190, 277);
          }

          // 3. Draw closing and opening table borders for pages that were split inside a table
          if (pagesWithTableCutAtBottom.has(pageNum)) {
            // Draw a solid, neat bottom line to cleanly seal the table at the page cut
            pdf.setDrawColor(203, 213, 225); // slate-300 matches cell borders
            pdf.setLineWidth(0.35);
            const bottomY = pageBottomEdgesMm.get(pageNum) || 267;
            pdf.line(20, bottomY, 190, bottomY);
          }

          if (pagesWithTableCutAtBottom.has(pageNum - 1)) {
            // Draw a solid, neat top line to cleanly seal the table at the start of the next page
            pdf.setDrawColor(203, 213, 225); // slate-300
            pdf.setLineWidth(0.35);
            pdf.line(20, 30, 190, 30);
          }
        }
      }

      const reportName = reportType === 'collective' 
        ? `REKAP_KOLEKTIF_${activeClassName.replace(/\s+/g, '_')}_${Date.now()}.pdf`
        : `RAPOR_INDIVIDUAL_${activeClassName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

      pdf.save(reportName);
      window.scrollTo(0, originalScrollY);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Terjadi kesalahan saat membuat file PDF. Silakan coba kembali.');
    } finally {
      // Restore getComputedStyle
      window.getComputedStyle = originalGetComputedStyle;

      // Restore adoptedStyleSheets
      try {
        if (originalAdoptedStyleSheets && (document as any).adoptedStyleSheets) {
          (document as any).adoptedStyleSheets = originalAdoptedStyleSheets;
        }
      } catch (e) {
        console.warn('Failed to restore adoptedStyleSheets:', e);
      }

      // Restore original <style> elements
      originalStyleText.forEach((text, el) => {
        el.textContent = text;
      });

      // Restore original inline styles
      originalInlineStyles.forEach((styleText, el) => {
        el.setAttribute('style', styleText);
      });

      // Re-enable disabled links
      disabledLinks.forEach(link => {
        link.disabled = false;
      });

      // Remove any temporary stylesheet elements we added
      temporaryStyles.forEach(style => {
        style.remove();
      });

      setIsGenerating(false);
    }
  };

  // Determine which students to render for the report preview
  const studentsToRender = reportType === 'individual' && selectedStudentNis !== 'all'
    ? students.filter(s => s.nis === selectedStudentNis)
    : students;

  // Active sections for collective report
  const activeSections: string[] = [];
  if (includeAttendance) activeSections.push('attendance');
  if (includeGrades) activeSections.push('grades');
  if (includeNotes) activeSections.push('notes');
  if (activeSections.length === 0) {
    activeSections.push('attendance');
  }

  // Calculate total pages based on report type
  const totalPages = reportType === 'collective' ? activeSections.length : studentsToRender.length;

  // Safe current page number (1-based index)
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));

  // Reset page to 1 whenever any configuration or target student changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [reportType, selectedStudentNis, includeAttendance, includeGrades, includeNotes, activeClassName]);

  // Helper to render a specific section of the collective report
  const renderCollectiveSection = (section: string, pageNum: number, maxPages: number) => {
    return (
      <>
        <div>
          {/* Official School Header - Kop Surat */}
          <div className="flex items-center justify-between border-b-[3px] border-double border-slate-800 pb-3 gap-4">
            {/* Logo Kiri - Lambang Kementerian/Pendidikan atau Logo Kustom */}
            <div className="w-[16mm] h-[16mm] flex items-center justify-center border border-slate-200 rounded-xl p-1 bg-slate-50/50 shrink-0 overflow-hidden">
              {logoKiri ? (
                <img src={logoKiri} alt="Logo Kiri" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-.153-7.843-.418m15.686 0a11.955 11.955 0 01-1.358 3.667m-14.016-3.667a11.95 11.95 0 001.358 3.667m12.658 0A12.018 12.018 0 0112 14.5c-1.91 0-3.724-.21-5.358-.598m0 0a11.954 11.954 0 01-1.357-3.667m0 0C3.393 9.773 2.25 8.514 2.25 7c0-2.347 4.365-4.25 9.75-4.25s9.75 1.903 9.75 4.25c0 1.514-1.143 2.773-2.65 3.232z" />
                </svg>
              )}
            </div>

            {/* Teks Tengah Kop Surat */}
            <div className="flex-1 text-center space-y-0.5">
              <h5 className="text-[9px] font-extrabold text-slate-800 tracking-widest uppercase leading-none">{govName}</h5>
              <h5 className="text-[9.5px] font-black text-slate-800 tracking-wider uppercase leading-none">{deptName}</h5>
              <h2 className="text-[14px] font-black text-slate-950 tracking-wide uppercase leading-tight">{schoolName}</h2>
              <p className="text-[8.5px] text-slate-600 font-medium leading-none">{schoolAddress}</p>
              <p className="text-[7.5px] text-slate-400 font-mono leading-none">{schoolPhone}</p>
            </div>

            {/* Logo Kanan - Lambang Sekolah/Pendidikan atau Logo Kustom */}
            <div className="w-[16mm] h-[16mm] flex items-center justify-center border border-slate-200 rounded-xl p-1 bg-slate-50/50 shrink-0 overflow-hidden">
              {logoKanan ? (
                <img src={logoKanan} alt="Logo Kanan" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <svg className="w-9 h-9 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              )}
            </div>
          </div>

          {/* Document Title */}
          <div className="my-5 text-center space-y-1">
            <h3 className="text-[13px] font-black tracking-wider uppercase text-slate-900 leading-tight">
              LAPORAN PERKEMBANGAN BELAJAR DAN ABSENSI KOLEKTIF
            </h3>
            <p className="text-[10px] font-bold text-slate-600 uppercase">
              KELAS: {activeClassName} | SEMESTER: {semester} | TAHUN AJARAN: {academicYear}
            </p>
          </div>

          {/* Tables and Info */}
          <div className="space-y-4 text-[10px]">
            {section === 'attendance' && (includeAttendance || (!includeAttendance && !includeGrades && !includeNotes)) && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  I. REKAPITULASI PRESENSI / KEHADIRAN SISWA
                </span>
                <table className="w-full border-collapse border border-slate-200 shadow-2xs">
                  <thead>
                    <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                      <th className="border border-slate-200 px-1 py-2 text-center w-8 text-[9px]">No</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-16 text-[9px]">NIS</th>
                      <th className="border border-slate-200 px-2.5 py-2 text-left text-[9px]">Nama Lengkap Murid</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-10 text-[9px]">L/P</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-10 text-[9px]">Hadir</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-10 text-[9px]">Sakit</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-10 text-[9px]">Izin</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-10 text-[9px]">Alfa</th>
                      <th className="border border-slate-200 px-1 py-2 text-center w-12 text-[9px]">Terlambat</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-14 text-[9px]">Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.map((r, index) => (
                      <tr key={r.nis} className="hover:bg-slate-50 border-b border-slate-150 text-slate-800">
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono text-slate-500">{index + 1}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-700 font-semibold">{r.nis}</td>
                        <td className="border border-slate-200 px-2.5 py-1 font-bold text-slate-900 truncate max-w-[190px]">{r.nama}</td>
                        <td className="border border-slate-200 px-1.5 py-1 text-center text-slate-600">{r.jenisKelamin || '-'}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">{r.hadir}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono text-cyan-600 font-semibold">{r.sakit}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono text-amber-600 font-semibold">{r.izin}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono text-rose-600 font-bold bg-rose-50/20">{r.alfa}</td>
                        <td className="border border-slate-200 px-1 py-1 text-center font-mono text-slate-500">{r.terlambatCount}x</td>
                        <td className={`border border-slate-200 px-1.5 py-1 text-center font-mono font-extrabold ${getThemeClasses('text')} bg-slate-50/40`}>
                          {(r.persentaseKehadiran * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {section === 'grades' && includeGrades && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  II. TRANSKRIP NILAI AKADEMIK SISWA (RATA-RATA FORMATIF & SUMATIF)
                </span>
                <table className="w-full border-collapse border border-slate-200 shadow-2xs">
                  <thead>
                    <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                      <th className="border border-slate-200 px-1 py-2 text-center w-8 text-[9px]">No</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-16 text-[9px]">NIS</th>
                      <th className="border border-slate-200 px-2.5 py-2 text-left text-[9px]">Nama Lengkap Murid</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-14 text-[9px]">Formatif (F)</th>
                      <th className="border border-slate-200 px-1.5 py-2 text-center w-14 text-[9px]">Sumatif (S)</th>
                      <th className="border border-slate-200 px-2 py-2 text-center w-16 text-[9px]">Nilai Akhir</th>
                      <th className="border border-slate-200 px-2.5 py-2 text-left text-[9px]">Predikat Kelulusan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, index) => {
                      const f = formativeGrades.find(g => g.nis === s.nis);
                      const sum = summativeGrades.find(g => g.nis === s.nis);
                      
                      const fAvg = f 
                        ? (f.rataRata !== null && !isNaN(f.rataRata) && f.rataRata > 0 ? f.rataRata : calculateAvg(formativeCols.map(c => f[c.key])))
                        : 0;
                        
                      const sumAvg = sum
                        ? (sum.rataRata !== null && !isNaN(sum.rataRata) && sum.rataRata > 0 ? sum.rataRata : calculateAvg(summativeCols.map(c => sum[c.key])))
                        : 0;

                      const finalGrade = parseFloat(((fAvg + sumAvg) / 2).toFixed(1));

                      const getGradeMeta = (g: number) => {
                        if (g >= 85) return { name: 'SANGAT BAIK (A)', style: 'text-emerald-700 font-black' };
                        if (g >= 75) return { name: 'BAIK (B)', style: 'text-indigo-700 font-bold' };
                        if (g >= 65) return { name: 'CUKUP (C)', style: 'text-amber-700 font-medium' };
                        return { name: 'PERLU BIMBINGAN (D)', style: 'text-rose-600 font-bold' };
                      };

                      const gradeMeta = getGradeMeta(finalGrade);

                      return (
                        <tr key={s.nis} className="hover:bg-slate-50 border-b border-slate-150 text-slate-800">
                          <td className="border border-slate-200 px-1 py-1 text-center font-mono text-slate-500">{index + 1}</td>
                          <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-700 font-semibold">{s.nis}</td>
                          <td className="border border-slate-200 px-2.5 py-1 font-bold text-slate-900 truncate max-w-[190px]">{s.nama}</td>
                          <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-800">{fAvg > 0 ? fAvg : '-'}</td>
                          <td className="border border-slate-200 px-1.5 py-1 text-center font-mono text-slate-800">{sumAvg > 0 ? sumAvg : '-'}</td>
                          <td className={`border border-slate-200 px-2 py-1 text-center font-mono font-extrabold ${getThemeClasses('text')} bg-slate-50/40`}>{finalGrade > 0 ? finalGrade : '-'}</td>
                          <td className={`border border-slate-200 px-2.5 py-1 ${gradeMeta.style} text-[9px]`}>
                            {finalGrade > 0 ? gradeMeta.name : 'Belum Berpartisipasi'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {section === 'notes' && includeNotes && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  III. JURNAL INSIDENSIAL & CATATAN PERILAKU SISWA
                </span>
                {notes.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-[9px] italic">
                    Tidak ada catatan perilaku atau insidensi siswa yang dilaporkan untuk kelas ini.
                  </div>
                ) : (
                  <table className="w-full border-collapse border border-slate-200 text-[9px] shadow-2xs">
                    <thead>
                      <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                        <th className="border border-slate-200 px-1.5 py-2 text-left w-20">Tanggal</th>
                        <th className="border border-slate-200 px-1.5 py-2 text-left w-28">Nama Murid</th>
                        <th className="border border-slate-200 px-1.5 py-2 text-center w-16">Tipe Perilaku</th>
                        <th className="border border-slate-200 px-2.5 py-2 text-left">Catatan Observasi Guru</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notes.slice(0, 8).map((n) => (
                        <tr key={n.id} className="border-b border-slate-150 text-slate-800 hover:bg-slate-50/50">
                          <td className="border border-slate-200 px-1.5 py-1.5 font-mono text-slate-500">{n.tanggal}</td>
                          <td className="border border-slate-200 px-1.5 py-1.5 font-bold text-slate-900">{n.nama}</td>
                          <td className="border border-slate-200 px-1.5 py-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${
                              n.tipe === 'aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {n.tipe}
                            </span>
                          </td>
                          <td className="border border-slate-200 px-2.5 py-1.5 text-slate-600 leading-normal italic">{n.catatan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {notes.length > 8 && (
                  <p className="text-[8px] text-right text-slate-400 font-medium italic pt-0.5">
                    * Menampilkan 8 catatan terbaru. {notes.length - 8} catatan perilaku lainnya tersimpan di database.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Signatures section at bottom */}
        <div className="grid grid-cols-2 gap-4 pt-10 text-[10px] text-slate-800 border-t border-slate-150">
          <div className="space-y-12">
            <div className="space-y-1">
              <p className="font-bold uppercase tracking-wider">Mengetahui,</p>
              <p className="font-extrabold text-slate-900">Kepala {schoolName}</p>
            </div>
            <div>
              <p className="font-black underline text-slate-950">{headmasterName}</p>
              <p className="text-[9px] text-slate-500 font-mono font-bold leading-none mt-0.5">{headmasterNip}</p>
            </div>
          </div>

          <div className="space-y-12 text-right">
            <div className="space-y-1">
              <p>{cityName}, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="font-bold uppercase tracking-wider">Guru Mata Pelajaran {activeClassName}</p>
            </div>
            <div>
              <p className="font-black underline text-slate-950">{teacherName}</p>
              <p className="text-[9px] text-slate-500 font-mono font-bold leading-none mt-0.5">{teacherNip}</p>
            </div>
          </div>
        </div>
      </>
    );
  };

  // Helper to render an individual student report
  const renderIndividualStudentReport = (s: Student) => {
    const sRecap = recap.find(r => r.nis === s.nis);
    const sNotes = notes.filter(n => n.nis === s.nis);
    const f = formativeGrades.find(g => g.nis === s.nis);
    const sum = summativeGrades.find(g => g.nis === s.nis);

    const fAvg = f 
      ? (f.rataRata !== null && !isNaN(f.rataRata) && f.rataRata > 0 ? f.rataRata : calculateAvg(formativeCols.map(c => f[c.key])))
      : 0;
      
    const sumAvg = sum
      ? (sum.rataRata !== null && !isNaN(sum.rataRata) && sum.rataRata > 0 ? sum.rataRata : calculateAvg(summativeCols.map(c => sum[c.key])))
      : 0;

    const finalGrade = parseFloat(((fAvg + sumAvg) / 2).toFixed(1));

    const getGradeMeta = (g: number) => {
      if (g >= 85) return { name: 'SANGAT BAIK (A)', style: 'text-emerald-700 font-black' };
      if (g >= 75) return { name: 'BAIK (B)', style: 'text-indigo-700 font-bold' };
      if (g >= 65) return { name: 'CUKUP (C)', style: 'text-amber-700 font-medium' };
      return { name: 'PERLU BIMBINGAN (D)', style: 'text-rose-600 font-bold' };
    };

    const gradeMeta = getGradeMeta(finalGrade);

    return (
      <>
        <div>
          {/* Official School Header - Kop Surat */}
          <div className="flex items-center justify-between border-b-[3px] border-double border-slate-800 pb-3 gap-4">
            {/* Logo Kiri - Lambang Kementerian/Pendidikan atau Logo Kustom */}
            <div className="w-[16mm] h-[16mm] flex items-center justify-center border border-slate-200 rounded-xl p-1 bg-slate-50/50 shrink-0 overflow-hidden">
              {logoKiri ? (
                <img src={logoKiri} alt="Logo Kiri" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-.153-7.843-.418m15.686 0a11.955 11.955 0 01-1.358 3.667m-14.016-3.667a11.95 11.95 0 001.358 3.667m12.658 0A12.018 12.018 0 0112 14.5c-1.91 0-3.724-.21-5.358-.598m0 0a11.954 11.954 0 01-1.357-3.667m0 0C3.393 9.773 2.25 8.514 2.25 7c0-2.347 4.365-4.25 9.75-4.25s9.75 1.903 9.75 4.25c0 1.514-1.143 2.773-2.65 3.232z" />
                </svg>
              )}
            </div>

            {/* Teks Tengah Kop Surat */}
            <div className="flex-1 text-center space-y-0.5">
              <h5 className="text-[9px] font-extrabold text-slate-800 tracking-widest uppercase leading-none">{govName}</h5>
              <h5 className="text-[9.5px] font-black text-slate-800 tracking-wider uppercase leading-none">{deptName}</h5>
              <h2 className="text-[14px] font-black text-slate-950 tracking-wide uppercase leading-tight">{schoolName}</h2>
              <p className="text-[8.5px] text-slate-600 font-medium leading-none">{schoolAddress}</p>
              <p className="text-[7.5px] text-slate-400 font-mono leading-none">{schoolPhone}</p>
            </div>

            {/* Logo Kanan - Lambang Sekolah/Pendidikan atau Logo Kustom */}
            <div className="w-[16mm] h-[16mm] flex items-center justify-center border border-slate-200 rounded-xl p-1 bg-slate-50/50 shrink-0 overflow-hidden">
              {logoKanan ? (
                <img src={logoKanan} alt="Logo Kanan" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <svg className="w-9 h-9 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              )}
            </div>
          </div>

          {/* Document Title */}
          <div className="my-4 text-center">
            <h3 className="text-[12px] font-black tracking-widest uppercase text-slate-950">
              KARTU HASIL BELAJAR & ABSENSI SISWA (KHB)
            </h3>
            <div className="w-24 h-[1.5px] mx-auto bg-slate-800 mt-1" />
          </div>

          {/* Student Identity Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-slate-200 bg-slate-50/30 p-3.5 rounded-xl text-[10px] mb-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Nama Lengkap</span>
              <span className="font-black text-slate-950 text-right">{s.nama}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Kelas / Roster</span>
              <span className="font-extrabold text-slate-900 text-right">{activeClassName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">No. Induk (NIS)</span>
              <span className="font-mono font-black text-slate-950 text-right">{s.nis}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Semester</span>
              <span className="font-bold text-slate-900 text-right">{semester}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Jenis Kelamin</span>
              <span className="font-bold text-slate-900 text-right">{s.jenisKelamin === 'L' ? 'Laki-laki (L)' : s.jenisKelamin === 'P' ? 'Perempuan (P)' : '-'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[8.5px]">Tahun Ajaran</span>
              <span className="font-mono font-bold text-slate-900 text-right">{academicYear}</span>
            </div>
          </div>

          {/* Detailed Student Performance Data */}
          <div className="space-y-4 text-[10px]">
            {/* Attendance Section */}
            {includeAttendance && sRecap && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  I. REKAPITULASI PRESENSI / KEHADIRAN INDIVIDUAL
                </span>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center p-2 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <span className="block text-[8px] text-emerald-700 font-bold uppercase tracking-wider">Hadir</span>
                    <span className="text-lg font-black text-emerald-700 font-mono leading-none block my-1">{sRecap.hadir}</span>
                    <span className="text-[8px] text-emerald-600 block">Hari</span>
                  </div>
                  <div className="text-center p-2 bg-cyan-50/50 rounded-xl border border-cyan-100">
                    <span className="block text-[8px] text-cyan-700 font-bold uppercase tracking-wider">Sakit</span>
                    <span className="text-lg font-black text-cyan-600 font-mono leading-none block my-1">{sRecap.sakit}</span>
                    <span className="text-[8px] text-cyan-600 block">Hari</span>
                  </div>
                  <div className="text-center p-2 bg-amber-50/50 rounded-xl border border-amber-100">
                    <span className="block text-[8px] text-amber-700 font-bold uppercase tracking-wider">Izin</span>
                    <span className="text-lg font-black text-amber-600 font-mono leading-none block my-1">{sRecap.izin}</span>
                    <span className="text-[8px] text-amber-600 block">Hari</span>
                  </div>
                  <div className="text-center p-2 bg-rose-50/50 rounded-xl border border-rose-100">
                    <span className="block text-[8px] text-rose-700 font-bold uppercase tracking-wider">Alfa</span>
                    <span className="text-lg font-black text-rose-600 font-mono leading-none block my-1">{sRecap.alfa}</span>
                    <span className="text-[8px] text-rose-600 block">Hari</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px] bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100">
                  <span className="font-bold text-slate-700 font-medium">Persentase Tingkat Kehadiran Kumulatif:</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-black font-mono text-sm ${getThemeClasses('text')}`}>{(sRecap.persentaseKehadiran * 100).toFixed(0)}%</span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${
                      sRecap.persentaseKehadiran >= 0.95 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : sRecap.persentaseKehadiran >= 0.85 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {sRecap.persentaseKehadiran >= 0.95 ? 'SANGAT MEMUASKAN' : sRecap.persentaseKehadiran >= 0.85 ? 'CUKUP' : 'PERINGATAN ABSEN'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Grades section */}
            {includeGrades && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  II. CAPAIAN NILAI AKADEMIK & KOMPETENSI
                </span>
                <table className="w-full border-collapse border border-slate-200 shadow-2xs">
                  <thead>
                    <tr className={`${getThemeClasses('headerBg')} font-extrabold border-b border-slate-300`}>
                      <th className="border border-slate-200 px-2.5 py-2 text-left text-[9px]">Jenis Penilaian & Deskripsi</th>
                      {formativeCols.map(c => (
                        <th key={c.key} className="border border-slate-200 px-1 py-2 text-center w-12 text-[8px] font-extrabold">{c.label}</th>
                      ))}
                      {summativeCols.map(c => (
                        <th key={c.key} className="border border-slate-200 px-1 py-2 text-center w-12 text-[8px] font-extrabold">{c.label}</th>
                      ))}
                      <th className="border border-slate-200 px-2 py-2 text-center w-20 text-[9px] font-extrabold">Rata-Rata</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-slate-50/50">
                      <td className="border border-slate-200 px-2.5 py-1.5 font-bold text-slate-800 text-[9.5px]">Formatif (Tugas/Harian/Kuis)</td>
                      {formativeCols.map(c => (
                        <td key={c.key} className="border border-slate-200 px-1 py-1.5 text-center font-mono text-slate-800">
                          {f && f[c.key] !== null && f[c.key] !== undefined && f[c.key] !== '' ? f[c.key] : '-'}
                        </td>
                      ))}
                      {summativeCols.map(c => (
                        <td key={c.key} className="border border-slate-200 bg-slate-50/30 px-1 py-1.5 text-center font-mono text-slate-400">-</td>
                      ))}
                      <td className="border border-slate-200 px-2 py-1.5 text-center font-mono font-bold text-slate-900 bg-slate-50/40">{fAvg > 0 ? fAvg : '-'}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="border border-slate-200 px-2.5 py-1.5 font-bold text-slate-800 text-[9.5px]">Sumatif (Ujian Tengah/Akhir Semester)</td>
                      {formativeCols.map(c => (
                        <td key={c.key} className="border border-slate-200 bg-slate-50/30 px-1 py-1.5 text-center font-mono text-slate-400">-</td>
                      ))}
                      {summativeCols.map(c => (
                        <td key={c.key} className="border border-slate-200 px-1 py-1.5 text-center font-mono text-slate-800">
                          {sum && sum[c.key] !== null && sum[c.key] !== undefined && sum[c.key] !== '' ? sum[c.key] : '-'}
                        </td>
                      ))}
                      <td className="border border-slate-200 px-2 py-1.5 text-center font-mono font-bold text-slate-900 bg-slate-50/40">{sumAvg > 0 ? sumAvg : '-'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Performance summary card */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl gap-2 mt-2">
                  <div className="flex items-center gap-3">
                    <div className={`${getThemeClasses('headerBg')} p-2 rounded-lg`}>
                      <Award className={`w-5 h-5 ${getThemeClasses('text')}`} />
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400 font-bold uppercase leading-tight tracking-wide">Nilai Akhir Rapor</span>
                      <span className={`text-xl font-black ${getThemeClasses('text')} font-mono leading-none`}>{finalGrade > 0 ? finalGrade : '-'}</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="block text-[8px] text-slate-400 font-bold uppercase leading-tight tracking-wide">Kualifikasi & Predikat Belajar</span>
                    <span className={`text-[10px] font-black tracking-wide block mt-0.5 ${
                      finalGrade >= 85 ? 'text-emerald-700' : finalGrade >= 75 ? 'text-indigo-700' : finalGrade >= 65 ? 'text-amber-700' : 'text-rose-600'
                    }`}>
                      {finalGrade >= 85 ? 'SANGAT MEMUASKAN (A)' : finalGrade >= 75 ? 'KOMPETEN & BAIK (B)' : finalGrade >= 65 ? 'CUKUP (C)' : finalGrade > 0 ? 'MEMBUTUHKAN PEMBINAAN KHUSUS (D)' : 'BELUM ADA DATA NILAI'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Behavior Journal Notes */}
            {includeNotes && (
              <div className="space-y-1.5">
                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${getThemeClasses('headerBg')}`}>
                  III. CATATAN PERILAKU DAN CATATAN SIKAP DARI GURU MATA PELAJARAN
                </span>
                {sNotes.length === 0 ? (
                  <div className="text-left py-2.5 px-3.5 bg-slate-50/40 rounded-xl border border-dashed border-slate-200 text-slate-500 italic text-[9px] leading-relaxed">
                    Murid yang bersangkutan selalu menunjukkan perilaku teladan, budi pekerti yang luhur, sopan santun yang tinggi, serta tingkat kepatuhan dan kerja sama yang sangat baik dalam seluruh aktivitas kelas sepanjang periode semester berjalan.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sNotes.map(n => (
                      <div key={n.id} className="border border-slate-150 bg-slate-50/30 p-2.5 rounded-xl flex items-start gap-2.5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${
                          n.tipe === 'aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {n.tipe}
                        </span>
                        <div className="space-y-0.5 text-left flex-1">
                          <p className="font-mono text-[8px] text-slate-400 font-bold">{n.tanggal} | Pembelajaran: {n.jamPembelajaran}</p>
                          <p className="text-slate-700 leading-normal italic text-[9.5px]">"{n.catatan}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Signatures section at bottom */}
        <div className="grid grid-cols-3 gap-4 pt-12 text-[10px] text-slate-800 border-t border-slate-150 mt-8">
          <div className="space-y-12 text-center">
            <div className="space-y-1">
              <p className="font-bold uppercase tracking-wider">Mengetahui,</p>
              <p className="font-extrabold text-slate-800">Orang Tua / Wali Murid</p>
            </div>
            <div>
              <p className="font-black text-slate-900">...................................................</p>
            </div>
          </div>

          <div className="space-y-12 text-center">
            <div className="space-y-1">
              <p className="font-bold uppercase tracking-wider">Mengetahui,</p>
              <p className="font-extrabold text-slate-800">Kepala Sekolah</p>
            </div>
            <div>
              <p className="font-black underline text-slate-950">{headmasterName}</p>
              <p className="text-[8px] text-slate-500 font-mono font-bold leading-none mt-0.5">{headmasterNip}</p>
            </div>
          </div>

          <div className="space-y-12 text-center">
            <div className="space-y-1">
              <p>{cityName}, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="font-bold uppercase tracking-wider">Guru Mata Pelajaran {activeClassName}</p>
            </div>
            <div>
              <p className="font-black underline text-slate-950">{teacherName}</p>
              <p className="text-[8px] text-slate-500 font-mono font-bold leading-none mt-0.5">{teacherNip}</p>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-950">
              Generator Laporan Akademik & Absensi Profesional
            </h3>
            <p className="text-xs text-slate-500">
              Unduh rekapitulasi data absensi, nilai, dan catatan siswa dalam format dokumen PDF resmi berdesain elegan, nyaman dibaca, dan berstandar administrasi sekolah nasional.
            </p>
          </div>
        </div>

        {/* Configuration Tabs and Options */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Options sidebar controls */}
          <div className="lg:col-span-5 space-y-5 border-r border-slate-100 pr-0 lg:pr-6">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Settings className="w-4 h-4 text-indigo-500" />
              1. Pengaturan Dokumen
            </h4>

            {/* Type Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Jenis Laporan
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportType('collective');
                    setSelectedStudentNis('all');
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    reportType === 'collective'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  Kolektif Kelas (Tabel)
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('individual')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    reportType === 'individual'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  Rapor Individu (Siswa)
                </button>
              </div>
            </div>

            {/* Individual Student Filter if individual type chosen */}
            {reportType === 'individual' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Siswa Sasaran
                </label>
                <select
                  value={selectedStudentNis}
                  onChange={(e) => setSelectedStudentNis(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Semua Siswa Kelas ({students.length} Halaman)</option>
                  {students.map(s => (
                    <option key={s.nis} value={s.nis}>{s.nis} - {s.nama}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Select Data Columns to Include */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Data yang Ingin Direkap
              </label>
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <button
                  type="button"
                  onClick={() => setIncludeAttendance(!includeAttendance)}
                  className="w-full flex items-center gap-2 text-xs font-semibold text-slate-700"
                >
                  {includeAttendance ? (
                    <CheckSquare className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                  )}
                  <span>Data Rekapitulasi Absensi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIncludeGrades(!includeGrades)}
                  className="w-full flex items-center gap-2 text-xs font-semibold text-slate-700"
                >
                  {includeGrades ? (
                    <CheckSquare className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                  )}
                  <span>Data Nilai Akademik (Formatif & Sumatif)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIncludeNotes(!includeNotes)}
                  className="w-full flex items-center gap-2 text-xs font-semibold text-slate-700"
                >
                  {includeNotes ? (
                    <CheckSquare className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                  )}
                  <span>Data Jurnal Catatan Guru / Perilaku</span>
                </button>
              </div>
            </div>

            {/* Accent Theme Color */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" /> Tema Warna Laporan
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'indigo', color: 'bg-indigo-600', name: 'Navy Modern' },
                  { id: 'slate', color: 'bg-slate-700', name: 'Charcoal' },
                  { id: 'emerald', color: 'bg-emerald-600', name: 'Teal Forest' },
                  { id: 'rose', color: 'bg-rose-600', name: 'Burgundy' },
                  { id: 'amber', color: 'bg-amber-600', name: 'Royal Gold' },
                  { id: 'cyan', color: 'bg-cyan-600', name: 'Ocean' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemeColor(t.id as ThemeColor)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                      themeColor === t.id
                        ? 'bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-indigo-500 ring-offset-1'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${t.color}`} />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* School Period Metadata */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Semester
                </label>
                <input
                  type="text"
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-200 text-slate-800 bg-slate-50 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-200 text-slate-800 bg-slate-50 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Official Headers configuration */}
          <div className="lg:col-span-7 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Building className="w-4 h-4 text-indigo-500" />
              2. Kustomisasi Kop Resmi & Penandatangan
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/50 p-4 rounded-2xl border border-slate-150 text-left">
              {/* Kop Surat Fields */}
              <div className="space-y-2.5 sm:col-span-2">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Data Kop Instansi & Sekolah
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={govName}
                    onChange={e => setGovName(e.target.value)}
                    placeholder="Pemerintah Provinsi / Kota"
                    className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white"
                    title="Pemerintah Tingkat I/II"
                  />
                  <input
                    type="text"
                    value={deptName}
                    onChange={e => setDeptName(e.target.value)}
                    placeholder="Dinas Pendidikan"
                    className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white"
                  />
                  <input
                    type="text"
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    placeholder="Nama Sekolah"
                    className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 font-bold text-indigo-800 bg-white"
                  />
                  <input
                    type="text"
                    value={schoolAddress}
                    onChange={e => setSchoolAddress(e.target.value)}
                    placeholder="Alamat Sekolah"
                    className="w-full py-1.5 px-2.5 text-[11px] rounded-lg border border-slate-200 text-slate-600 bg-white"
                  />
                  <input
                    type="text"
                    value={schoolPhone}
                    onChange={e => setSchoolPhone(e.target.value)}
                    placeholder="Telepon & Kontak Sekolah"
                    className="w-full py-1.5 px-2.5 text-[10px] rounded-lg border border-slate-200 text-slate-500 bg-white font-mono"
                  />

                  {/* Upload Logo Custom */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5 pt-2.5 border-t border-slate-200/60">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                        Logo Kiri (Instansi / Pemda)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 rounded-xl cursor-pointer text-[10.5px] font-bold text-slate-700 transition shadow-xs">
                          <Upload className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Pilih Logo Kiri</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoKiriChange}
                            className="hidden"
                          />
                        </label>
                        {logoKiri && (
                          <button
                            type="button"
                            onClick={removeLogoKiri}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                            title="Hapus Logo Kiri"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                        Logo Kanan (Sekolah / Tut Wuri)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 rounded-xl cursor-pointer text-[10.5px] font-bold text-slate-700 transition shadow-xs">
                          <Upload className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Pilih Logo Kanan</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoKananChange}
                            className="hidden"
                          />
                        </label>
                        {logoKanan && (
                          <button
                            type="button"
                            onClick={removeLogoKanan}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                            title="Hapus Logo Kanan"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signatures fields */}
              <div className="space-y-2">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Penandatangan: Guru Mata Pelajaran
                </span>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={cityName}
                    onChange={e => setCityName(e.target.value)}
                    placeholder="Tempat Kota Terbit"
                    className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white"
                    title="Kota Tempat Cetak"
                  />
                  <input
                    type="text"
                    value={teacherName}
                    onChange={e => setTeacherName(e.target.value)}
                    placeholder="Nama Lengkap Guru Mata Pelajaran"
                    className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white font-semibold"
                  />
                  <input
                    type="text"
                    value={teacherNip}
                    onChange={e => setTeacherNip(e.target.value)}
                    placeholder="NIP Guru Mata Pelajaran"
                    className="w-full py-1 px-2 text-[11px] rounded-lg border border-slate-200 text-slate-500 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Penandatangan: Kepala Sekolah
                </span>
                <div className="space-y-1.5">
                  <div className="h-6 flex items-center">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Mengetahui, Kepala Sekolah</span>
                  </div>
                  <input
                    type="text"
                    value={headmasterName}
                    onChange={e => setHeadmasterName(e.target.value)}
                    placeholder="Nama Lengkap Kepala Sekolah"
                    className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 text-slate-800 bg-white font-semibold"
                  />
                  <input
                    type="text"
                    value={headmasterNip}
                    onChange={e => setHeadmasterNip(e.target.value)}
                    placeholder="NIP Kepala Sekolah"
                    className="w-full py-1 px-2 text-[11px] rounded-lg border border-slate-200 text-slate-500 bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button and Zoom */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Eye className="w-4 h-4 text-slate-400" /> Skala Pratinjau:
            </span>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              {[50, 75, 100].map(zoom => (
                <button
                  key={zoom}
                  onClick={() => setPreviewZoom(zoom)}
                  className={`px-3 py-1 rounded-lg font-bold transition duration-200 cursor-pointer ${
                    previewZoom === zoom 
                      ? 'bg-white text-slate-800 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {zoom}%
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGenerating || students.length === 0}
            className={`px-6 py-2.5 rounded-2xl font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs sm:text-sm ${
              isGenerating || students.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : getThemeClasses('bg')
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyusun PDF Beresolusi Tinggi...
              </>
            ) : (
              <>
                <Download className="w-4.5 h-4.5" />
                Unduh PDF Laporan Resmi
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Warning */}
      <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-150 text-indigo-900 text-xs leading-relaxed space-y-1 text-left flex items-start gap-2.5">
        <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-[13px] text-indigo-950">Akurasi & Standar Percetakan Digital</p>
          <p className="text-indigo-800">
            Preview di bawah ini disesuaikan dalam format rasio kertas internasional <strong>A4 (210mm x 297mm)</strong>. 
            Hasil ekspor PDF dijamin memiliki kontras visual tinggi, font serif/sans-serif yang seimbang, dan bebas pecah saat dicetak ke printer fisik sekolah.
          </p>
        </div>
      </div>

      {/* Pagination Navigation Bar */}
      {totalPages > 1 && !isGenerating && (
        <div id="report-pagination-nav" className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-left">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Navigasi Halaman Laporan (A4)
            </span>
            <span className="text-[12px] font-extrabold text-slate-700">
              {reportType === 'collective' 
                ? `Bagian: ${
                    activeSections[safeCurrentPage - 1] === 'attendance' ? 'I. Rekapitulasi Presensi' : 
                    activeSections[safeCurrentPage - 1] === 'grades' ? 'II. Transkrip Nilai Akademik' : 
                    'III. Jurnal Perilaku Siswa'
                  }`
                : `Murid: ${studentsToRender[safeCurrentPage - 1]?.nama || ''} (${studentsToRender[safeCurrentPage - 1]?.nis || ''})`
              }
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="prev-page-btn"
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              &larr; Sebelumnya
            </button>
            
            <div id="page-indicator-counter" className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-600">
              Halaman {safeCurrentPage} dari {totalPages}
            </div>

            <button
              id="next-page-btn"
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              Selanjutnya &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Report Live Preview Stage */}
      <div className="w-full flex justify-center overflow-x-auto py-4 bg-slate-900/5 rounded-3xl border border-slate-200/60 p-4 min-h-[500px]">
        <div 
          className="origin-top transition-transform duration-200 shadow-2xl rounded-sm"
          style={{ transform: `scale(${previewZoom / 100})`, width: '210mm' }}
        >
          <div ref={previewRef} className="bg-neutral-100 flex flex-col gap-6 select-none text-left">
            
            {/* REPORT RENDER LOGIC */}
            {reportType === 'collective' ? (
              /* ========================================================== */
              /* 1. COLLECTIVE REPORT                                      */
              /* ========================================================== */
              isGenerating ? (
                activeSections.map((sec, idx) => (
                  <div key={sec} data-report-title={`Rekapitulasi Hasil Belajar Kelas - ${activeClassName} (${sec})`} className="report-page-container bg-white w-[210mm] min-h-[297mm] pt-[10mm] pb-[30mm] pl-[30mm] pr-[30mm] flex flex-col justify-between shadow-md relative overflow-hidden font-sans text-slate-800">
                    {renderCollectiveSection(sec, idx + 1, activeSections.length)}
                  </div>
                ))
              ) : (
                <div data-report-title={`Rekapitulasi Hasil Belajar Kelas - ${activeClassName}`} className="report-page-container bg-white w-[210mm] min-h-[297mm] pt-[10mm] pb-[30mm] pl-[30mm] pr-[30mm] flex flex-col justify-between shadow-md relative overflow-hidden font-sans text-slate-800">
                  {renderCollectiveSection(activeSections[safeCurrentPage - 1] || activeSections[0], safeCurrentPage, activeSections.length)}
                </div>
              )
            ) : (
              /* ========================================================== */
              /* 2. INDIVIDUAL REPORT                                      */
              /* ========================================================== */
              isGenerating ? (
                studentsToRender.map((s) => (
                  <div key={s.nis} data-student-name={s.nama} className="report-page-container bg-white w-[210mm] min-h-[297mm] pt-[10mm] pb-[30mm] pl-[30mm] pr-[30mm] flex flex-col justify-between shadow-md relative overflow-hidden font-sans text-slate-800">
                    {renderIndividualStudentReport(s)}
                  </div>
                ))
              ) : (
                studentsToRender.length > 0 && (
                  (() => {
                    const s = studentsToRender[safeCurrentPage - 1] || studentsToRender[0];
                    return (
                      <div key={s.nis} data-student-name={s.nama} className="report-page-container bg-white w-[210mm] min-h-[297mm] pt-[10mm] pb-[30mm] pl-[30mm] pr-[30mm] flex flex-col justify-between shadow-md relative overflow-hidden font-sans text-slate-800">
                        {renderIndividualStudentReport(s)}
                      </div>
                    );
                  })()
                )
              )
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
