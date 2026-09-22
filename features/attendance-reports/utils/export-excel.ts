/** Client-side Excel export for Monthly Attendance Report. */
import ExcelJS from "exceljs";
import { excelFilenameForReport } from "@/lib/attendance-report-rules";
import type { AttendanceReportPayload } from "@/types/api.types";

function formatExportDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}-${month}-${year}`;
}

export async function exportAttendanceReportExcel(
  report: AttendanceReportPayload,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DevSync";
  workbook.created = new Date();
  const fromMonth = report.fromMonth || report.month;
  const toMonth = report.toMonth || report.month;
  const singleEmployee =
    report.employees.length === 1
      ? report.employees[0]!.displayName?.trim() || report.employees[0]!.email
      : null;

  const headerRow = singleEmployee ? 9 : 8;
  const sheet = workbook.addWorksheet("Attendance Report", {
    // Freeze through the column header so data scrolls from the next row
    // (single-employee layout: freeze rows 1–9 → scroll from row 10).
    views: [{ state: "frozen", ySplit: headerRow }],
  });

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = "DEVSync";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF294354" } };

  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = singleEmployee
    ? "Employee Attendance Report"
    : "Monthly Attendance Exception Report";
  sheet.getCell("A2").font = { bold: true, size: 12 };

  sheet.getCell("A4").value = "Period:";
  sheet.getCell("B4").value = report.monthLabel;
  if (singleEmployee) {
    sheet.getCell("A5").value = "Employee:";
    sheet.getCell("B5").value = singleEmployee;
    sheet.getCell("A6").value = "Manager:";
    sheet.getCell("B6").value =
      report.manager.displayName?.trim() || report.manager.email;
    sheet.getCell("A7").value = "Generated On:";
    sheet.getCell("B7").value = new Date(report.generatedAt).toLocaleString(
      "en-GB",
      { timeZone: "Asia/Kolkata" },
    );
  } else {
    sheet.getCell("A5").value = "Manager:";
    sheet.getCell("B5").value =
      report.manager.displayName?.trim() || report.manager.email;
    sheet.getCell("A6").value = "Generated On:";
    sheet.getCell("B6").value = new Date(report.generatedAt).toLocaleString(
      "en-GB",
      { timeZone: "Asia/Kolkata" },
    );
  }

  const headers = ["Date", "Employee", "Action", "Details", "Manager Remark"];
  headers.forEach((header, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0E9384" },
    };
  });

  report.entries.forEach((entry, index) => {
    const row = headerRow + 1 + index;
    sheet.getCell(row, 1).value = formatExportDate(entry.date);
    sheet.getCell(row, 2).value = entry.employeeName;
    sheet.getCell(row, 3).value = entry.action;
    sheet.getCell(row, 4).value = entry.details;
    sheet.getCell(row, 5).value = entry.managerRemark || "-";
  });

  const summaryStart = headerRow + report.entries.length + 3;
  sheet.getCell(summaryStart, 1).value = "Summary";
  sheet.getCell(summaryStart, 1).font = { bold: true };
  const summaryLines: Array<[string, number]> = [
    ["Total Late Arrivals", report.summary.lateArrivals],
    ["Total Early Departures", report.summary.earlyDepartures],
    ["Total Leaves", report.summary.leaves],
    ["Total Absences", report.summary.absences],
    ["Total Missing Punches", report.summary.missingPunches],
  ];
  summaryLines.forEach(([label, value], index) => {
    sheet.getCell(summaryStart + 1 + index, 1).value = label;
    sheet.getCell(summaryStart + 1 + index, 2).value = value;
  });

  sheet.columns = [
    { width: 14 },
    { width: 22 },
    { width: 16 },
    { width: 40 },
    { width: 28 },
  ];
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: {
      row: headerRow + Math.max(report.entries.length, 1),
      column: 5,
    },
  };

  const summarySheet = workbook.addWorksheet("Employee Summary");
  summarySheet.getCell("A1").value = "Employee Summary";
  summarySheet.getCell("A1").font = { bold: true, size: 12 };
  summarySheet.getCell("A2").value = report.monthLabel;

  const empHeaders = [
    "Employee",
    "Working days",
    "Present",
    "Late",
    "Early",
    "Leave",
    "Absent",
    "Missing Punch",
  ];
  empHeaders.forEach((header, index) => {
    const cell = summarySheet.getCell(4, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0E9384" },
    };
  });

  report.employeeSummary.forEach((row, index) => {
    const r = 5 + index;
    summarySheet.getCell(r, 1).value = row.employeeName;
    summarySheet.getCell(r, 2).value = row.workingDays;
    summarySheet.getCell(r, 3).value = row.present;
    summarySheet.getCell(r, 4).value = row.late;
    summarySheet.getCell(r, 5).value = row.early;
    summarySheet.getCell(r, 6).value = row.leave;
    summarySheet.getCell(r, 7).value = row.absent;
    summarySheet.getCell(r, 8).value = row.missingPunch;
  });

  summarySheet.columns = [
    { width: 24 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
  ];
  summarySheet.views = [{ state: "frozen", ySplit: 4 }];

  if (report.monthSummaries?.length) {
    const monthSheet = workbook.addWorksheet("Monthly Breakdown");
    monthSheet.getCell("A1").value = "Monthly Breakdown";
    monthSheet.getCell("A1").font = { bold: true, size: 12 };
    monthSheet.getCell("A2").value = report.monthLabel;
    const monthHeaders = [
      "Month",
      "Working days",
      "Present",
      "Late",
      "Early",
      "Leave",
      "Absent",
      "Missing Punch",
    ];
    monthHeaders.forEach((header, index) => {
      const cell = monthSheet.getCell(4, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0E9384" },
      };
    });
    report.monthSummaries.forEach((row, index) => {
      const r = 5 + index;
      monthSheet.getCell(r, 1).value = row.monthLabel;
      monthSheet.getCell(r, 2).value = row.workingDays;
      monthSheet.getCell(r, 3).value = row.present;
      monthSheet.getCell(r, 4).value = row.late;
      monthSheet.getCell(r, 5).value = row.early;
      monthSheet.getCell(r, 6).value = row.leave;
      monthSheet.getCell(r, 7).value = row.absent;
      monthSheet.getCell(r, 8).value = row.missingPunch;
    });
    monthSheet.columns = [
      { width: 20 },
      { width: 14 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 14 },
    ];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = excelFilenameForReport({
    fromMonth,
    toMonth,
    employeeName: singleEmployee,
  });
  anchor.click();
  URL.revokeObjectURL(url);
}
