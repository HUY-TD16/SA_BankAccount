export const ACCOUNT_TYPE = ['PAYMENT', 'SAVINGS'] as const;
export type AccountType = (typeof ACCOUNT_TYPE)[number];