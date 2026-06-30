import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { IAuthUser } from 'src/modules/auth/auth.types';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import {
  CreateDocumentCategoryInput,
  CreateProjectDocumentInput,
  UpdateDocumentCategoryInput,
} from './documents.types';

const categorySelect = {
  id: true,
  name: true,
  createdAt: true,
  createdById: true,
} satisfies Prisma.ProjectDocumentCategorySelect;

const documentSelect = {
  id: true,
  categoryId: true,
  uploadedById: true,
  createdAt: true,
  upload: {
    select: {
      id: true,
      name: true,
      size: true,
    },
  },
} satisfies Prisma.ProjectDocumentSelect;

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectDocuments(projectId: string, user: IAuthUser) {
    await this.validateProjectAccess(projectId, user);

    const [categories, uncategorized] = await Promise.all([
      this.prisma.projectDocumentCategory.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        select: {
          ...categorySelect,
          documents: {
            orderBy: { createdAt: 'asc' },
            select: documentSelect,
          },
        },
      }),
      this.prisma.projectDocument.findMany({
        where: { projectId, categoryId: null },
        orderBy: { createdAt: 'asc' },
        select: documentSelect,
      }),
    ]);

    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        createdAt: category.createdAt.toISOString(),
        documents: category.documents.map((doc) => this.serializeDocument(doc)),
      })),
      uncategorized: uncategorized.map((doc) => this.serializeDocument(doc)),
    };
  }

  async createCategory(dto: CreateDocumentCategoryInput, user: IAuthUser) {
    await this.validateProjectAccess(dto.projectId, user);

    const name = dto.name.trim();
    if (!name) bad('Category name is required');

    const existing = await this.prisma.projectDocumentCategory.findFirst({
      where: { projectId: dto.projectId, name },
      select: { id: true },
    });
    if (existing) bad('A category with this name already exists in the project');

    const category = await this.prisma.projectDocumentCategory.create({
      data: {
        name,
        project: { connect: { id: dto.projectId } },
        createdBy: { connect: { id: user.id } },
      },
      select: categorySelect,
    });

    return {
      message: 'Category created successfully',
      category: {
        id: category.id,
        name: category.name,
        createdAt: category.createdAt.toISOString(),
      },
    };
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateDocumentCategoryInput,
    user: IAuthUser,
  ) {
    const category = await this.prisma.projectDocumentCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        projectId: true,
      },
    });
    if (!category) bad('Category not found', 404);

    await this.validateProjectAccess(category.projectId, user);

    const name = dto.name.trim();
    if (!name) bad('Category name is required');

    const duplicate = await this.prisma.projectDocumentCategory.findFirst({
      where: { projectId: category.projectId, name, id: { not: categoryId } },
      select: { id: true },
    });
    if (duplicate)
      bad('A category with this name already exists in the project');

    const updated = await this.prisma.projectDocumentCategory.update({
      where: { id: categoryId },
      data: { name },
      select: categorySelect,
    });

    return {
      message: 'Category updated successfully',
      category: {
        id: updated.id,
        name: updated.name,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  }

  async deleteCategory(categoryId: string, user: IAuthUser) {
    const category = await this.prisma.projectDocumentCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        projectId: true,
      },
    });
    if (!category) bad('Category not found', 404);

    await this.validateProjectAccess(category.projectId, user);

    await this.prisma.projectDocumentCategory.delete({
      where: { id: categoryId },
    });

    return { message: 'Category deleted successfully' };
  }

  async createDocument(dto: CreateProjectDocumentInput, user: IAuthUser) {
    await this.validateProjectAccess(dto.projectId, user);

    const upload = await this.prisma.upload.findUnique({
      where: { id: dto.uploadId },
      select: { id: true, userId: true },
    });
    if (!upload) bad('Upload not found', 404);

    if (user.role === Role.CLIENT && upload.userId !== user.id) {
      bad('You can only add your own uploads as documents', 403);
    }

    if (dto.categoryId) {
      const category = await this.prisma.projectDocumentCategory.findUnique({
        where: { id: dto.categoryId },
        select: { id: true, projectId: true },
      });
      if (!category) bad('Category not found', 404);
      if (category.projectId !== dto.projectId) {
        bad('Category does not belong to this project');
      }
    }

    const document = await this.prisma.projectDocument.create({
      data: {
        project: { connect: { id: dto.projectId } },
        upload: { connect: { id: dto.uploadId } },
        uploadedBy: { connect: { id: user.id } },
        ...(dto.categoryId
          ? { category: { connect: { id: dto.categoryId } } }
          : {}),
      },
      select: documentSelect,
    });

    return {
      message: 'Document added successfully',
      document: this.serializeDocument(document),
    };
  }

  async deleteDocument(documentId: string, user: IAuthUser) {
    const document = await this.prisma.projectDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        projectId: true,
        uploadedById: true,
      },
    });
    if (!document) bad('Document not found', 404);

    await this.validateProjectAccess(document.projectId, user);

    if (user.role === Role.CLIENT && document.uploadedById !== user.id) {
      bad('You can only delete your own documents', 403);
    }

    await this.prisma.projectDocument.delete({
      where: { id: documentId },
    });

    return { message: 'Document deleted successfully' };
  }

  private async validateProjectAccess(projectId: string, user: IAuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        client: {
          select: {
            accountPartnerId: true,
          },
        },
      },
    });

    if (!project) bad('Project not found', 404);

    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      bad('You can only access documents on your own projects', 403);
    }

    if (
      user.role === Role.STAFF &&
      !user.isAdmin &&
      project.client.accountPartnerId !== user.id
    ) {
      bad('You can only access documents for clients you are managing', 403);
    }

    return project;
  }

  private serializeDocument(
    doc: Prisma.ProjectDocumentGetPayload<{
      select: typeof documentSelect;
    }>,
  ) {
    return {
      id: doc.id,
      categoryId: doc.categoryId,
      uploadId: doc.upload.id,
      name: doc.upload.name,
      size: doc.upload.size,
      uploadedById: doc.uploadedById,
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
