import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, type AnyColumn, asc, desc, eq, like, sql } from 'drizzle-orm';

import type { Db } from '@elynd/db';
import { examplesTable } from '@elynd/db';

import { DB } from '../../global/providers/db.provider.js';
import type { CreateExampleDto, QueryExamplePageDto, UpdateExampleDto } from './examples.schema.js';

@Injectable()
export class ExamplesService {
  private readonly logger = new Logger(ExamplesService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  async createExample(userId: string, createExampleDto: CreateExampleDto) {
    try {
      const [example] = await this.db
        .insert(examplesTable)
        .values({
          user_id: userId,
          ...createExampleDto,
        })
        .returning();

      this.logger.log(`Example created successfully: ${example.id}`);
      return example;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create example: ${message}`);
      throw error;
    }
  }

  async getExampleById(userId: string, id: string) {
    const example = await this.db
      .select()
      .from(examplesTable)
      .where(and(eq(examplesTable.id, id), eq(examplesTable.user_id, userId)))
      .limit(1);

    if (!example || example.length === 0) {
      throw new NotFoundException('Example not found or access denied');
    }

    return example[0];
  }

  async updateExample(userId: string, id: string, updateExampleDto: UpdateExampleDto) {
    await this.getExampleById(userId, id);

    try {
      const [updatedExample] = await this.db
        .update(examplesTable)
        .set({
          ...updateExampleDto,
          updated_at: new Date(),
        })
        .where(eq(examplesTable.id, id))
        .returning();

      this.logger.log(`Example updated successfully: ${id}`);
      return updatedExample;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update example ${id}: ${message}`);
      throw error;
    }
  }

  async deleteExample(userId: string, id: string) {
    await this.getExampleById(userId, id);

    try {
      await this.db.delete(examplesTable).where(eq(examplesTable.id, id));
      this.logger.log(`Example deleted successfully: ${id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete example ${id}: ${message}`);
      throw error;
    }
  }

  async getExamples(userId: string, query: QueryExamplePageDto) {
    const { page, pageSize, orderBy, direction, name, description } = query;

    try {
      const conditions = [eq(examplesTable.user_id, userId)];

      if (name) {
        conditions.push(like(examplesTable.name, `%${name}%`));
      }

      if (description) {
        conditions.push(like(examplesTable.description, `%${description}%`));
      }

      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(examplesTable)
        .where(and(...conditions));

      const total = Number(countResult.count);
      const pages = Math.ceil(total / pageSize);

      const orderColumn: AnyColumn =
        (examplesTable as unknown as Record<string, AnyColumn>)[orderBy] ?? examplesTable.created_at;

      const examples = await this.db
        .select()
        .from(examplesTable)
        .where(and(...conditions))
        .orderBy(direction === 'asc' ? asc(orderColumn) : desc(orderColumn))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return {
        content: examples,
        page,
        pages,
        pageSize,
        total,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get examples: ${message}`);
      throw error;
    }
  }
}
