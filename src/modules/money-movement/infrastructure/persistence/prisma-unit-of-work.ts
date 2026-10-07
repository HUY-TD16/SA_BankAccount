// import { Injectable } from "@nestjs/common";
// import { Prisma } from "@prisma/client";
// import { PrismaService } from "@src/infrastructure/prisma";
// import {
//   AccountSnapshot,
//   CreateTransactionEntryInput,
//   CreateTransferInput,
//   MoneyMovementTransactionContext,
//   TransactionEntryRecord,
//   TransferRecord,
//   UnitOfWorkPort,
// } from "../../application/ports/unit-of-work.port";

// /**
//  * prisma-unit-of-work.ts
//  *
//  * !!! BLOCKER TRƯỚC KHI FILE NÀY COMPILE ĐƯỢC !!!
//  * File này gọi `tx.financialTransaction` và `tx.transfer` — hai Prisma model
//  * CHƯA tồn tại trong schema.prisma hiện tại (schema hiện chỉ có User, Account
//  * theo db.md mục 1.1). Cần thêm 2 model này + chạy `prisma migrate dev` trước,
//  * theo đúng cột đã chốt ở phase1-domain-database-api-contract.md mục 3.4/3.5
//  * (hoặc bản rút gọn ở phase1-scope-reduced.md mục 3.4/3.5).
//  *
//  * Tên field camelCase dưới đây (accountId, transferId, balanceAfter...) giả định
//  * schema dùng @map snake_case → Prisma field camelCase theo đúng convention đã
//  * thấy trong common-usage-guide.md (account.userId, account.currentBalance).
//  * Nếu schema thật đặt tên khác, sửa lại đúng tên field tương ứng ở file này.
//  *
//  * Vì sao `lockForUpdate` dùng $queryRaw thay vì Prisma query builder thường:
//  * Prisma không hỗ trợ `SELECT ... FOR UPDATE` qua API object-based (findUnique,
//  * findFirst...) — bắt buộc phải dùng raw SQL để khóa row trong transaction.
//  */

// type PrismaTx = Prisma.TransactionClient;

// interface RawAccountLockRow {
//   id: string;
//   userId: string;
//   currentBalance: string;
//   status: "ACTIVE" | "CLOSED";
// }

// @Injectable()
// export class PrismaUnitOfWork implements UnitOfWorkPort {
//   constructor(private readonly prisma: PrismaService) {}

//   async execute<T>(
//     work: (ctx: MoneyMovementTransactionContext) => Promise<T>,
//   ): Promise<T> {
//     return this.prisma.$transaction(async (tx) => {
//       const ctx = this.buildContext(tx);
//       return work(ctx);
//     });
//   }

//   private buildContext(tx: PrismaTx): MoneyMovementTransactionContext {
//     return {
//       accounts: {
//         lockForUpdate: async (
//           accountId: string,
//         ): Promise<AccountSnapshot | null> => {
//           const rows = await tx.$queryRaw<RawAccountLockRow[]>(
//             Prisma.sql`
//               SELECT
//                 id,
//                 user_id AS "userId",
//                 current_balance::text AS "currentBalance",
//                 status
//               FROM bank_accounts
//               WHERE id = ${accountId}
//               FOR UPDATE
//             `,
//           );
//           return rows[0] ?? null;
//         },

//         updateBalance: async (
//           accountId: string,
//           newBalance: string,
//         ): Promise<void> => {
//           // TODO: đổi "account" thành đúng tên delegate Prisma thật (model Account
//           // hiện có sẵn theo db.md — kiểm tra lại tên field currentBalance có khớp
//           // schema.prisma thật không).
//           await tx.account.update({
//             where: { id: accountId },
//             data: { currentBalance: newBalance },
//           });
//         },
//       },

//       transactions: {
//         create: async (
//           input: CreateTransactionEntryInput,
//         ): Promise<TransactionEntryRecord> => {
//           // TODO: model FinancialTransaction CHƯA tồn tại trong schema — thêm trước.
//           const record = await tx.financialTransaction.create({
//             data: {
//               accountId: input.accountId,
//               transferId: input.transferId ?? null,
//               transactionType: input.transactionType,
//               referenceType: input.referenceType,
//               amount: input.amount,
//               balanceAfter: input.balanceAfter,
//               description: input.description ?? null,
//             },
//           });
//           return record as unknown as TransactionEntryRecord;
//         },
//       },

//       transfers: {
//         findBySourceAndIdempotencyKey: async (
//           sourceAccountId: string,
//           idempotencyKey: string,
//         ): Promise<TransferRecord | null> => {
//           // TODO: model Transfer CHƯA tồn tại trong schema — thêm trước.
//           // Giả định unique constraint đặt tên mặc định Prisma sinh ra là
//           // "sourceAccountId_idempotencyKey" (@@unique([sourceAccountId, idempotencyKey])).
//           const record = await tx.transfer.findUnique({
//             where: {
//               sourceAccountId_idempotencyKey: {
//                 sourceAccountId,
//                 idempotencyKey,
//               },
//             },
//           });
//           return record ? (record as unknown as TransferRecord) : null;
//         },

//         create: async (input: CreateTransferInput): Promise<TransferRecord> => {
//           const record = await tx.transfer.create({
//             data: {
//               sourceAccountId: input.sourceAccountId,
//               destinationAccountId: input.destinationAccountId,
//               initiatedByUserId: input.initiatedByUserId,
//               amount: input.amount,
//               description: input.description ?? null,
//               idempotencyKey: input.idempotencyKey,
//             },
//           });
//           return record as unknown as TransferRecord;
//         },
//       },
//     };
//   }
// }
