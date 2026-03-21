import ExcelJS from "exceljs";

/* ─────────────────────────────────────────────
   SHARED STYLE HELPER
   Applies to the header row of any sheet.
───────────────────────────────────────────── */
const styleHeaderRow = (sheet) => {
  const headerRow = sheet.getRow(1);

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" }, // dark gray — change to your brand color if needed
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  headerRow.height = 30;
};

/* ─────────────────────────────────────────────
   ATTENDANCE WORKBOOK
───────────────────────────────────────────── */
export const buildAttendanceWorkbook = async (rows, { from, to }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CRM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Attendance", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Employee Name", key: "employeeName", width: 26 },
    { header: "Email", key: "email", width: 32 },
    { header: "Present", key: "present", width: 12 },
    { header: "Calls Made", key: "callsMade", width: 14 },
  ];

  sheet.addRows(rows);
  styleHeaderRow(sheet);

  // Data rows — alternate shading + center align
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "middle", horizontal: "center" };
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      });
    }
  });

  return workbook;
};

/* ─────────────────────────────────────────────
   LEADS WORKBOOK  (existing xlsx export)
───────────────────────────────────────────── */
export const buildLeadsWorkbook = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CRM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Leads", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Collect all form keys dynamically
  const formKeys = new Set();
  rows.forEach((r) =>
    Object.keys(r.form || {}).forEach((k) => formKeys.add(k)),
  );

  sheet.columns = [
    { header: "Lead Name", key: "leadName", width: 22 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Company", key: "company", width: 22 },
    { header: "Campaign", key: "campaign", width: 22 },
    { header: "Assigned To", key: "assignedTo", width: 20 },
    { header: "Status", key: "status", width: 18 },
    { header: "Outcome", key: "outcome", width: 18 },
    { header: "Remark", key: "remark", width: 32 },
    { header: "Call Date", key: "callDate", width: 14 },
    ...[...formKeys].map((k) => ({ header: k, key: k, width: 22 })),
  ];

  rows.forEach((r) => {
    sheet.addRow({ ...r, ...r.form });
  });

  styleHeaderRow(sheet);

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "middle", horizontal: "left" };
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      });
    }
  });

  return workbook;
};

/* ─────────────────────────────────────────────
   CALLING REPORT WORKBOOK  (NEW)
   Includes form data filled by the caller.
   Used by the manager's Team Calling Report export.
───────────────────────────────────────────── */
export const buildCallingReportWorkbook = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CRM";
  workbook.created = new Date();

  // ── Sheet 1: Detailed call log ──────────────────────────
  const sheet = workbook.addWorksheet("Call Log", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Collect all form field keys dynamically across all rows
  const formKeys = new Set();
  rows.forEach((r) =>
    Object.keys(r.formData || {}).forEach((k) => formKeys.add(k)),
  );

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Time", key: "time", width: 12 },
    { header: "Employee", key: "employee", width: 22 },
    { header: "Lead Name", key: "leadName", width: 22 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Lead Status", key: "leadStatus", width: 18 },
    { header: "Campaign", key: "campaign", width: 20 },
    { header: "Outcome", key: "outcome", width: 18 },
    { header: "Duration (s)", key: "duration", width: 14 },
    { header: "Remark", key: "remark", width: 32 },
    // ── Dynamic form columns ──
    ...[...formKeys].map((k) => ({
      header:
        k.charAt(0).toUpperCase() +
        k
          .slice(1)
          .replace(/([A-Z])/g, " $1")
          .trim(),
      key: `form_${k}`,
      width: 22,
    })),
  ];

  rows.forEach((r) => {
    const formCols = {};
    for (const k of formKeys) {
      formCols[`form_${k}`] = r.formData?.[k] ?? "";
    }
    sheet.addRow({
      date: r.date,
      time: r.time,
      employee: r.employee,
      leadName: r.leadName,
      phone: r.phone,
      leadStatus: r.leadStatus,
      campaign: r.campaign,
      outcome: r.outcome,
      duration: r.duration,
      remark: r.remark,
      ...formCols,
    });
  });

  styleHeaderRow(sheet);

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "middle", horizontal: "left" };
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      });
    }
  });

  // ── Sheet 2: Employee summary ────────────────────────────
  const summarySheet = workbook.addWorksheet("Employee Summary", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  summarySheet.columns = [
    { header: "Employee", key: "employee", width: 24 },
    { header: "Total Calls", key: "totalCalls", width: 14 },
    { header: "Duration (s)", key: "duration", width: 14 },
    { header: "Avg Duration", key: "avgDuration", width: 16 },
  ];

  // Aggregate per employee
  const empMap = new Map();
  for (const r of rows) {
    if (!empMap.has(r.employee)) {
      empMap.set(r.employee, { totalCalls: 0, duration: 0 });
    }
    const e = empMap.get(r.employee);
    e.totalCalls++;
    e.duration += Number(r.duration) || 0;
  }

  for (const [name, data] of empMap.entries()) {
    summarySheet.addRow({
      employee: name,
      totalCalls: data.totalCalls,
      duration: data.duration,
      avgDuration:
        data.totalCalls > 0 ? Math.round(data.duration / data.totalCalls) : 0,
    });
  }

  styleHeaderRow(summarySheet);
  summarySheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "middle", horizontal: "center" };
  });

  return workbook;
};
