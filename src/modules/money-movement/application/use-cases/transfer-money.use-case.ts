import { TransferMoneyDto } from '../../presentation/http/dto/transfer-money.dto';
import { UnitOfWorkPort, MoneyMovementTransactionContext } from '../ports/unit-of-work.port';

export class TransferMoneyUseCase {
    constructor(private readonly unitOfWork: UnitOfWorkPort) {}
    async execute(dto: TransferMoneyDto): Promise<void> {
        await this.unitOfWork.execute(async (ctx: MoneyMovementTransactionContext) => {
            const sourceAccount = await ctx.accounts.lockForUpdate(dto.sourceAccountId);
            if(!sourceAccount) {
                throw new Error('Can not find account');
            }

            const balance = BigInt(sourceAccount.currentBalance);
            const amountToTransfer = BigInt(dto.amount);
            if (balance < amountToTransfer) {
                throw new Error('InsufficientFundsError');
            }
        });
    }
}
