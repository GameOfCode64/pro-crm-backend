export const validateCreateTeam = (body) => {
  if (!body.name) return "Team name is required";
  if (!body.managerId) return "Manager ID is required";
  return null;
};
