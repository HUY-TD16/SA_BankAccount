export type AccountStatus = "ACTIVE" | "FROZEN" | "CLOSED";

export interface AccountLookupResult {
  readonly id: string;
  readonly accountNumber: string;
  readonly currency: string;
  readonly status: AccountStatus;
}

export interface AccountsFacade {
  findByAccountNumber(
    accountNumber: string,
  ): Promise<AccountLookupResult | null>;
}
