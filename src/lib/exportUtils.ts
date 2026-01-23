import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface AttendanceExportData {
  sessionTitle: string;
  trainingTitle: string;
  sessionDate: string;
  sessionTime: string;
  participants: {
    name: string;
    email: string;
    status: string;
    joinTime: string;
  }[];
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    pending: number;
  };
}

export function exportToCSV(data: AttendanceExportData): void {
  const headers = ['Name', 'Email', 'Status', 'Join Time'];
  const rows = data.participants.map(p => [
    p.name,
    p.email,
    p.status || 'Pending',
    p.joinTime || '-',
  ]);

  // Add session info header
  const sessionInfo = [
    ['Session Attendance Report'],
    ['Session:', data.sessionTitle],
    ['Training:', data.trainingTitle],
    ['Date:', data.sessionDate],
    ['Time:', data.sessionTime],
    [''],
    ['Summary'],
    ['Total Participants:', data.stats.total.toString()],
    ['Present:', data.stats.present.toString()],
    ['Late:', data.stats.late.toString()],
    ['Absent:', data.stats.absent.toString()],
    ['Pending:', data.stats.pending.toString()],
    [''],
    headers,
    ...rows,
  ];

  const csvContent = sessionInfo
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `attendance-${data.sessionTitle}-${data.sessionDate}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(data: AttendanceExportData): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text('Session Attendance Report', 14, 22);

  // Session details
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Session: ${data.sessionTitle}`, 14, 35);
  doc.text(`Training: ${data.trainingTitle}`, 14, 42);
  doc.text(`Date: ${data.sessionDate}`, 14, 49);
  doc.text(`Time: ${data.sessionTime}`, 14, 56);

  // Stats summary
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Summary', 14, 70);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  const statsY = 78;
  doc.text(`Total: ${data.stats.total}`, 14, statsY);
  doc.text(`Present: ${data.stats.present}`, 50, statsY);
  doc.text(`Late: ${data.stats.late}`, 90, statsY);
  doc.text(`Absent: ${data.stats.absent}`, 120, statsY);
  doc.text(`Pending: ${data.stats.pending}`, 155, statsY);

  // Attendance table
  autoTable(doc, {
    startY: 90,
    head: [['Name', 'Email', 'Status', 'Join Time']],
    body: data.participants.map(p => [
      p.name,
      p.email,
      p.status || 'Pending',
      p.joinTime || '-',
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 60 },
      2: { cellWidth: 30 },
      3: { cellWidth: 40 },
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(`attendance-${data.sessionTitle}-${data.sessionDate}.pdf`);
}
