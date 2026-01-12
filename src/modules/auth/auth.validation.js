export const validateLogin = (body) => {
  if (!body.email || !body.password) {
    return "Email and password are required";
  }
  return null;
};

export const validateCreateUser = (body) => {
  const required = ["email", "password"];
  for (const field of required) {
    if (!body[field]) return `${field} is required`;
  }
  return null;
};
