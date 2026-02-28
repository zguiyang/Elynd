import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Tag from '#models/tag'

type TransactionClient = Awaited<ReturnType<typeof db.transaction>>

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

  async findOrCreateByName(name: string, trx?: TransactionClient): Promise<Tag> {
    const slug = this.generateSlug(name)

    if (trx) {
      const existing = await Tag.query(trx as any)
        .where('slug', slug)
        .first()
      if (existing) {
        return existing
      }
      return await Tag.create({ name, slug }, { client: trx as any })
    }

    return await Tag.firstOrCreate({ slug }, { name, slug })
  }

  async listAll(): Promise<Tag[]> {
    return Tag.query().orderBy('name', 'asc')
  }
}
