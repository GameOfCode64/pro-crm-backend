import xlsx from "xlsx";
import prisma from "../../config/db.js";

/**
 * Ensure manager always has EXACTLY ONE team
 */
const ensureManagerTeam = async (manager) => {
  const existingTeam = await prisma.team.findUnique({
    where: { managerId: manager.id },
  });

  if (existingTeam) {
    if (manager.teamId !== existingTeam.id) {
      await prisma.user.update({
        where: { id: manager.id },
        data: { teamId: existingTeam.id },
      });
    }
    return existingTeam.id;
  }

  const team = await prisma.team.create({
    data: {
      name: `${manager.name}'s Team`,
      managerId: manager.id,
    },
  });

  await prisma.user.update({
    where: { id: manager.id },
    data: { teamId: team.id },
  });

  return team.id;
};

export const uploadLeadsFromExcel = async (filePath, manager) => {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const teamId = await ensureManagerTeam(manager);

  const leads = [];

  for (const row of rows) {
    if (!row["Mob No"]) continue;

    leads.push({
      companyName: row["Company Name"]?.toString() || "",
      personName: row["Person Name"]?.toString() || "",
      phone: row["Mob No"]?.toString(),
      teamId,
      status: "FRESH",
      assignedToId: null, // ✅ NOT ASSIGNED AT UPLOAD
      meta: {
        department: row["Department"] || null,
        contractAmt: row["Contract Amt"] || null,
        state: row["State"] || null,
        roc: row["Roc"] || null,
      },
    });
  }

  if (!leads.length) {
    throw new Error("No valid leads found in Excel file");
  }

  return prisma.lead.createMany({
    data: leads,
    skipDuplicates: true,
  });
};
