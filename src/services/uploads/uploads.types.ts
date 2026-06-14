import { ApiProperty } from '@nestjs/swagger';

export class UploadFileBody {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Binary file payload to upload.',
  })
  file: string;
}

export class UploadResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier of the stored upload.',
  })
  uploadId: string;
}

export class DeleteUploadsInput {
  @ApiProperty({
    type: [String],
    example: [
      '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
      '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    ],
    description: 'Identifiers of the uploads to delete.',
  })
  ids: string[];
}

export class DeleteUploadsResponse {
  @ApiProperty({
    example: 2,
    description: 'Number of uploads deleted.',
  })
  count: number;
}
