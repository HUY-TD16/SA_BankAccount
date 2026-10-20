-- Validate existing rows as well as future writes. Do not silently repair
-- financial data or normalize emails (which could introduce duplicates).
BEGIN;

ALTER TABLE "users"
    ADD CONSTRAINT "users_email_normalized_check"
    CHECK ("email" = lower(btrim("email")));

ALTER TABLE "bank_accounts"
    ADD CONSTRAINT "bank_accounts_balance_nonnegative_check"
    CHECK ("current_balance" >= 0),
    ADD CONSTRAINT "bank_accounts_currency_vnd_check"
    CHECK ("currency" = 'VND'),
    ADD CONSTRAINT "bank_accounts_closed_at_check"
    CHECK (("status" = 'CLOSED') = ("closed_at" IS NOT NULL));

ALTER TABLE "financial_transactions"
    ADD CONSTRAINT "financial_transactions_amount_positive_check"
    CHECK ("amount" > 0),
    ADD CONSTRAINT "financial_transactions_balance_nonnegative_check"
    CHECK ("balance_after" >= 0),
    ADD CONSTRAINT "financial_transactions_type_reference_check"
    CHECK (
        ("transaction_type" = 'CREDIT' AND "reference_type" IN (
            'OPENING_DEPOSIT', 'CASH_DEPOSIT', 'TRANSFER_IN'
        ))
        OR
        ("transaction_type" = 'DEBIT' AND "reference_type" IN (
            'CASH_WITHDRAWAL', 'TRANSFER_OUT'
        ))
    );

ALTER TABLE "transfers"
    ADD CONSTRAINT "transfers_amount_positive_check"
    CHECK ("amount" > 0),
    ADD CONSTRAINT "transfers_distinct_accounts_check"
    CHECK ("source_account_id" <> "destination_account_id");

COMMIT;
