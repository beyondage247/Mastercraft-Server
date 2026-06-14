import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { IAuthUser } from 'src/modules/auth/auth.types';
import { Auth, AuthUser } from 'src/modules/auth/decorators/auth.decorator';
import { bad } from 'src/utils/error.utils';
import { IdParam } from 'src/utils/id.util';
import { UploadsService } from './uploads.service';
import {
  DeleteUploadsInput,
  DeleteUploadsResponse,
  UploadFileBody,
  UploadResponse,
} from './uploads.types';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileBody })
  @ApiCreatedResponse({
    description: 'Stores the uploaded file and returns its generated id.',
    type: UploadResponse,
  })
  @ApiBadRequestResponse({
    description: 'The uploaded file was missing or invalid.',
  })
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.uploadFile(file);
  }

  @ApiOperation({ summary: 'Upload a file with a specific id' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier to assign to the upload record.',
  })
  @ApiBody({ type: UploadFileBody })
  @ApiCreatedResponse({
    description: 'Stores the uploaded file using the requested id.',
    type: UploadResponse,
  })
  @ApiBadRequestResponse({
    description: 'The uploaded file was missing, invalid, or exceeded 10 MB.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @Auth()
  @Post(':id')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @IdParam() id: string,
    @AuthUser() user: IAuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploads.upload(id, file, user);
  }

  @ApiOperation({ summary: 'Download one uploaded file' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Unique identifier of the upload to download.',
  })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'Returns the raw binary contents of the uploaded file.',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiNotFoundResponse({
    description: 'The specified file was not found.',
  })
  @Get('download/:id')
  async getRequestFile(@IdParam() id: string, @Res() res: Response) {
    const file = await this.uploads.getFile(id);

    if (!file) bad('File not found');

    res.setHeader('Content-Type', file.type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);

    res.send(file.data);
  }

  @ApiOperation({ summary: 'Delete uploads owned by the authenticated user' })
  @ApiBearerAuth()
  @ApiBody({ type: DeleteUploadsInput })
  @ApiOkResponse({
    description:
      'Deletes the requested uploads owned by the authenticated user.',
    type: DeleteUploadsResponse,
  })
  @ApiBadRequestResponse({
    description: 'The request body did not contain a valid list of upload ids.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid bearer token is required.',
  })
  @Auth()
  @Delete()
  async delete(
    @Body('ids') ids: string | string[],
    @AuthUser() user: IAuthUser,
  ) {
    if (typeof ids === 'string') ids = ids.split(/,\s*/g);
    if (!Array.isArray(ids)) throw new Error('Invalid upload IDs.');
    return this.uploads.delete(ids, user);
  }
}
