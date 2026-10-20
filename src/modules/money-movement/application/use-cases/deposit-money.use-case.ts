import { Money } from '../../../../common/domain/value-objects/money.value-object';
import { 
  UnitOfWorkPort, 
  TransactionEntryRecord 
} from '../ports/unit-of-work.port';
import { 
  AccountNotFoundError, 
  AccountClosedError 
} from '../../domain/errors';

export interface DepositMoneyCommand {
  accountId: string;       
  userId: string;          
  amount: string;          
  description?: string;    
}

export class DepositMoneyUseCase {
    constructor(
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(command: DepositMoneyCommand): Promise<TransactionEntryRecord> {
        return this.unitOfWork.execute(async (ctx) => {
            const account = await ctx.accounts.lockForUpdate(command.accountId);
            if (!account || account.userId !== command.userId) {
                throw new AccountNotFoundError(); 
            }
            if (account.status === 'CLOSED') {
                throw new AccountClosedError();
            }

            const currentMoney = Money.fromString(account.currentBalance);
            const depositMoney = Money.fromString(command.amount, { allowZero: false });
            const newBalance = currentMoney.add(depositMoney).toDecimalString();

            await ctx.accounts.updateBalance(account.id, newBalance);
            const transactionRecord = await ctx.transactions.create({
                accountId: account.id,
                transactionType: 'CREDIT',     
                referenceType: 'CASH_DEPOSIT', 
                amount: command.amount,        
                balanceAfter: newBalance,     
                description: command.description ?? null, 
            });

            return transactionRecord;
        })
    }
}
