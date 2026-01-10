export const validateFormSchema = (schema) => {
  if (!schema?.fields?.length) {
    throw new Error("Form must have at least one field");
  }
};
