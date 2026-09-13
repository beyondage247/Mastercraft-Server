import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCategoryInput {
  @ApiProperty({
    example: 'Residential',
    description: 'Name of the category. Must be unique.',
  })
  @IsString()
  @MinLength(1)
  name: string;
}

export class CategoryResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the category.',
  })
  id: string;

  @ApiProperty({
    example: 'Residential',
    description: 'Category name.',
  })
  name: string;

  @ApiProperty({
    example: '2026-05-21T01:35:00.000Z',
    description: 'Timestamp when the category was created.',
  })
  createdAt: Date;
}

export class CreateCategoryResponse {
  @ApiProperty({
    example: 'Category created successfully',
    description: 'Confirmation message after creating a category.',
  })
  message: string;

  @ApiProperty({ type: () => CategoryResponse })
  category: CategoryResponse;
}

export class DeleteCategoryResponse {
  @ApiProperty({
    example: 'Category deleted successfully',
    description: 'Confirmation message after deleting a category.',
  })
  message: string;
}
