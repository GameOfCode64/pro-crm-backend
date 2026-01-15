import {
  buildAttendanceWorkbook,
  buildLeadsWorkbook,
} from "./reports.excel.js";

import { getAttendanceData, getLeadsExportData } from "./report.service.js";

export const exportAttendance = async (req, res, next) => {
  try {
    const { from, to, employeeIds = [] } = req.body;

    if (!from || !to) {
      throw new Error("From and To dates are required");
    }

    const data = await getAttendanceData({
      manager: req.user,
      from,
      to,
      employeeIds,
    });

    const workbook = await buildAttendanceWorkbook(data, { from, to });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${from}_to_${to}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

export const exportLeads = async (req, res, next) => {
  try {
    const { from, to, outcomeNames = [] } = req.body;

    if (!from || !to) {
      throw new Error("From and To dates are required");
    }

    const rows = await getLeadsExportData({
      manager: req.user,
      from,
      to,
      outcomeNames,
    });

    const workbook = await buildLeadsWorkbook(rows);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=leads_${from}_to_${to}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};
