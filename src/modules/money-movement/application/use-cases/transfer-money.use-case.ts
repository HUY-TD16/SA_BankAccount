import { Injectable, Inject } from '@nestjs/common';
import { Money } from '../../../../common/domain/value-objects/money.value-object';
import { 
  UnitOfWorkPort, 
  UNIT_OF_WORK, 
  MoneyMovementTransactionContext 
} from '../ports/unit-of-work.port';

export interface TransferMoneyCommand {
  sourceAccountId: string;
  destinationAccountId: string;
  initiatedByUserId: string; 
  amount: string;
  idempotencyKey: string;   
  description?: string;
}

@Injectable()
export class TransferMoneyUseCase {
    constructor(
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}
  
    async execute(command: TransferMoneyCommand): Promise<any> {
        return this.unitOfWork.execute(async (ctx: MoneyMovementTransactionContext) => {
            const existingTransfer = await ctx.transfers.findBySourceAndIdempotencyKey(
                command.sourceAccountId,
                command.idempotencyKey,
            );

            if (existingTransfer) {
                return existingTransfer;
            }
            if (command.sourceAccountId === command.destinationAccountId) {
                throw new Error('SelfTransferNotAllowed');
            }

            const [firstId, secondId] = 
                command.sourceAccountId < command.destinationAccountId
                    ? [command.sourceAccountId, command.destinationAccountId]
                    : [command.destinationAccountId, command.sourceAccountId];
            const firstAccount = await ctx.accounts.lockForUpdate(firstId);
            const secondAccount = await ctx.accounts.lockForUpdate(secondId);
            const sourceAccount = firstId === command.sourceAccountId ? firstAccount : secondAccount;
            const destAccount = firstId === command.destinationAccountId ? firstAccount : secondAccount;

            if (!sourceAccount || sourceAccount.userId !== command.initiatedByUserId) {
                throw new Error('SourceAccountNotFoundError'); 
            }
            if (sourceAccount.status === 'CLOSED') {
                throw new Error('SourceAccountClosedError');
            }
            if (!destAccount) {
                throw new Error('DestinationAccountNotFoundError'); 
            }
            if (destAccount.status === 'CLOSED') {
                throw new Error('DestinationAccountClosedError');
            }

            const sourceBalance = Money.fromString(sourceAccount.currentBalance);
            const destBalance = Money.fromString(destAccount.currentBalance);
            const transferAmount = Money.fromString(command.amount, { allowZero: false });
            if (!sourceBalance.isGreaterThanOrEqual(transferAmount)) {
                throw new Error('InsufficientFundsError'); 
            }

            const newSourceBalance = sourceBalance.subtract(transferAmount).toDecimalString();
            const newDestBalance = destBalance.add(transferAmount).toDecimalString();

            await ctx.accounts.updateBalance(sourceAccount.id, newSourceBalance);
            await ctx.accounts.updateBalance(destAccount.id, newDestBalance);

            const transferRecord = await ctx.transfers.create({
                sourceAccountId: sourceAccount.id,
                destinationAccountId: destAccount.id,
                initiatedByUserId: command.initiatedByUserId,
                amount: command.amount,
                idempotencyKey: command.idempotencyKey,
                description: command.description ?? null,
            });

            await ctx.transactions.create({
                accountId: sourceAccount.id,
                transferId: transferRecord.id,
                transactionType: 'DEBIT',
                referenceType: 'TRANSFER_OUT',
                amount: command.amount,
                balanceAfter: newSourceBalance,
                description: command.description ?? null,
            });

            await ctx.transactions.create({
                accountId: destAccount.id,
                transferId: transferRecord.id,
                transactionType: 'CREDIT',
                referenceType: 'TRANSFER_IN',
                amount: command.amount,
                balanceAfter: newDestBalance,
                description: command.description ?? null,
            });

            return transferRecord;


        });
    }
}
