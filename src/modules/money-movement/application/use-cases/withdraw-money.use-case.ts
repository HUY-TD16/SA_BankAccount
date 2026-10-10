import { Injectable, Inject } from '@nestjs/common';
import { Money } from '../../../../common/domain/value-objects/money.value-object';
import { 
  UnitOfWorkPort, 
  UNIT_OF_WORK, 
  TransactionEntryRecord 
} from '../ports/unit-of-work.port';

export interface WithdrawMoneyCommand {
  accountId: string;       
  userId: string;          
  amount: string;          
  description?: string;    
}

@Injectable()
export class WithdrawMoneyUseCase {
    constructor(
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(command: WithdrawMoneyCommand): Promise<TransactionEntryRecord> {
        return this.unitOfWork.execute(async (ctx) => {
            const account = await ctx.accounts.lockForUpdate(command.accountId);

            if (!account || account.userId !== command.userId) {
                throw new Error('AccountNotFoundError'); 
            }
            if (account.status === 'CLOSED') {
                throw new Error('AccountClosedError');
            }

            const currentMoney = Money.fromString(account.currentBalance);
            const withdrawMoney = Money.fromString(command.amount, { allowZero: false });

            if (!currentMoney.isGreaterThanOrEqual(withdrawMoney)) {
                throw new Error('InsufficientFundsError'); 
            }

            const newBalance = currentMoney.subtract(withdrawMoney).toDecimalString();
            await ctx.accounts.updateBalance(account.id, newBalance);
            const transactionRecord = await ctx.transactions.create({
                accountId: account.id,
                transactionType: 'DEBIT',       
                referenceType: 'CASH_WITHDRAWAL', 
                amount: command.amount,        
                balanceAfter: newBalance,     
                description: command.description ?? null, 
            });

            return transactionRecord;
        })
    }

}
