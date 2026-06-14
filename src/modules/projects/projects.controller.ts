import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Auth, AuthUser } from '../auth/decorators/auth.decorator';
import { IAuthUser } from '../auth/auth.types';
import {
  CreateProjectInput,
  CreateProjectCommentInput,
  CreateProjectCommentResponse,
  CreateProjectResponse,
  ProjectResponse,
  UpdateProjectAttachmentInput,
  UpdateProjectAttachmentResponse,
  UpdateProjectResponse,
  UpdateProjectStatusInput,
} from './project.types';
import { ProjectsService } from './projects.service';
import { Role } from '@prisma/client';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @ApiOperation({ summary: 'List projects' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Returns all projects for administrators. Non-admin staff only receive projects for clients they manage. Clients only receive their own projects.',
    type: ProjectResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only staff users and clients can view projects.',
  })
  @Auth()
  @Get()
  async getProjectList(@AuthUser() user: IAuthUser) {
    return this.projects.getProjectList(user);
  }

  @ApiOperation({ summary: 'List projects for one client' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'clientId',
    format: 'uuid',
    description:
      'Unique identifier for the client whose projects should be returned.',
  })
  @ApiOkResponse({
    description:
      'Returns all projects for a single client. Administrators can view any client projects. Non-admin staff can only view projects for clients they manage.',
    type: ProjectResponse,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only administrators or staff managing the client can view that client’s projects.',
  })
  @ApiNotFoundResponse({
    description: 'The specified client was not found.',
  })
  @Auth([Role.STAFF])
  @Get('client/:clientId')
  async getClientProjects(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.projects.getClientProjects(clientId, user);
  }

  @ApiOperation({ summary: 'Add a comment to a project' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateProjectCommentInput })
  @ApiCreatedResponse({
    description:
      'Adds a new comment to a project. Clients can comment on their own projects. Staff can comment on projects for clients they manage.',
    type: CreateProjectCommentResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid or the comment message was empty.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only the project client, an administrator, or the assigned account partner can comment on the project.',
  })
  @ApiNotFoundResponse({
    description: 'The specified project was not found.',
  })
  @Auth()
  @Post('comments')
  async createProjectComment(
    @Body() dto: CreateProjectCommentInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.projects.createProjectComment(dto, user);
  }

  @ApiOperation({ summary: 'Get one project' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'projectId',
    format: 'uuid',
    description: 'Unique identifier for the project to retrieve.',
  })
  @ApiOkResponse({
    description:
      'Returns a single project. Administrators can view any project. Non-admin staff can only view projects for clients they manage. Clients can only view their own projects.',
    type: ProjectResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only administrators, staff managing the project client, or the client that owns the project can view the project.',
  })
  @ApiNotFoundResponse({
    description: 'The specified project was not found.',
  })
  @Auth()
  @Get(':projectId')
  async getProject(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @AuthUser() user: IAuthUser,
  ) {
    return this.projects.getProject(projectId, user);
  }

  @ApiOperation({ summary: 'Attach uploads to a project' })
  @ApiBearerAuth()
  @ApiParam({
    name: 'projectId',
    format: 'uuid',
    description: 'Unique identifier for the project to update.',
  })
  @ApiBody({ type: UpdateProjectAttachmentInput })
  @ApiOkResponse({
    description:
      'Creates or replaces the project attachment with the provided upload ids.',
    type: UpdateProjectAttachmentResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid or the attachment upload id list was empty.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only the project client, an administrator, or the assigned account partner can update project attachments.',
  })
  @ApiNotFoundResponse({
    description: 'The specified project or one of the uploads was not found.',
  })
  @Auth()
  @Patch(':projectId/attachment')
  async updateProjectAttachment(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: UpdateProjectAttachmentInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.projects.updateProjectAttachment(projectId, dto, user);
  }

  @ApiOperation({
    summary: 'Update project stage progress or complete a project',
    description:
      'Updates any of the five standard stages: MIL, Build/Assemble, Finishing, Delivery, and Install. Staff can also manually set the project status to COMPLETED after the quote workflow has moved it to IN_PRODUCTION.',
  })
  @ApiBearerAuth()
  @ApiParam({
    name: 'projectId',
    format: 'uuid',
    description: 'Unique identifier for the project to update.',
  })
  @ApiBody({ type: UpdateProjectStatusInput })
  @ApiOkResponse({
    description:
      'Updates the project stage fields and optionally marks the project as COMPLETED.',
    type: UpdateProjectResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, no update fields were provided, a stage start date falls outside the project date range, or the requested manual project status change is not allowed.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only administrators or staff managing the project client can update the project.',
  })
  @ApiNotFoundResponse({
    description: 'The specified project was not found.',
  })
  @Auth([Role.STAFF])
  @Patch(':projectId/status')
  async updateProjectStatus(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: UpdateProjectStatusInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.projects.updateProjectStatus(projectId, dto, user);
  }

  @ApiOperation({ summary: 'Create a project' })
  @ApiBearerAuth()
  @ApiBody({ type: CreateProjectInput })
  @ApiCreatedResponse({
    description:
      'Creates a new project for a client together with the five standard project stages. Stage payloads are optional on create; omitted stages default to zeroed values and use the project start date. Newly created projects always start in PENDING status.',
    type: CreateProjectResponse,
  })
  @ApiBadRequestResponse({
    description:
      'The request body is invalid, the project dates are inconsistent, or a supplied stage date falls outside the project range.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @ApiForbiddenResponse({
    description:
      'Only administrators or the staff user assigned as the client account partner can create a project for that client.',
  })
  @ApiNotFoundResponse({
    description: 'The specified client was not found.',
  })
  @Auth([Role.STAFF])
  @Post()
  async createProject(
    @Body() dto: CreateProjectInput,
    @AuthUser() user: IAuthUser,
  ) {
    return this.projects.createProject(dto, user);
  }
}
