import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { IAuthUser } from '../auth/auth.types';
import {
  AdminPaymentResponse,
  ClientPaymentsResponse,
  ConfirmCheckoutInput,
  CreateCheckoutInput,
  CreateCheckoutResponse,
  ProjectPaymentsResponse,
} from './payment.types';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiOperation({ summary: 'List all payments' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Returns every payment recorded in the system. This endpoint is restricted to administrators.',
    type: AdminPaymentResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can view all payments.',
  })
  @Auth([Role.STAFF])
  @Get()
  async getPaymentList(@AuthUser() user: IAuthUser) {
    return this.payments.getPaymentList(user);
  }

  @ApiOperation({ summary: 'List payments for one client' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'clientId',
    format: 'uuid',
    description: 'Unique identifier for the client whose payments are needed.',
  })
  @ApiOkResponse({
    description:
      'Returns every payment recorded across the client’s projects together with the total amount paid.',
    type: ClientPaymentsResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only administrators, staff managing the client, or the client that owns the payments can view this list.',
  })
  @ApiNotFoundResponse({
    description: 'The specified client was not found.',
  })
  @Auth()
  @Get('client/:clientId')
  async getClientPayments(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.payments.getClientPayments(clientId, user);
  }

  @ApiOperation({ summary: 'List payments for one project' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'projectId',
    format: 'uuid',
    description: 'Unique identifier for the project whose payments are needed.',
  })
  @ApiOkResponse({
    description:
      'Returns the payment history and payment summary across all invoices for a single project.',
    type: ProjectPaymentsResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only administrators, staff managing the client, or the client that owns the project can view the project payments.',
  })
  @ApiNotFoundResponse({
    description: 'The specified project was not found.',
  })
  @Auth()
  @Get('project/:projectId')
  async getProjectPayments(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.payments.getProjectPayments(projectId, user);
  }

  @ApiOperation({
    summary: 'Create a Stripe Checkout session for an invoice',
    description:
      'Creates a Stripe Checkout session for an approved invoice. Returns a URL to redirect the client to for payment. Supports partial payments by specifying an amount.',
  })
  @ApiBearerAuth()
  @ApiBody({ type: CreateCheckoutInput })
  @ApiCreatedResponse({
    description:
      'Returns the Stripe Checkout URL to redirect the client to.',
    type: CreateCheckoutResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The invoice is not approved, already fully paid, or the amount exceeds the remaining balance.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only the client who owns the invoice, the staff managing the client, or an administrator can create a checkout session.',
  })
  @ApiNotFoundResponse({
    description: 'The specified invoice was not found.',
  })
  @Auth()
  @Post('checkout')
  async createCheckoutSession(
    @Body() dto: CreateCheckoutInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.payments.createCheckoutSession(dto, user);
  }

  @ApiOperation({
    summary: 'Confirm a Stripe Checkout session and record the payment',
    description:
      'Retrieves the Checkout session from Stripe. If the payment was successful and has not yet been recorded, it records the payment. This is the primary way payments are confirmed after redirect from Stripe Checkout.',
  })
  @ApiBearerAuth()
  @ApiBody({ type: ConfirmCheckoutInput })
  @ApiOkResponse({
    description: 'Returns whether the payment was confirmed and recorded.',
  })
  @Auth()
  @Post('confirm')
  async confirmCheckoutSession(
    @Body() dto: ConfirmCheckoutInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.payments.confirmCheckoutSession(dto, user);
  }

  @ApiOperation({
    summary: 'Stripe webhook handler',
    description:
      'Receives Stripe webhook events. Called by Stripe, not by clients. Verifies the webhook signature and processes checkout.session.completed events to record payments.',
  })
  @ApiOkResponse({
    description: 'Webhook event acknowledged.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid webhook signature.',
  })
  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.payments.handleWebhook(req.rawBody!, signature);
  }
}
