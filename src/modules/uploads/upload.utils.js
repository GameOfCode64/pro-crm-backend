import xlsx from "xlsx";

/**
 * Parse an upload file.
 * @param {string} filePath - Path to the file on disk
 * @param {string|null} sheetName - Specific sheet to parse (null = first sheet)
 * @returns {{ headers, sampleRows, rows, sheets }}
 *   sheets = all sheet names in the workbook (for multi-sheet Excel)
 */
export const parseUploadFile = async (filePath, sheetName = null) => {
  const wb = xlsx.readFile(filePath);

  // Always return all sheet names so frontend can show the picker
  const sheets = wb.SheetNames;

  // Use requested sheet, fall back to first
  const targetSheet =
    sheetName && sheets.includes(sheetName) ? sheetName : sheets[0];

  const sheet = wb.Sheets[targetSheet];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const headers = Object.keys(rows[0] || {});
  const sampleRows = rows.slice(0, 5);

  return { headers, sampleRows, rows, sheets, activeSheet: targetSheet };
};

export const validateMappings = (mappings) => {
  const targets = mappings.map((m) => m.targetField);

  if (!targets.includes("phone")) {
    throw new Error("Phone mapping is required");
  }

  // Allow duplicate meta.* targets but not core fields
  const coreTargets = targets.filter((t) => !t.startsWith("meta."));
  const duplicates = coreTargets.filter((v, i) => coreTargets.indexOf(v) !== i);

  if (duplicates.length) {
    throw new Error(`Duplicate target fields: ${duplicates.join(", ")}`);
  }
};
