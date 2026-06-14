import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { IAuthUser } from '../auth/auth.types';
import {
  CreateReportInput,
  CreateReportResponse,
  ReportResponse,
} from './report.types';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @ApiOperation({ summary: 'List reports' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Returns all reports for administrators. Non-admin staff only receive reports they personally submitted.',
    type: ReportResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can view reports.',
  })
  @Auth([Role.STAFF])
  @Get()
  async getReportList(@AuthUser() user: IAuthUser) {
    return this.reports.getReportList(user);
  }

  @ApiOperation({ summary: 'Create a report' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateReportInput })
  @ApiCreatedResponse({
    description: 'Creates a new staff report for the authenticated user.',
    type: CreateReportResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The payload is invalid, the date format is wrong, the dates are inconsistent, or a count field is not a non-negative integer.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users can create reports.',
  })
  @Auth([Role.STAFF])
  @Post()
  async createReport(
    @Body() dto: CreateReportInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.reports.createReport(dto, user);
  }
}
