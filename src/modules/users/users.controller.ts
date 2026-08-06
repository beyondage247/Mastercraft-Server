import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  ArchiveClientResponse,
  ClientListItemResponse,
  ClientListQuery,
  CreateClientInput,
  CreateClientResponse,
  CreateStaffInput,
  CreateStaffResponse,
  DeactivateStaffResponse,
  DeleteClientResponse,
  DeleteStaffResponse,
  ReactivateStaffResponse,
  ReassignClientInput,
  ReassignClientResponse,
  ResendClientInvitationResponse,
  RestoreClientResponse,
  StaffListItemResponse,
  UpdateClientInput,
  UpdateClientResponse,
  UpdateStaffInput,
  UpdateStaffResponse,
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
  @ApiQuery({
    name: 'archived',
    required: false,
    type: Boolean,
    description: 'Pass true to return only archived clients. Omit or pass false for active clients.',
  })
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
  async getClientList(@AuthUser() user: IAuthUser, @Query() query: ClientListQuery) {
    return this.users.getClientList(user, query);
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

  @ApiOperation({ summary: 'Update a client account' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', format: 'uuid', description: 'Unique identifier for the client to update.' })
  @ApiBody({ type: UpdateClientInput })
  @ApiOkResponse({ description: 'Client updated successfully.', type: UpdateClientResponse })
  @ApiBadRequestResponse({ description: 'Invalid request body or email already in use.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Non-admin staff can only edit their own clients.' })
  @ApiNotFoundResponse({ description: 'Client not found.' })
  @Auth([Role.STAFF])
  @Patch('clients/:id')
  async updateClient(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClientInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.users.updateClient(id, dto, user);
  }

  @ApiOperation({ summary: 'Archive a client account' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the client to archive.',
  })
  @ApiOkResponse({
    description:
      'Marks the client as archived. Archived clients are excluded from standard list views and cannot log in. Their data and projects are preserved.',
    type: ArchiveClientResponse,
  })
  @ApiBadRequestResponse({ description: 'The client is already archived.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only administrators can archive clients.' })
  @ApiNotFoundResponse({ description: 'The specified client was not found.' })
  @Admin()
  @Patch('clients/:id/archive')
  async archiveClient(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.archiveClient(id);
  }

  @ApiOperation({ summary: 'Restore an archived client account' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the client to restore.',
  })
  @ApiOkResponse({
    description:
      'Removes the archived flag from the client so they appear in standard list views and can log in again.',
    type: RestoreClientResponse,
  })
  @ApiBadRequestResponse({ description: 'The client is not archived.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only administrators can restore clients.' })
  @ApiNotFoundResponse({ description: 'The specified client was not found.' })
  @Admin()
  @Patch('clients/:id/restore')
  async restoreClient(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.restoreClient(id);
  }

  @ApiOperation({ summary: 'Delete a client account' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the client to delete.',
  })
  @ApiOkResponse({
    description:
      'Permanently deletes the client account and all associated data including projects, quotes, invoices, payments, commissions, documents, and uploads.',
    type: DeleteClientResponse,
  })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only administrators can delete clients.' })
  @ApiNotFoundResponse({ description: 'The specified client was not found.' })
  @Admin()
  @Delete('clients/:id')
  async deleteClient(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.deleteClient(id);
  }

  @ApiOperation({ summary: 'Resend onboarding invitation to a client' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the client to resend the invitation to.',
  })
  @ApiOkResponse({
    description:
      'Generates a new temporary password for the client and resends the onboarding email with the new credentials.',
    type: ResendClientInvitationResponse,
  })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only staff users can resend client invitations. Non-admin staff can only resend to their own clients.' })
  @ApiNotFoundResponse({ description: 'The specified client was not found.' })
  @Auth([Role.STAFF])
  @Post('clients/:id/resend-invitation')
  async resendClientInvitation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.users.resendClientInvitation(id, user);
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

  @ApiOperation({ summary: 'Update a staff account' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', format: 'uuid', description: 'Unique identifier for the staff user to update.' })
  @ApiBody({ type: UpdateStaffInput })
  @ApiOkResponse({ description: 'Staff updated successfully.', type: UpdateStaffResponse })
  @ApiBadRequestResponse({ description: 'Invalid request body or email already in use.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiForbiddenResponse({ description: 'Only administrators can edit staff accounts.' })
  @ApiNotFoundResponse({ description: 'Staff user not found.' })
  @Admin()
  @Patch('staff/:id')
  async updateStaff(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStaffInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.users.updateStaff(id, dto, user);
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

  @ApiOperation({ summary: 'Delete a staff account' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the staff user to delete.',
  })
  @ApiOkResponse({
    description:
      'Permanently deletes the staff account and all attached data including commissions, document categories, project documents, and uploads. Clients managed by this staff member have their account partner cleared.',
    type: DeleteStaffResponse,
  })
  @ApiBadRequestResponse({
    description: 'You cannot delete your own account.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can delete staff accounts.',
  })
  @ApiNotFoundResponse({
    description: 'The specified staff user was not found.',
  })
  @Admin()
  @Delete('staff/:id')
  async deleteStaff(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.users.deleteStaff(id, user);
  }
}
