import { Injectable } from '@nestjs/common';
import { CommissionStatus, Prisma, Role } from '@prisma/client';
import { IAuthUser } from 'src/modules/auth/auth.types';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import { UpdateCommissionInput } from './commissions.types';

const hundred = new Prisma.Decimal(100);

const commissionSelect = {
  id: true,
  total: true,
  percentageCommission: true,
  amount: true,
  commissionAmountPaid: true,
  status: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  staff: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
    },
  },
  quote: {
    select: {
      id: true,
      quoteId: true,
      name: true,
      total: true,
      taxAmount: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      invoices: {
        orderBy: { createdAt: 'asc' as const },
        take: 1,
        select: {
          id: true,
          payments: {
            select: {
              amount: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CommissionSelect;

type CommissionRecord = Prisma.CommissionGetPayload<{
  select: typeof commissionSelect;
}>;

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCommissionList(user: IAuthUser) {
    this.ensureAdmin(user);

    const commissions = await this.prisma.commission.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: commissionSelect,
    });

    return commissions.map((commission) =>
      this.serializeCommission(commission),
    );
  }

  async getMyCommissionList(user: IAuthUser) {
    if (user.role !== Role.STAFF) {
      bad('Only staff users can view commissions', 403);
    }

    return this.getStaffCommissionList(user.id, user);
  }

  async getStaffCommissionList(staffId: string, user: IAuthUser) {
    if (user.role !== Role.STAFF) {
      bad('Only staff users can view commissions', 403);
    }

    if (!user.isAdmin && user.id !== staffId) {
      bad('You can only view your own commissions', 403);
    }

    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        role: Role.STAFF,
      },
      select: {
        id: true,
      },
    });

    if (!staff) bad('Staff user not found', 404);

    const commissions = await this.prisma.commission.findMany({
      where: {
        staffId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: commissionSelect,
    });

    return commissions.map((commission) =>
      this.serializeCommission(commission),
    );
  }

  async updateCommission(
    id: string,
    dto: UpdateCommissionInput,
    user: IAuthUser,
  ) {
    this.ensureAdmin(user);

    const existingCommission = await this.prisma.commission.findUnique({
      where: { id },
      select: {
        id: true,
        total: true,
        amount: true,
        commissionAmountPaid: true,
        status: true,
      },
    });

    if (!existingCommission) bad('Commission not found', 404);

    const data: Prisma.CommissionUpdateInput = {};

    if (dto.percentageCommission !== undefined) {
      const percentageCommission = this.toPercentageDecimal(
        dto.percentageCommission,
        'percentageCommission',
      );

      data.percentageCommission = percentageCommission;
      data.amount = this.calculateCommissionAmount(
        existingCommission.total,
        percentageCommission,
      );
    }

    if (dto.commissionAmountPaid !== undefined) {
      const paid = new Prisma.Decimal(dto.commissionAmountPaid);
      const currentAmount =
        data.amount instanceof Prisma.Decimal
          ? data.amount
          : existingCommission.amount;

      if (paid.greaterThan(currentAmount)) {
        bad('commissionAmountPaid cannot exceed commission amount');
      }

      data.commissionAmountPaid = paid;
    }

    if (dto.status !== undefined) {
      if (dto.status !== CommissionStatus.PAID) {
        bad('Only PAID can be set manually');
      }

      if (existingCommission.status === CommissionStatus.QUOTED_COMMISSION) {
        bad('Only invoiced or partially paid commissions can be marked as paid');
      }

      if (existingCommission.status === CommissionStatus.PAID) {
        bad('Commission is already paid');
      }

      data.status = CommissionStatus.PAID;
      data.paidAt = new Date();
    }

    if (!Object.keys(data).length) {
      bad('At least one update field is required');
    }

    const commission = await this.prisma.commission.update({
      where: { id },
      data,
      select: commissionSelect,
    });

    return {
      message: 'Commission updated successfully',
      commission: this.serializeCommission(commission),
    };
  }

  private ensureAdmin(user: IAuthUser) {
    if (!user.isAdmin) {
      bad('Only administrators can manage commissions', 403);
    }
  }

  private toPercentageDecimal(value: number, fieldName: string) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      bad(`${fieldName} must be between 0 and 100`);
    }

    return new Prisma.Decimal(value);
  }

  private calculateCommissionAmount(
    total: Prisma.Decimal,
    percentageCommission: Prisma.Decimal,
  ) {
    return total.mul(percentageCommission).div(hundred);
  }

  private serializeCommission(commission: CommissionRecord) {
    const invoice = commission.quote.invoices[0] ?? null;
    const amountPaid = invoice
      ? invoice.payments.reduce(
          (sum, p) => sum.add(p.amount),
          new Prisma.Decimal(0),
        )
      : new Prisma.Decimal(0);
    const commissionAmountBalance = commission.amount.sub(
      commission.commissionAmountPaid,
    );

    return {
      id: commission.id,
      total: commission.total.toString(),
      percentageCommission: commission.percentageCommission.toString(),
      amount: commission.amount.toString(),
      invoiceId: invoice?.id ?? null,
      amountPaid: amountPaid.toString(),
      commissionAmountPaid: commission.commissionAmountPaid.toString(),
      commissionAmountBalance: commissionAmountBalance.toString(),
      status: commission.status,
      paidAt: commission.paidAt?.toISOString() ?? null,
      createdAt: commission.createdAt.toISOString(),
      updatedAt: commission.updatedAt.toISOString(),
      staff: commission.staff,
      client: commission.client,
      quote: {
        id: commission.quote.id,
        quoteId: commission.quote.quoteId,
        name: commission.quote.name,
        total: commission.quote.total.toString(),
        taxAmount: commission.quote.taxAmount.toString(),
        project: commission.quote.project,
      },
    };
  }
}
