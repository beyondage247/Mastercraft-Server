import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import { CreateCategoryInput } from './category.types';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategoryList() {
    return this.prisma.quoteCategory.findMany({
      select: { id: true, name: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryInput) {
    const existing = await this.prisma.quoteCategory.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existing) bad('A category with this name already exists');

    const category = await this.prisma.quoteCategory.create({
      data: { name: dto.name },
      select: { id: true, name: true, createdAt: true },
    });

    return {
      message: 'Category created successfully',
      category,
    };
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.quoteCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) bad('Category not found', 404);

    await this.prisma.quoteCategory.delete({ where: { id } });

    return { message: 'Category deleted successfully' };
  }
}
