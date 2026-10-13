export const ACCOUNT_TYPES = ['PAYMENT', 'SAVINGS'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];