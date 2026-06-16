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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

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
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from '../auth/decorators/auth.decorator';
import {
  CatalogItemResponse,
  CreateCatalogItemInput,
  CreateCatalogItemResponse,
  ImportCatalogItemsBody,
  ImportCatalogItemsResponse,
  UpdateCatalogItemInput,
  UpdateCatalogItemResponse,
} from './services.types';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@Auth([Role.STAFF])
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @ApiOperation({ summary: 'List catalog items' })
  @ApiOkResponse({
    description: 'Returns all catalog items available to staff users.',
    type: CatalogItemResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can view catalog items.',
  })
  @Get()
  async getCatalogItemList() {
    return this.services.getCatalogItemList();
  }

  @ApiOperation({ summary: 'Get one catalog item' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the catalog item to retrieve.',
  })
  @ApiOkResponse({
    description: 'Returns a single catalog item.',
    type: CatalogItemResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can view catalog items.',
  })
  @ApiNotFoundResponse({
    description: 'The specified catalog item was not found.',
  })
  @Get(':id')
  async getCatalogItem(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.services.getCatalogItem(id);
  }

  @ApiOperation({ summary: 'Create one catalog item' })
  @ApiBody({ type: CreateCatalogItemInput })
  @ApiCreatedResponse({
    description: 'Creates a new catalog item.',
    type: CreateCatalogItemResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid or a unique field conflicts with an existing catalog item.',
  })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only staff users can manage catalog items.' })
  @Post()
  async createCatalogItem(@Body() dto: CreateCatalogItemInput) {
    return this.services.createCatalogItem(dto);
  }

  @ApiOperation({ summary: 'Import catalog items from an Excel workbook' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImportCatalogItemsBody })
  @ApiOkResponse({
    description:
      'Imports new catalog items from the first worksheet and returns a row-by-row summary.',
    type: ImportCatalogItemsResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The uploaded file is missing, unsupported, empty, or contains invalid row values.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can import catalog items.',
  })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @Post('import')
  async importCatalogItems(@UploadedFile() file?: { originalname: string; buffer: Buffer }) {
    return this.services.importCatalogItems(file);
  }

  @ApiOperation({ summary: 'Update one catalog item' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the catalog item to update.',
  })
  @ApiBody({ type: UpdateCatalogItemInput })
  @ApiOkResponse({
    description: 'Updates the specified catalog item.',
    type: UpdateCatalogItemResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, no update fields were provided, or a unique field conflicts with another item.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can update catalog items.',
  })
  @ApiNotFoundResponse({
    description: 'The specified catalog item was not found.',
  })
  @Patch(':id')
  async updateCatalogItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCatalogItemInput,
  ) {
    return this.services.updateCatalogItem(id, dto);
  }
}
