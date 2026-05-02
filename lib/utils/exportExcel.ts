import * as XLSX from 'xlsx';

export function downloadExcel(data: any[], fileName: string) {
  // Buat worksheet dari JSON data
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Buat workbook dan tambahkan worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');
  
  // Tulis file dan jalankan trigger download
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
