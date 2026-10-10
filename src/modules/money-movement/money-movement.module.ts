import { Module } from "@nestjs/common";
import { PrismaModule } from "@src/infrastructure/prisma/prisma.module";
import { TransactionController } from "./presentation/http/transactions.controller";
import { DepositMoneyUseCase } from "./application/use-cases/deposit-money.use-case";
import { UNIT_OF_WORK } from "./application/ports/unit-of-work.port";
import { PrismaUnitOfWork } from "./infrastructure/persistence/prisma-unit-of-work";

@Module({
  imports: [
    PrismaModule 
  ],
  controllers: [
    TransactionController 
  ],
  providers: [
    DepositMoneyUseCase,  
    {
      provide: UNIT_OF_WORK,      
      useClass: PrismaUnitOfWork,  
    },
  ],
  exports: [],
})
export class MoneyMovementModule {}