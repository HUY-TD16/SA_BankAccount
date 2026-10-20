# Database CHECK constraints

Migration `20261020000000_add_domain_check_constraints` implements the checks in
sections 3.2–3.5 of `phase1_document/phase1-scope-reduced.md` and section 3 of
`phase1_document/phase1-domain-database-api-contract.md`.

| Table | Constraint |
| --- | --- |
| `users` | Email equals `lower(btrim(email))` |
| `bank_accounts` | `current_balance >= 0` |
| `bank_accounts` | Currency is `VND` |
| `bank_accounts` | `CLOSED` if and only if `closed_at IS NOT NULL` |
| `financial_transactions` | `amount > 0` |
| `financial_transactions` | `balance_after >= 0` |
| `financial_transactions` | CREDIT for OPENING_DEPOSIT, CASH_DEPOSIT, TRANSFER_IN; DEBIT for CASH_WITHDRAWAL, TRANSFER_OUT |
| `transfers` | `amount > 0` |
| `transfers` | Source differs from destination |

These checks live in SQL migrations because Prisma schema does not represent
them. Use migrations to provision databases; `prisma db push` alone does not
install these checks. The existing unique email index together with the
normalization check enforces uniqueness for normalized emails.

## Apply

With `DATABASE_URL` targeting the intended database:

```powershell
npx prisma migrate deploy
```

The migration validates existing rows and runs atomically in an explicit
transaction. Invalid existing data causes it to fail without partially adding
checks. It does not modify balances, transactions or email addresses. Review and
correct any reported invalid data before retrying; after a failed Prisma deploy,
mark this migration rolled back with
`npx prisma migrate resolve --rolled-back 20261020000000_add_domain_check_constraints`
before deploying again. Schedule deployment appropriately: PostgreSQL must lock
and scan these tables to add validated checks.

## Verify

Point `DATABASE_URL` at a dedicated PostgreSQL database whose name ends in `_test`.
Then run:

```powershell
npx jest --config jest.integration.config.js --runInBand test/integration/database/check-constraints.spec.ts
```

This suite creates a uniquely named schema, applies the SQL migrations in order,
and issues direct SQL writes. It checks PostgreSQL error code `23514` and the
specific constraint name, all five valid and invalid type/reference mappings,
both inconsistent account states, zero/negative amounts, negative balances,
email case/whitespace, same-account transfers, and valid boundary values.
Each test rolls back its data; the suite removes only its own schema afterward.
It does not apply migrations to the database's public schema.
