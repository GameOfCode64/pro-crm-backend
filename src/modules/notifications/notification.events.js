import { sendNotification } from "./notification.service.js";

export const notifyLeadReassigned = ({ toUserId, leadId }) => {
  sendNotification([toUserId], {
    type: "LEAD_REASSIGNED",
    message: "A lead has been assigned to you",
    leadId,
    createdAt: new Date(),
  });
};

export const notifyFollowUpDue = ({ userId, leadId }) => {
  sendNotification([userId], {
    type: "FOLLOW_UP_DUE",
    message: "You have a follow-up due",
    leadId,
    createdAt: new Date(),
  });
};

export const notifyOverdueEscalation = ({ managerId, leadId }) => {
  sendNotification([managerId], {
    type: "OVERDUE_ESCALATED",
    message: "A lead was auto-escalated",
    leadId,
    createdAt: new Date(),
  });
};
