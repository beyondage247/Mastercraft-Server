import { PrismaClient, PrismaPromise } from '@prisma/client';
import { format } from 'date-fns';

export type TableWithIds<Column extends string> = {
  findFirst(args: {
    where: Record<Column, { startsWith: string }>;
    orderBy: Record<Column, 'desc'>;
    select: Record<Column, true>;
  }): PrismaPromise<{ [key in Column]: string } | null>;
};

export type ClientWithIds<Model extends string, Column extends string> = {
  [key in Model]: TableWithIds<Column>;
};

export type IdGeneratorOptions<Model extends string, Column extends string> = {
  model: Model;
  column: Column;
  prefix: string;
};

export class IdGenerator<
  Model extends string & keyof PrismaClient,
  Column extends string,
> {
  private readonly model: Model;
  private readonly column: Column;
  private readonly prefix: string;
  private readonly digits = 3;

  constructor(options: IdGeneratorOptions<Model, Column>) {
    this.model = options.model;
    this.column = options.column;
    this.prefix = options.prefix;
  }

  private value<V>(v: V) {
    return { [this.column]: v } as Record<Column, V>;
  }

  async nextId(client: ClientWithIds<Model, Column>): Promise<string> {
    const [id] = await this.nextIds(client, 1);
    return id;
  }

  async nextIds(
    client: ClientWithIds<Model, Column>,
    count: number,
  ): Promise<string[]> {
    const startsWith = `${this.prefix}-` + format(new Date(), 'yyyyMMdd');

    const last = await client[this.model].findFirst({
      where: this.value({ startsWith }),
      orderBy: this.value('desc'),
      select: this.value(true),
    });

    const lastSuffix = last?.[this.column].substring(startsWith.length + 1);
    const lastNumber = Number(lastSuffix) || 0;

    return Array.from({ length: count }, (_, i) => {
      const nextNumber = lastNumber + i + 1;
      const nextSuffix = nextNumber.toString().padStart(this.digits, '0');
      return `${startsWith}-${nextSuffix}`;
    });
  }
}
