import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { IAuthUser } from '../auth/auth.types';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryItemInput,
  CreateInventoryItemResponse,
  ImportInventoryBody,
  ImportInventoryResponse,
  InventoryItemResponse,
  InventoryListQuery,
  InventorySummaryResponse,
  UpdateInventoryItemInput,
  UpdateInventoryItemResponse,
} from './inventory.types';

@ApiTags('inventory')
@ApiBearerAuth()
@Auth([Role.STAFF])
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @ApiOperation({
    summary: 'Get inventory summary',
    description:
      'Returns high-level inventory totals including low-stock and out-of-stock counts for staff users.',
  })
  @ApiOkResponse({
    description: 'Returns the inventory summary.',
    type: InventorySummaryResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can manage inventory.',
  })
  @Get('summary')
  async getInventorySummary(@AuthUser() user: IAuthUser) {
    return this.inventory.getInventorySummary(user);
  }

  @ApiOperation({
    summary: 'List inventory items',
    description:
      'Returns inventory items with optional search and status filters for staff users.',
  })
  @ApiOkResponse({
    description: 'Returns inventory items.',
    type: InventoryItemResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can manage inventory.',
  })
  @Get()
  async getInventoryList(
    @Query() query: InventoryListQuery,
    @AuthUser() user: IAuthUser,
  ) {
    return this.inventory.getInventoryList(query, user);
  }

  @ApiOperation({ summary: 'Get one inventory item' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the inventory item to retrieve.',
  })
  @ApiOkResponse({
    description: 'Returns one inventory item.',
    type: InventoryItemResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can manage inventory.',
  })
  @ApiNotFoundResponse({
    description: 'The specified inventory item was not found.',
  })
  @Get(':id')
  async getInventoryItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.inventory.getInventoryItem(id, user);
  }

  @ApiOperation({ summary: 'Create one inventory item' })
  @ApiBody({ type: CreateInventoryItemInput })
  @ApiCreatedResponse({
    description: 'Creates a new inventory item.',
    type: CreateInventoryItemResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid or a unique field conflicts with an existing inventory item.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can manage inventory.',
  })
  @Post()
  async createInventoryItem(
    @Body() dto: CreateInventoryItemInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.inventory.createInventoryItem(dto, user);
  }

  @ApiOperation({ summary: 'Import inventory items from an Excel workbook' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImportInventoryBody })
  @ApiOkResponse({
    description:
      'Imports inventory rows from the first worksheet and returns a row-by-row summary of created, updated, skipped, and invalid rows.',
    type: ImportInventoryResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The uploaded file is missing, unsupported, empty, or contains invalid row values.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can manage inventory.',
  })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @Post('import')
  async importInventoryItems(
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
    @AuthUser() user: IAuthUser,
  ) {
    return this.inventory.importInventoryItems(file, user);
  }

  @ApiOperation({ summary: 'Update one inventory item' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the inventory item to update.',
  })
  @ApiBody({ type: UpdateInventoryItemInput })
  @ApiOkResponse({
    description: 'Updates the specified inventory item.',
    type: UpdateInventoryItemResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, no update fields were provided, or a unique field conflicts with another inventory item.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can manage inventory.',
  })
  @ApiNotFoundResponse({
    description: 'The specified inventory item was not found.',
  })
  @Patch(':id')
  async updateInventoryItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInventoryItemInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.inventory.updateInventoryItem(id, dto, user);
  }
}
