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
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${from}_to_${to}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

// NEW: Preview leads data before export
export const previewLeads = async (req, res, next) => {
  try {
    const { from, to, campaignId, statuses = [] } = req.body;

    if (!from || !to) {
      return res.status(400).json({ error: "From and To dates are required" });
    }

    const rows = await getLeadsExportData({
      manager: req.user,
      from,
      to,
      campaignId,
      statuses,
    });

    // Return JSON preview (limit to first 100 rows for performance)
    res.json(rows.slice(0, 100));
  } catch (err) {
    next(err);
  }
};

// UPDATED: Export leads with campaign and status filters
export const exportLeads = async (req, res, next) => {
  try {
    const { from, to, campaignId, statuses = [] } = req.body;

    if (!from || !to) {
      throw new Error("From and To dates are required");
    }

    const rows = await getLeadsExportData({
      manager: req.user,
      from,
      to,
      campaignId,
      statuses,
    });

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No data found for the selected criteria" });
    }

    const workbook = await buildLeadsWorkbook(rows);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=leads_${from}_to_${to}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};
