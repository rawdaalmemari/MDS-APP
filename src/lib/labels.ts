import type { LeaveStatus, LeaveType } from './api';

export const statusBadge: Record<LeaveStatus, { text: string; tone: 'pending' | 'approved' | 'rejected' | 'neutral' }> = {
  pending: { text: 'Pending', tone: 'pending' },
  approved: { text: 'Approved', tone: 'approved' },
  rejected: { text: 'Rejected', tone: 'rejected' },
  cancelled: { text: 'Cancelled', tone: 'neutral' },
};

export const leaveName: Record<LeaveType, string> = { annual: 'Annual', sick: 'Sick', unpaid: 'Unpaid' };
