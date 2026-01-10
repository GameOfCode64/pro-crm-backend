/**
 * Dashboard real-time event broadcaster
 * Uses existing SSE infrastructure
 */

import { notifyFollowUp } from "../leads/lead.sse.js";

/**
 * Emit when a call is logged
 */
export const emitCallLogged = ({ leadId, userId }) => {
  notifyFollowUp({
    scope: "DASHBOARD",
    type: "CALL_LOGGED",
    leadId,
    userId,
  });
};

/**
 * Emit when follow-up is created or updated
 */
export const emitFollowUpUpdate = ({ leadId, followUpAt }) => {
  notifyFollowUp({
    scope: "DASHBOARD",
    type: "FOLLOW_UP_UPDATED",
    leadId,
    followUpAt,
  });
};

/**
 * Emit when lead is reassigned
 */
export const emitLeadReassigned = ({ leadId, fromUserId, toUserId }) => {
  notifyFollowUp({
    scope: "DASHBOARD",
    type: "LEAD_REASSIGNED",
    leadId,
    fromUserId,
    toUserId,
  });
};

/**
 * Emit when overdue escalation happens
 */
export const emitOverdueEscalation = ({ leadId, assignedTo }) => {
  notifyFollowUp({
    scope: "DASHBOARD",
    type: "OVERDUE_ESCALATED",
    leadId,
    assignedTo,
  });
};
