import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { IAuthUser } from '../auth/auth.types';
import {
  AdminPaymentResponse,
  ClientPaymentsResponse,
  CreatePaymentInput,
  CreatePaymentResponse,
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
    summary: 'Record a payment for an invoice',
    description:
      'Stores a payment for an approved invoice, supports partial payments, and updates the parent project payment status to UNPAID, PARTIALLY_PAID, or PAID.',
  })
  @ApiBearerAuth()
  @ApiBody({ type: CreatePaymentInput })
  @ApiCreatedResponse({
    description:
      'Records the payment and returns the updated payment summary for the parent project.',
    type: CreatePaymentResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The payload is invalid, the invoice is not approved, the payment exceeds the remaining invoice balance, or the reference is invalid.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only administrators or the staff user managing the invoice project client can record a payment.',
  })
  @ApiNotFoundResponse({
    description: 'The specified invoice was not found.',
  })
  @Auth([Role.STAFF])
  @Post()
  async createPayment(
    @Body() dto: CreatePaymentInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.payments.createPayment(dto, user);
  }
}
