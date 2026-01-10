import xlsx from "xlsx";
import prisma from "../../config/db.js";

export const uploadLeadsFromExcel = async (filePath, manager) => {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const employees = await prisma.user.findMany({
    where: {
      teamId: manager.teamId,
      role: "EMPLOYEE",
      isActive: true,
    },
  });

  if (!employees.length) {
    throw new Error("No employees to assign leads");
  }

  let i = 0;
  const leads = [];

  for (const row of rows) {
    if (!row["Mob No"]) continue;

    const emp = employees[i % employees.length];
    i++;

    leads.push({
      companyName: row["Company Name"]?.toString(),
      personName: row["Person Name"]?.toString(),
      phone: row["Mob No"]?.toString(),
      assignedToId: emp.id,
      teamId: manager.teamId,
      status: "FRESH",
      meta: {
        department: row["Department"] || null,
        contractAmt: row["Contract Amt"] || null,
        state: row["State"] || null,
        roc: row["Roc"] || null,
      },
    });
  }

  return prisma.lead.createMany({
    data: leads,
    skipDuplicates: true,
  });
};
