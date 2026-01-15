import ExcelJS from "exceljs";

export const buildAttendanceWorkbook = async (rows, { from, to }) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Employee Name", key: "employeeName", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Present", key: "present", width: 12 },
    { header: "Calls Made", key: "callsMade", width: 14 },
  ];

  sheet.addRows(rows);

  // Header style
  sheet.getRow(1).font = { bold: true };

  // Center align
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: "middle", horizontal: "center" };
    }
  });

  return workbook;
};

export const buildLeadsWorkbook = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leads");

  // 🔍 Collect all form keys dynamically
  const formKeys = new Set();
  rows.forEach((r) =>
    Object.keys(r.form || {}).forEach((k) => formKeys.add(k))
  );

  sheet.columns = [
    { header: "Lead Name", key: "leadName", width: 20 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Company", key: "company", width: 20 },
    { header: "Assigned To", key: "assignedTo", width: 18 },
    { header: "Outcome", key: "outcome", width: 18 },
    { header: "Remark", key: "remark", width: 30 },
    { header: "Call Date", key: "callDate", width: 14 },
    ...[...formKeys].map((k) => ({
      header: k,
      key: k,
      width: 20,
    })),
  ];

  rows.forEach((r) => {
    sheet.addRow({
      ...r,
      ...r.form,
    });
  });

  sheet.getRow(1).font = { bold: true };

  return workbook;
};
