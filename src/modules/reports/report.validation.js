export const parseDateRange = (query) => {
  const from = query.from
    ? new Date(query.from)
    : new Date(new Date().setDate(1));

  const to = query.to ? new Date(query.to) : new Date();

  return { from, to };
};
