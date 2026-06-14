import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Admin, Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { IAuthUser } from '../auth/auth.types';
import { CommissionsService } from './commissions.service';
import {
  CommissionResponse,
  UpdateCommissionInput,
  UpdateCommissionResponse,
} from './commissions.types';

@ApiTags('commissions')
@ApiBearerAuth()
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @ApiOperation({ summary: 'List all commissions' })
  @ApiOkResponse({
    description:
      'Returns every commission recorded in the system. This endpoint is restricted to administrators.',
    type: CommissionResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can manage commissions.',
  })
  @Admin()
  @Get()
  async getCommissionList(@AuthUser() user: IAuthUser) {
    return this.commissions.getCommissionList(user);
  }

  @ApiOperation({
    summary: 'List commissions for the authenticated staff user',
  })
  @ApiOkResponse({
    description:
      'Returns the commissions owned by the authenticated staff user.',
    type: CommissionResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can view commissions.',
  })
  @Auth([Role.STAFF])
  @Get('me')
  async getMyCommissionList(@AuthUser() user: IAuthUser) {
    return this.commissions.getMyCommissionList(user);
  }

  @ApiOperation({ summary: 'List commissions for one staff user' })
  @ApiParam({
    name: 'staffId',
    format: 'uuid',
    description:
      'Unique identifier for the staff user whose commissions are needed.',
  })
  @ApiOkResponse({
    description:
      'Returns every commission owned by the specified staff user. Administrators can view any staff user. Non-admin staff can only view their own commissions.',
    type: CommissionResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only staff users can view commissions, and non-admin staff can only view their own commissions.',
  })
  @ApiNotFoundResponse({
    description: 'The specified staff user was not found.',
  })
  @Auth([Role.STAFF])
  @Get('staff/:staffId')
  async getStaffCommissionList(
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.commissions.getStaffCommissionList(staffId, user);
  }

  @ApiOperation({ summary: 'Update one commission' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier for the commission to update.',
  })
  @ApiBody({ type: UpdateCommissionInput })
  @ApiOkResponse({
    description: 'Updates the specified commission.',
    type: UpdateCommissionResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, no update fields were provided, or the requested status transition is not allowed.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can manage commissions.',
  })
  @ApiNotFoundResponse({
    description: 'The specified commission was not found.',
  })
  @Admin()
  @Patch(':id')
  async updateCommission(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCommissionInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.commissions.updateCommission(id, dto, user);
  }
}
