import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './services/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MailModule } from './services/mail/mail.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ServicesModule } from './modules/services/services.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UploadsModule } from './services/uploads/uploads.module';
import { ReportsModule } from './modules/reports/reports.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CommissionsModule } from './modules/commissions/commissions.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    MailModule,
    ProjectsModule,
    ServicesModule,
    QuotesModule,
    PaymentsModule,
    UploadsModule,
    ReportsModule,
    InventoryModule,
    CommissionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
