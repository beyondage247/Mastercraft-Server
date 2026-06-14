import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IAuthUser } from 'src/modules/auth/auth.types';
import { connectId } from '../prisma/prisma.utils';

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  private toPrismaBytes(buffer: Express.Multer.File['buffer']) {
    return Uint8Array.from(buffer);
  }

  async upload(id: string, file: Express.Multer.File, user: IAuthUser) {
    const upload = await this.prisma.upload.create({
      data: {
        id,
        size: file.size,
        type: file.mimetype,
        data: this.toPrismaBytes(file.buffer),
        name: file.originalname,
        user: connectId(user.id),
      },
    });

    return { uploadId: upload.id };
  }

  async uploadFile(file: Express.Multer.File) {
    const upload = await this.prisma.upload.create({
      data: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        data: this.toPrismaBytes(file.buffer),
      },
    });

    return { uploadId: upload.id };
  }

  async getFile(id: string) {
    return await this.prisma.upload.findUnique({
      where: { id },
    });
  }

  async delete(ids: string[], user: IAuthUser) {
    const result = await this.prisma.upload.deleteMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
    });
    return result;
  }
}
