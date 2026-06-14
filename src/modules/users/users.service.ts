import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { hash } from 'argon2';
import { PrismaService } from 'src/services/prisma/prisma.service';
import {
  CreateClientInput,
  CreateStaffInput,
  ReassignClientInput,
} from './user.types';
import { generatePassword } from 'src/utils/password.utils';
import { MailService } from 'src/services/mail/mail.service';
import { bad } from 'src/utils/error.utils';
import { IAuthUser } from '../auth/auth.types';
import { connectId } from 'src/services/prisma/prisma.utils';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async getStaffList() {
    return this.prisma.user.findMany({
      where: { role: Role.STAFF },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClientList(user: IAuthUser) {
    return this.prisma.user.findMany({
      where: {
        role: Role.CLIENT,
        ...(user.isAdmin ? {} : { accountPartnerId: user.id }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        additionalContact: true,
        additionalEmail: true,
        clientCredit: true,
        accountPartnerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStaff(dto: CreateStaffInput, _user?: IAuthUser) {
    const { name, email, isAdmin } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) bad('User already exists');
    const tempPassword = generatePassword();
    const hashedPassword = await hash(tempPassword);
    await this.prisma.user.create({
      data: {
        name,
        email,
        isAdmin,
        role: Role.STAFF,
        password: hashedPassword,
      },
    });

    void this.mail
      .sendNewStaffMail({
        name,
        email,
        tempPassword,
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to send new staff email to ${email}`, error);
      });

    return {
      message: 'Staff created successfully',
    };
  }

  async createClient(dto: CreateClientInput, user: IAuthUser) {
    const { staffId, name, email, ...rest } = dto;

    if (!user.isAdmin && staffId !== user.id) {
      bad('You can only assign clients to yourself', 403);
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

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) bad('User already exists');
    const tempPassword = generatePassword();
    const hashedPassword = await hash(tempPassword);

    await this.prisma.user.create({
      data: {
        ...rest,
        name,
        email,
        role: Role.CLIENT,
        password: hashedPassword,
        accountPartner: connectId(staffId),
      },
    });

    void this.mail
      .sendNewClientMail({
        name,
        email,
        tempPassword,
        company: dto.company,
        phone: dto.phone,
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to send new client email to ${email}`, error);
      });

    return {
      message: 'Client created successfully',
    };
  }

  async reassignClient(dto: ReassignClientInput) {
    const client = await this.prisma.user.findFirst({
      where: {
        id: dto.clientId,
        role: Role.CLIENT,
      },
      select: {
        id: true,
      },
    });
    if (!client) bad('Client not found');

    const staff = await this.prisma.user.findFirst({
      where: {
        id: dto.staffId,
        role: Role.STAFF,
      },
      select: {
        id: true,
      },
    });
    if (!staff) bad('Staff user not found');

    await this.prisma.user.update({
      where: { id: dto.clientId },
      data: {
        accountPartner: connectId(dto.staffId),
      },
    });

    return {
      message: 'Client reassigned successfully',
    };
  }
}
