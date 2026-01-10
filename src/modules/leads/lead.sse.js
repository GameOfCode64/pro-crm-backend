const clients = new Set();

export const followUpSSE = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write("retry: 3000\n\n");

  clients.add(res);

  req.on("close", () => {
    clients.delete(res);
  });
};

export const notifyFollowUp = (payload) => {
  for (const client of clients) {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
};
