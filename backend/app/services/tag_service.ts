import { inject } from '@adonisjs/core'
import Tag from '#models/tag'

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

  async listAll(): Promise<Tag[]> {
    return Tag.query().orderBy('name', 'asc')
  }
}
