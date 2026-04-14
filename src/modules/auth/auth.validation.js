export const validateLogin = (body) => {
  // Accept either email or username + password
  const identifier = body.email || body.username;
  if (!identifier) return "Email or username is required";
  if (!body.password) return "Password is required";
  return null;
};

export const validateCreateUser = (body) => {
  if (!body.name?.trim()) return "Name is required";
  if (!body.email?.trim()) return "Email is required";
  if (!body.password) return "Password is required";
  if (body.password.length < 6) return "Password must be at least 6 characters";
  return null;
};
