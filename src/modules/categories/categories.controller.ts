import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
import { Auth } from '../auth/decorators/auth.decorator';
import { CategoriesService } from './categories.service';
import {
  CategoryResponse,
  CreateCategoryInput,
  CreateCategoryResponse,
  DeleteCategoryResponse,
} from './category.types';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @ApiOperation({ summary: 'List all categories' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Returns all quote/invoice categories ordered alphabetically.',
    type: CategoryResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only staff users can view categories.' })
  @Auth([Role.STAFF])
  @Get()
  async getCategoryList() {
    return this.categories.getCategoryList();
  }

  @ApiOperation({ summary: 'Create a category' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateCategoryInput })
  @ApiCreatedResponse({
    description: 'Creates a new quote/invoice category.',
    type: CreateCategoryResponse,
  })
  @ApiBadRequestResponse({ description: 'A category with this name already exists.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only staff users can create categories.' })
  @Auth([Role.STAFF])
  @Post()
  async createCategory(@Body() dto: CreateCategoryInput) {
    return this.categories.createCategory(dto);
  }

  @ApiOperation({ summary: 'Delete a category' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the category to delete.',
  })
  @ApiOkResponse({
    description:
      'Permanently deletes the category. Quotes and invoices using this category will have their categoryId set to null.',
    type: DeleteCategoryResponse,
  })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only staff users can delete categories.' })
  @ApiNotFoundResponse({ description: 'The specified category was not found.' })
  @Auth([Role.STAFF])
  @Delete(':id')
  async deleteCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.deleteCategory(id);
  }
}
