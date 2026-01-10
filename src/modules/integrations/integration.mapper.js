export const mapLead = (provider, payload) => {
  switch (provider) {
    case "JUSTDIAL":
      return {
        companyName: payload.company_name || "Unknown",
        personName: payload.contact_person || "Unknown",
        phone: payload.mobile,
      };

    case "INDIAMART":
      return {
        companyName: payload.sender_company,
        personName: payload.sender_name,
        phone: payload.sender_mobile,
      };

    default:
      throw new Error("Unsupported provider");
  }
};
