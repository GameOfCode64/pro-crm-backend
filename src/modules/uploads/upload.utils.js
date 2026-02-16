import xlsx from "xlsx";

export const parseUploadFile = async (filePath) => {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  const headers = Object.keys(rows[0] || {});
  const sampleRows = rows.slice(0, 5);

  return { headers, sampleRows, rows };
};

export const validateMappings = (mappings) => {
  const targets = mappings.map((m) => m.targetField);

  if (!targets.includes("phone")) {
    throw new Error("Phone mapping is required");
  }

  const duplicates = targets.filter((v, i) => targets.indexOf(v) !== i);

  if (duplicates.length) {
    throw new Error("Duplicate target fields not allowed");
  }
};
