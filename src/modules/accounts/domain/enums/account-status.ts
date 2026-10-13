export const ACCOUNT_STATUSES = ['ACTIVE', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
