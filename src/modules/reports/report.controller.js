import {
  buildAttendanceWorkbook,
  buildLeadsWorkbook,
} from "./reports.excel.js";

import {
  getAttendanceData,
  getLeadsExportData,
  getMyCallingReportService,
  getTeamCallingReportService,
  getTeamCallingReportCsvService,
  getAttendanceService,
  getAttendanceCsvService,
} from "./report.service.js";

/* ════════════════════════════════════════════════════════════════
   XLSX EXPORTS  (existing)
   ════════════════════════════════════════════════════════════════ */

export const exportAttendance = async (req, res, next) => {
  try {
    const { from, to, employeeIds = [] } = req.body;
    if (!from || !to) throw new Error("From and To dates are required");

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

export const previewLeads = async (req, res, next) => {
  try {
    const { from, to, campaignId, statuses = [] } = req.body;
    if (!from || !to)
      return res.status(400).json({ error: "From and To dates are required" });

    const rows = await getLeadsExportData({
      manager: req.user,
      from,
      to,
      campaignId,
      statuses,
    });
    res.json(rows.slice(0, 100));
  } catch (err) {
    next(err);
  }
};

export const exportLeads = async (req, res, next) => {
  try {
    const { from, to, campaignId, statuses = [] } = req.body;
    if (!from || !to) throw new Error("From and To dates are required");

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

/* ════════════════════════════════════════════════════════════════
   MY CALLING REPORT  (employee)
   ════════════════════════════════════════════════════════════════ */

export const getMyCallingReportController = async (req, res) => {
  try {
    const { from, to, period = "DAY" } = req.query;
    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query params are required" });
    }

    const data = await getMyCallingReportService({
      userId: req.user.id,
      teamId: req.user.teamId,
      from,
      to,
      period,
    });

    return res.json(data);
  } catch (err) {
    console.error("getMyCallingReportController:", err);
    return res.status(500).json({ error: "Failed to fetch calling report" });
  }
};

/* ════════════════════════════════════════════════════════════════
   TEAM CALLING REPORT  (manager)
   ════════════════════════════════════════════════════════════════ */

export const getTeamCallingReportController = async (req, res) => {
  try {
    const { from, to, period = "DAY", employeeId } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const data = await getTeamCallingReportService({
      teamId: req.user.teamId,
      employeeId: employeeId || undefined,
      from,
      to,
      period,
    });

    return res.json(data);
  } catch (err) {
    console.error("getTeamCallingReportController:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch team calling report" });
  }
};

export const exportTeamCallingReportController = async (req, res) => {
  try {
    const { from, to, period = "DAY", employeeId } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const csv = await getTeamCallingReportCsvService({
      teamId: req.user.teamId,
      employeeId: employeeId || undefined,
      from,
      to,
      period,
    });

    const filename = `calling-report-${new Date(from).toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error("exportTeamCallingReportController:", err);
    return res.status(500).json({ error: "Failed to export calling report" });
  }
};

/* ════════════════════════════════════════════════════════════════
   ATTENDANCE  (manager)
   ════════════════════════════════════════════════════════════════ */

export const getAttendanceController = async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const data = await getAttendanceService({
      teamId: req.user.teamId,
      employeeId: employeeId || undefined,
      from,
      to,
    });

    return res.json(data);
  } catch (err) {
    console.error("getAttendanceController:", err);
    return res.status(500).json({ error: "Failed to fetch attendance" });
  }
};

export const exportAttendanceController = async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const csv = await getAttendanceCsvService({
      teamId: req.user.teamId,
      employeeId: employeeId || undefined,
      from,
      to,
    });

    const filename = `attendance-${new Date(from).toISOString().slice(0, 7)}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error("exportAttendanceController:", err);
    return res.status(500).json({ error: "Failed to export attendance" });
  }
};
