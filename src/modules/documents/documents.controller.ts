import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
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
import { Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { IAuthUser } from '../auth/auth.types';
import {
  CreateDocumentCategoryInput,
  CreateProjectDocumentInput,
  UpdateDocumentCategoryInput,
} from './documents.types';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @ApiOperation({ summary: 'List documents for a project grouped by category' })
  @ApiBearerAuth()
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiOkResponse({ description: 'Documents grouped by category.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Insufficient access to this project.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @Auth()
  @Get('project/:projectId')
  async getProjectDocuments(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.documents.getProjectDocuments(projectId, user);
  }

  @ApiOperation({ summary: 'Create a document category in a project' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateDocumentCategoryInput })
  @ApiCreatedResponse({ description: 'Category created.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Insufficient access to this project.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @Auth()
  @Post('categories')
  async createCategory(
    @Body() dto: CreateDocumentCategoryInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.documents.createCategory(dto, user);
  }

  @ApiOperation({ summary: 'Rename a document category' })
  @ApiBearerAuth()
  @ApiParam({ name: 'categoryId', format: 'uuid' })
  @ApiBody({ type: UpdateDocumentCategoryInput })
  @ApiOkResponse({ description: 'Category renamed.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Insufficient access to this project.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @Auth()
  @Patch('categories/:categoryId')
  async updateCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body() dto: UpdateDocumentCategoryInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.documents.updateCategory(categoryId, dto, user);
  }

  @ApiOperation({ summary: 'Delete a document category' })
  @ApiBearerAuth()
  @ApiParam({ name: 'categoryId', format: 'uuid' })
  @ApiOkResponse({ description: 'Category deleted. Documents moved to uncategorized.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Insufficient access to this project.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @Auth()
  @Delete('categories/:categoryId')
  async deleteCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.documents.deleteCategory(categoryId, user);
  }

  @ApiOperation({ summary: 'Add a document to a project' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateProjectDocumentInput })
  @ApiCreatedResponse({ description: 'Document added.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Insufficient access to this project.' })
  @ApiNotFoundResponse({ description: 'Project, upload, or category not found.' })
  @Auth()
  @Post()
  async createDocument(
    @Body() dto: CreateProjectDocumentInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.documents.createDocument(dto, user);
  }

  @ApiOperation({ summary: 'Remove a document from a project' })
  @ApiBearerAuth()
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOkResponse({ description: 'Document removed.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Insufficient access to this project.' })
  @ApiNotFoundResponse({ description: 'Document not found.' })
  @Auth()
  @Delete(':documentId')
  async deleteDocument(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.documents.deleteDocument(documentId, user);
  }
}
