import { Module } from '@nestjs/common';
import { PdfModule } from 'src/services/pdf/pdf.module';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [PdfModule],
  controllers: [QuotesController],
  providers: [QuotesService, PrismaService],
})
export class QuotesModule {}
