import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
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
import { UsersService } from './users.service';
import {
  ClientListItemResponse,
  CreateClientInput,
  CreateClientResponse,
  CreateStaffInput,
  CreateStaffResponse,
  DeactivateStaffResponse,
  ReactivateStaffResponse,
  ReassignClientInput,
  ReassignClientResponse,
  StaffListItemResponse,
} from './user.types';
import { Admin, Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { IAuthUser } from '../auth/auth.types';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOperation({ summary: 'Get staff and admin users' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Returns the list of users with STAFF or ADMIN roles.',
    type: StaffListItemResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can view the staff list.',
  })
  @Admin()
  @Get('staff')
  async getStaffList() {
    return this.users.getStaffList();
  }

  @ApiOperation({ summary: 'Get clients' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Returns the clients assigned to the authenticated staff user. Administrators can view all clients.',
    type: ClientListItemResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can view clients.',
  })
  @Auth([Role.STAFF])
  @Get('clients')
  async getClientList(@AuthUser() user: IAuthUser) {
    return this.users.getClientList(user);
  }

  @ApiOperation({ summary: 'Create a client account' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateClientInput })
  @ApiCreatedResponse({
    description:
      'Creates a new client account, assigns it to the provided staff user, and sends the onboarding email.',
    type: CreateClientResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, the user already exists, or the staff user was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only staff users can create client accounts, and non-admin staff can only assign clients to themselves.',
  })
  @Auth([Role.STAFF])
  @Post('clients')
  async createClient(
    @Body() dto: CreateClientInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.users.createClient(dto, user);
  }

  @ApiOperation({ summary: 'Reassign a client to another staff user' })
  @ApiBearerAuth()
  @ApiBody({ type: ReassignClientInput })
  @ApiOkResponse({
    description:
      'Moves a client from their current staff account partner to another staff user.',
    type: ReassignClientResponse,
  })
  @ApiBadRequestResponse({
    description: 'The request body is invalid or the client/staff was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can reassign clients.',
  })
  @Admin()
  @Patch('clients/reassign')
  async reassignClient(@Body() dto: ReassignClientInput) {
    return this.users.reassignClient(dto);
  }

  @ApiOperation({ summary: 'Create a staff account' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateStaffInput })
  @ApiCreatedResponse({
    description:
      'Creates a new staff account, generates a temporary password, and sends the onboarding email.',
    type: CreateStaffResponse,
  })
  @ApiBadRequestResponse({ description: 'The request body is invalid.' })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can create staff accounts.',
  })
  @Auth([Role.STAFF])
  @Post('staff')
  async createStaff(
    @Body() dto: CreateStaffInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.users.createStaff(dto, user);
  }

  @ApiOperation({ summary: 'Deactivate a staff account' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the staff user to deactivate.',
  })
  @ApiOkResponse({
    description:
      'Deactivates the staff account. The user will no longer be able to log in or access any endpoints.',
    type: DeactivateStaffResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The staff user is already deactivated or you are trying to deactivate your own account.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can deactivate staff accounts.',
  })
  @ApiNotFoundResponse({
    description: 'The specified staff user was not found.',
  })
  @Admin()
  @Patch('staff/:id/deactivate')
  async deactivateStaff(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.users.deactivateStaff(id, user);
  }

  @ApiOperation({ summary: 'Reactivate a staff account' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the staff user to reactivate.',
  })
  @ApiOkResponse({
    description:
      'Reactivates the staff account. The user will be able to log in again.',
    type: ReactivateStaffResponse,
  })
  @ApiBadRequestResponse({
    description: 'The staff user is already active.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can reactivate staff accounts.',
  })
  @ApiNotFoundResponse({
    description: 'The specified staff user was not found.',
  })
  @Admin()
  @Patch('staff/:id/reactivate')
  async reactivateStaff(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.users.reactivateStaff(id);
  }
}
