import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDocumentCategoryInput {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Project to create the category in.',
  })
  @IsUUID()
  projectId: string;

  @ApiProperty({
    example: 'Shop Drawings',
    description: 'Display name for the category.',
  })
  @IsString()
  name: string;
}

export class UpdateDocumentCategoryInput {
  @ApiProperty({
    example: 'CAD Files',
    description: 'New display name for the category.',
  })
  @IsString()
  name: string;
}

export class CreateProjectDocumentInput {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Project to add the document to.',
  })
  @IsUUID()
  projectId: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Upload ID of the file to link.',
  })
  @IsUUID()
  uploadId: string;

  @ApiPropertyOptional({
    example: 'f0e1d2c3-b4a5-6789-0abc-def123456789',
    description:
      'Category to place the document in. Omit to upload directly to the project root.',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
