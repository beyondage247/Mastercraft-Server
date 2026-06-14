import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { IAuthUser } from 'src/modules/auth/auth.types';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { connectId } from 'src/services/prisma/prisma.utils';
import { bad } from 'src/utils/error.utils';
import { CreateReportInput } from './report.types';

const reportSelect = {
  id: true,
  startDate: true,
  endDate: true,
  coldCalls: true,
  siteVisit: true,
  coldEmails: true,
  coffeeLunch: true,
  socialMedia: true,
  newCustomers: true,
  networkingEvent: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.ReportSelect;

type ReportRecord = Prisma.ReportGetPayload<{
  select: typeof reportSelect;
}>;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReportList(user: IAuthUser) {
    const reports = await this.prisma.report.findMany({
      where: user.isAdmin
        ? undefined
        : {
            userId: user.id,
          },
      orderBy: [
        {
          startDate: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: reportSelect,
    });

    return reports.map((report) => this.serializeReport(report));
  }

  async createReport(dto: CreateReportInput, user: IAuthUser) {
    if (user.role !== Role.STAFF) {
      bad('Only staff users can create reports', 403);
    }

    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate = this.parseDate(dto.endDate, 'endDate');

    if (endDate < startDate) {
      bad('endDate must be on or after startDate');
    }

    const report = await this.prisma.report.create({
      data: {
        startDate,
        endDate,
        coldCalls: this.parseCount(dto.coldCalls, 'coldCalls'),
        siteVisit: this.parseCount(dto.siteVisit, 'siteVisit'),
        coldEmails: this.parseCount(dto.coldEmails, 'coldEmails'),
        coffeeLunch: this.parseCount(dto.coffeeLunch, 'coffeeLunch'),
        socialMedia: this.parseCount(dto.socialMedia, 'socialMedia'),
        newCustomers: this.parseCount(dto.newCustomers, 'newCustomers'),
        networkingEvent: dto.networkingEvent.trim(),
        notes: dto.notes.trim(),
        user: connectId(user.id),
      },
      select: reportSelect,
    });

    return {
      message: 'Report created successfully',
      report: this.serializeReport(report),
    };
  }

  private parseDate(value: string, fieldName: string) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match) {
      bad(`${fieldName} must be in DD/MM/YYYY format`);
    }

    const [, dayValue, monthValue, yearValue] = match;
    const day = Number(dayValue);
    const month = Number(monthValue);
    const year = Number(yearValue);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      bad(`Invalid ${fieldName} value`);
    }

    return parsed;
  }

  private parseCount(value: string, fieldName: string) {
    const parsed = Number(value.trim());
    if (!Number.isInteger(parsed) || parsed < 0) {
      bad(`${fieldName} must be a non-negative integer`);
    }
    return parsed;
  }

  private serializeReport(report: ReportRecord) {
    return {
      ...report,
      startDate: report.startDate.toISOString(),
      endDate: report.endDate.toISOString(),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }
}
