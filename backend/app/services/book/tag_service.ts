import { inject } from '@adonisjs/core'
import Tag from '#models/tag'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

@inject()
export class TagService {
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async findOrCreate(name: string): Promise<Tag> {
    const slug = this.generateSlug(name)

    return await Tag.firstOrCreate({ slug }, { name, slug })
  }

  async findOrCreateByName(name: string, trx?: TransactionClientContract): Promise<Tag> {
    const slug = this.generateSlug(name)

    if (trx) {
      const existing = await Tag.query({ client: trx }).where('slug', slug).first()
      if (existing) {
        return existing
      }

      return await Tag.create({ name, slug }, { client: trx })
    }

    return await Tag.firstOrCreate({ slug }, { name, slug })
  }

  async listAll(): Promise<Tag[]> {
    return Tag.query().orderBy('name', 'asc')
  }
}
