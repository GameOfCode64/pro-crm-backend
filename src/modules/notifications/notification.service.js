const clients = new Map(); // userId -> Set(res)

export const registerClient = (user, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (!clients.has(user.id)) {
    clients.set(user.id, new Set());
  }

  clients.get(user.id).add(res);

  req.on("close", () => {
    clients.get(user.id)?.delete(res);
  });
};

export const sendNotification = (userIds, payload) => {
  for (const userId of userIds) {
    const connections = clients.get(userId);
    if (!connections) continue;

    for (const res of connections) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }
};

/**
 * TEMP: derived notifications (no DB yet)
 */
export const getMyNotifications = async (user) => {
  return [
    {
      type: "INFO",
      message: "You have active follow-ups",
      createdAt: new Date(),
    },
  ];
};
