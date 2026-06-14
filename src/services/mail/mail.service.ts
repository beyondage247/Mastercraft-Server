import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { company } from '../company.constants';
import {
  InvoiceCreatedMailInput,
  NewClientMailInput,
  NewStaffMailInput,
  PasswordResetOtpMailInput,
  ProjectAttachmentMailInput,
  ProjectCommentMailInput,
  ProjectCreatedMailInput,
  ProjectUpdatedMailInput,
  QuoteCreatedMailInput,
} from './mail.types';

@Injectable()
export class MailService {
  constructor(private readonly mailer: MailerService) {}

  private withBranding<T extends object>(context: T) {
    return {
      ...context,
      companyPhone: company.phone,
      portalUrl: company.portalUrl,
    };
  }

  async sendNewStaffMail(dto: NewStaffMailInput) {
    await this.mailer.sendMail({
      to: dto.email,
      subject: 'MasterCraft Staff account has been created',
      template: 'new-staff',
      context: this.withBranding(dto),
    });
  }

  async sendNewClientMail(dto: NewClientMailInput) {
    await this.mailer.sendMail({
      to: dto.email,
      subject: 'MasterCraft Client account has been created',
      template: 'new-client',
      context: this.withBranding(dto),
    });
  }

  async sendProjectCommentMail(dto: ProjectCommentMailInput) {
    await this.mailer.sendMail({
      to: dto.recipientEmail,
      subject: 'MasterCraft Project comment has been added',
      template: 'project-comment',
      context: this.withBranding(dto),
    });
  }

  async sendProjectAttachmentMail(dto: ProjectAttachmentMailInput) {
    await this.mailer.sendMail({
      to: dto.recipientEmail,
      subject: 'MasterCraft Project documents have been updated',
      template: 'project-attachment',
      context: this.withBranding(dto),
    });
  }

  async sendProjectCreatedMail(dto: ProjectCreatedMailInput) {
    await this.mailer.sendMail({
      to: dto.recipientEmail,
      subject: 'MasterCraft Project has been created',
      template: 'project-created',
      context: this.withBranding(dto),
    });
  }

  async sendProjectUpdatedMail(dto: ProjectUpdatedMailInput) {
    await this.mailer.sendMail({
      to: dto.recipientEmail,
      subject: 'MasterCraft Project has been updated',
      template: 'project-updated',
      context: this.withBranding(dto),
    });
  }

  async sendQuoteCreatedMail(dto: QuoteCreatedMailInput) {
    await this.mailer.sendMail({
      to: dto.recipientEmail,
      subject: 'MasterCraft Quote has been created',
      template: 'quote-created',
      context: this.withBranding(dto),
    });
  }

  async sendInvoiceCreatedMail(dto: InvoiceCreatedMailInput) {
    await this.mailer.sendMail({
      to: dto.recipientEmail,
      subject: 'MasterCraft Invoice has been created',
      template: 'invoice-created',
      context: this.withBranding(dto),
    });
  }

  async sendPasswordResetOtpMail(dto: PasswordResetOtpMailInput) {
    await this.mailer.sendMail({
      to: dto.email,
      subject: 'MasterCraft Password reset OTP',
      template: 'password-reset-otp',
      context: this.withBranding(dto),
    });
  }
}
