import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, IsString, Matches } from 'class-validator';

const dateFormatDescription =
  'Date string in DD/MM/YYYY format, for example 25/05/2026.';

export class CreateReportInput {
  @ApiProperty({
    example: '25/05/2026',
    description: `Start date for the report period. ${dateFormatDescription}`,
  })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'startDate must be in DD/MM/YYYY format',
  })
  startDate: string;

  @ApiProperty({
    example: '31/05/2026',
    description: `End date for the report period. ${dateFormatDescription}`,
  })
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'endDate must be in DD/MM/YYYY format',
  })
  endDate: string;

  @ApiProperty({
    example: '5',
    description: 'Number of cold calls made during the period.',
  })
  @IsNumberString()
  coldCalls: string;

  @ApiProperty({
    example: '5',
    description: 'Number of site visits made during the period.',
  })
  @IsNumberString()
  siteVisit: string;

  @ApiProperty({
    example: '15',
    description: 'Number of cold emails sent during the period.',
  })
  @IsNumberString()
  coldEmails: string;

  @ApiProperty({
    example: '4',
    description: 'Number of coffee or lunch meetings during the period.',
  })
  @IsNumberString()
  coffeeLunch: string;

  @ApiProperty({
    example: '2',
    description: 'Number of social media outreach activities during the period.',
  })
  @IsNumberString()
  socialMedia: string;

  @ApiProperty({
    example: '2',
    description: 'Number of new customers acquired during the period.',
  })
  @IsNumberString()
  newCustomers: string;

  @ApiProperty({
    example: 'Sample text',
    description: 'Summary of networking events attended during the period.',
  })
  @IsString()
  networkingEvent: string;

  @ApiProperty({
    example: 'This is a sample note',
    description: 'Additional notes for the report.',
  })
  @IsString()
  notes: string;
}

export class ReportUserResponse {
  @ApiProperty({
    example: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
    description: 'Unique identifier for the staff user who submitted the report.',
  })
  id: string;

  @ApiProperty({
    example: 'John Manager',
    description: 'Full name of the staff user who submitted the report.',
  })
  name: string;

  @ApiProperty({
    example: 'john.manager@example.com',
    description: 'Email address of the staff user who submitted the report.',
  })
  email: string;
}

export class ReportResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the report.',
  })
  id: string;

  @ApiProperty({
    example: '2026-05-25T00:00:00.000Z',
    description: 'Start date stored for the report period.',
  })
  startDate: string;

  @ApiProperty({
    example: '2026-05-31T00:00:00.000Z',
    description: 'End date stored for the report period.',
  })
  endDate: string;

  @ApiProperty({
    example: 5,
    description: 'Number of cold calls made during the period.',
  })
  coldCalls: number;

  @ApiProperty({
    example: 5,
    description: 'Number of site visits made during the period.',
  })
  siteVisit: number;

  @ApiProperty({
    example: 15,
    description: 'Number of cold emails sent during the period.',
  })
  coldEmails: number;

  @ApiProperty({
    example: 4,
    description: 'Number of coffee or lunch meetings during the period.',
  })
  coffeeLunch: number;

  @ApiProperty({
    example: 2,
    description: 'Number of social media outreach activities during the period.',
  })
  socialMedia: number;

  @ApiProperty({
    example: 2,
    description: 'Number of new customers acquired during the period.',
  })
  newCustomers: number;

  @ApiProperty({
    example: 'Sample text',
    description: 'Summary of networking events attended during the period.',
  })
  networkingEvent: string;

  @ApiProperty({
    example: 'This is a sample note',
    description: 'Additional notes for the report.',
  })
  notes: string;

  @ApiProperty({
    example: '2026-05-31T14:30:00.000Z',
    description: 'Timestamp when the report was created.',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-05-31T14:30:00.000Z',
    description: 'Timestamp when the report was last updated.',
  })
  updatedAt: string;

  @ApiProperty({
    type: () => ReportUserResponse,
    description: 'Staff user who submitted the report.',
  })
  user: ReportUserResponse;
}

export class CreateReportResponse {
  @ApiProperty({
    example: 'Report created successfully',
    description: 'Confirmation message returned after creating a report.',
  })
  message: string;

  @ApiProperty({
    type: () => ReportResponse,
    description: 'The newly created report.',
  })
  report: ReportResponse;
}
