// Konfigurasi Google Apps Script & Google Spreadsheet Permanen
// Anda dapat mengonfigurasi nilai ini secara langsung di sini sebelum mengunggah ke GitHub,
// ATAU menggunakan Environment Variables (VITE_APPS_SCRIPT_URL dan VITE_SPREADSHEET_ID).

export const appsScriptConfig = {
  // Masukkan URL Web App Google Apps Script Anda di sini (contoh: https://script.google.com/macros/s/.../exec)
  appsScriptUrl: (import.meta as any).env?.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbzMxsCyT3FQ33z2GbRomEvjsbswXvxGX12TC9b6gNY8qD2lWKwSrust7QLqOamG4xA/exec",
  
  // Masukkan ID Spreadsheet Google Anda di sini (ID dari URL spreadsheet Anda)
  spreadsheetId: (import.meta as any).env?.VITE_SPREADSHEET_ID || "1ILWenBwDtrKYRgbTSJZvteWUUI-SMMr5FAxX1a3YPKI"
};
