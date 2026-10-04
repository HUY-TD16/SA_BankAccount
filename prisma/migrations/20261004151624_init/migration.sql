-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PAYMENT', 'SAVINGS');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('OPENING_DEPOSIT', 'CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "account_name" VARCHAR(100) NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "current_balance" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "transfer_id" TEXT,
    "transaction_type" "TransactionType" NOT NULL,
    "reference_type" "ReferenceType" NOT NULL,
    "amount" DECIMAL(18,0) NOT NULL,
    "balance_after" DECIMAL(18,0) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "description" VARCHAR(250),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "source_account_id" TEXT NOT NULL,
    "destination_account_id" TEXT NOT NULL,
    "initiated_by_user_id" TEXT NOT NULL,
    "amount" DECIMAL(18,0) NOT NULL,
    "description" VARCHAR(250),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_account_number_key" ON "bank_accounts"("account_number");

-- CreateIndex
CREATE INDEX "idx_accounts_user_status_created" ON "bank_accounts"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_transactions_account_created" ON "financial_transactions"("account_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_transfer_id_transaction_type_key" ON "financial_transactions"("transfer_id", "transaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_source_account_id_idempotency_key_key" ON "transfers"("source_account_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
