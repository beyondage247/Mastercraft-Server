import { ApiProperty } from '@nestjs/swagger';
import { Role, ClientCredit } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateStaffInput {
  @ApiProperty({
    example: 'Jane Staff',
    description: 'Full name of the staff member being created.',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'jane.staff@example.com',
    description: 'Email address for the staff account.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: true,
    description:
      'Indicates whether the staff member has administrative privileges.',
  })
  @IsBoolean()
  isAdmin: boolean;
}

export class CreateStaffResponse {
  @ApiProperty({
    example: 'Staff created successfully',
    description:
      'Confirmation message returned after creating the staff account.',
  })
  message: string;
}

export class StaffListItemResponse {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the staff user.',
  })
  id: string;

  @ApiProperty({
    example: 'Jane Staff',
    description: 'Full name of the staff user.',
  })
  name: string;

  @ApiProperty({
    example: 'jane.staff@example.com',
    description: 'Email address of the staff user.',
  })
  email: string;

  @ApiProperty({
    enum: Role,
    enumName: 'Role',
    example: Role.STAFF,
    description: 'Role assigned to the user.',
  })
  role: Role;

  @ApiProperty({
    example: '2026-05-21T01:35:00.000Z',
    description: 'Timestamp when the staff user was created.',
  })
  createdAt: Date;
}

export class CreateClientInput {
  @ApiProperty({
    example: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
    description: 'Unique identifier for the staff account partner.',
  })
  @IsUUID()
  staffId: string;

  @ApiProperty({
    example: 'Jane Client',
    description: 'Full name of the client being created.',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'jane.client@example.com',
    description: 'Email address for the client account.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456789',
    description: 'Phone number for the client account.',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    example: 'Jane Inc.',
    description: 'Company name for the client account.',
  })
  @IsString()
  company: string;

  @ApiProperty({
    example: 'jane.client@example.com',
    description: 'Additional contact email for the client account.',
  })
  @IsString()
  additionalContact: string;

  @ApiProperty({
    example: 'jane.client@example.com',
    description: 'Additional email for the client account.',
  })
  @IsString()
  additionalEmail: string;

  @ApiProperty({
    enum: ClientCredit,
    enumName: 'ClientCredit',
    example: ClientCredit.CREDIT_ACCOUNT,
    description: 'Client credit type for the client account.',
  })
  @IsEnum(ClientCredit)
  clientCredit: ClientCredit;
}

export class CreateClientResponse {
  @ApiProperty({
    example: 'Client created successfully',
    description:
      'Confirmation message returned after creating the client account.',
  })
  message: string;
}

export class ClientListItemResponse {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the client user.',
  })
  id: string;

  @ApiProperty({
    example: 'Jane Client',
    description: 'Full name of the client user.',
  })
  name: string;

  @ApiProperty({
    example: 'jane.client@example.com',
    description: 'Email address of the client user.',
  })
  email: string;

  @ApiProperty({
    example: '123456789',
    description: 'Phone number for the client user.',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    example: 'Jane Inc.',
    description: 'Company name for the client user.',
    nullable: true,
  })
  company: string | null;

  @ApiProperty({
    example: 'jane.contact@example.com',
    description: 'Additional contact for the client user.',
    nullable: true,
  })
  additionalContact: string | null;

  @ApiProperty({
    example: 'accounts@janeinc.com',
    description: 'Additional email for the client user.',
    nullable: true,
  })
  additionalEmail: string | null;

  @ApiProperty({
    enum: ClientCredit,
    enumName: 'ClientCredit',
    example: ClientCredit.CREDIT_ACCOUNT,
    description: 'Credit type assigned to the client user.',
    nullable: true,
  })
  clientCredit: ClientCredit | null;

  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Assigned staff account partner id.',
    nullable: true,
  })
  accountPartnerId: string | null;

  @ApiProperty({
    example: '2026-05-21T01:35:00.000Z',
    description: 'Timestamp when the client user was created.',
  })
  createdAt: Date;
}

export class ReassignClientInput {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the client to be reassigned.',
  })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    example: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
    description: 'Unique identifier for the new staff account partner.',
  })
  @IsUUID()
  staffId: string;
}

export class ReassignClientResponse {
  @ApiProperty({
    example: 'Client reassigned successfully',
    description:
      'Confirmation message returned after moving a client to another staff user.',
  })
  message: string;
}
