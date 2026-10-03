export const ACCOUNT_STATUS = ['ACTIVE', 'CLOSED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[number];
