import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { IAuthUser } from '../auth/auth.types';
import { QuotesService } from './quotes.service';
import {
  CreateQuoteInput,
  CreateQuoteResponse,
  QuoteResponse,
  RespondToQuoteInput,
  RespondToQuoteResponse,
  UpdateQuoteInput,
  UpdateQuoteResponse,
} from './quotes.types';

@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @ApiOperation({ summary: 'List quotes' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Returns quotes visible to the authenticated user. Staff see quotes for managed clients; clients see quotes for their own projects.',
    type: QuoteResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only authenticated users can view quotes.',
  })
  @Auth()
  @Get()
  async getQuoteList(@AuthUser() user: IAuthUser) {
    return this.quotes.getQuoteList(user);
  }

  @ApiOperation({ summary: 'Get one quote' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the quote to retrieve.',
  })
  @ApiOkResponse({
    description: 'Returns a single quote visible to the authenticated user.',
    type: QuoteResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to view this quote.',
  })
  @ApiNotFoundResponse({
    description: 'The specified quote was not found.',
  })
  @Auth()
  @Get(':id')
  async getQuote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.quotes.getQuote(id, user);
  }

  @ApiOperation({ summary: 'Download a quote as a PDF' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the quote to download.',
  })
  @ApiOkResponse({
    description: 'Returns a PDF document for the quote as a file download.',
    content: { 'application/pdf': {} },
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to view this quote.',
  })
  @ApiNotFoundResponse({
    description: 'The specified quote was not found.',
  })
  @Auth()
  @Get(':id/download')
  async downloadQuote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthUser() user: IAuthUser,
  ) {
    const { filename, buffer } = await this.quotes.downloadQuote(id, user);

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @ApiOperation({ summary: 'Download a quote as a PDF using a signed email link' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the quote to download.',
  })
  @ApiQuery({
    name: 'token',
    description: 'Signed token issued in the quote notification email.',
  })
  @ApiOkResponse({
    description:
      'Returns a PDF document for the quote when the signed download token is valid.',
    content: { 'application/pdf': {} },
  })
  @ApiNotFoundResponse({
    description: 'The specified quote was not found.',
  })
  @Get(':id/public-download')
  async downloadQuotePublic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('token') token: string,
  ) {
    const { filename, buffer } = await this.quotes.downloadQuotePublic(
      id,
      token,
    );

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @ApiOperation({ summary: 'Download an invoice as a PDF' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the invoice to download.',
  })
  @ApiOkResponse({
    description: 'Returns a PDF document for the invoice as a file download.',
    content: { 'application/pdf': {} },
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'You do not have permission to view this invoice.',
  })
  @ApiNotFoundResponse({
    description: 'The specified invoice was not found.',
  })
  @Auth()
  @Get('invoices/:id/download')
  async downloadInvoice(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthUser() user: IAuthUser,
  ) {
    const { filename, buffer } = await this.quotes.downloadInvoice(id, user);

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @ApiOperation({
    summary: 'Download an invoice as a PDF using a signed email link',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the invoice to download.',
  })
  @ApiQuery({
    name: 'token',
    description: 'Signed token issued in the invoice notification email.',
  })
  @ApiOkResponse({
    description:
      'Returns a PDF document for the invoice when the signed download token is valid.',
    content: { 'application/pdf': {} },
  })
  @ApiNotFoundResponse({
    description: 'The specified invoice was not found.',
  })
  @Get('invoices/:id/public-download')
  async downloadInvoicePublic(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('token') token: string,
  ) {
    const { filename, buffer } = await this.quotes.downloadInvoicePublic(
      id,
      token,
    );

    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @ApiOperation({ summary: 'Create a quote for a project' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateQuoteInput })
  @ApiCreatedResponse({
    description:
      'Creates a quote, snapshots the selected service names, unit prices, and requested quantities into line items, creates the initial commission record, and moves the related project to QUOTED. Projects can hold multiple quotes.',
    type: CreateQuoteResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, the quote id already exists, the project is not eligible, or one of the selected services is invalid.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only staff users can create quotes, and non-admin staff can only quote projects for their managed clients.',
  })
  @ApiNotFoundResponse({
    description: 'The specified project was not found.',
  })
  @Auth([Role.STAFF])
  @Post()
  async createQuote(
    @Body() dto: CreateQuoteInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.quotes.createQuote(dto, user);
  }

  @ApiOperation({ summary: 'Update a quote' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the quote to update.',
  })
  @ApiBody({ type: UpdateQuoteInput })
  @ApiOkResponse({
    description:
      'Updates the quote fields and refreshes the stored service snapshots and quantities when line items are replaced. Rejected or in-review quotes are reset to PENDING when staff edits them.',
    type: UpdateQuoteResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, no update fields were provided, the quote is already approved, or a selected service is invalid.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only staff users can update quotes, and non-admin staff can only update quotes for their managed clients.',
  })
  @ApiNotFoundResponse({
    description: 'The specified quote was not found.',
  })
  @Auth([Role.STAFF])
  @Patch(':id')
  async updateQuote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateQuoteInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.quotes.updateQuote(id, dto, user);
  }

  @ApiOperation({ summary: 'Respond to a quote as the client' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the quote being reviewed.',
  })
  @ApiBody({ type: RespondToQuoteInput })
  @ApiOkResponse({
    description:
      'Records the client decision and updates the related project status according to the quote workflow. Approving a quote creates an invoice attached to that quote and moves its commission to APPROVED_COMMISSION.',
    type: RespondToQuoteResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, the selected quote decision is not allowed, or the required comment was missing.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only clients can respond to their own quotes.',
  })
  @ApiNotFoundResponse({
    description: 'The specified quote was not found.',
  })
  @Auth([Role.CLIENT])
  @Patch(':id/respond')
  async respondToQuote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RespondToQuoteInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.quotes.respondToQuote(id, dto, user);
  }
}
