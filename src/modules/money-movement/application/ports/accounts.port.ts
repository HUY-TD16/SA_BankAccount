export interface TransferRecipient {
    readonly accountId: number;
    readonly accountNumber: string;
    readonly currency: string;
    readonly status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
}

export interface AccountsPort {
    findRecipient(accountNumber: string): Promise<TransferRecipient | null>;
}
