import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Legacy migration placeholder.
 *
 * This file restores a previously executed migration entry that still exists
 * in `adonis_schema` but had its source file removed, which caused `corrupt`
 * status in `node ace migration:status`.
 *
 * The real schema change is already represented by newer migrations.
 */
export default class extends BaseSchema {
  async up() {}

  async down() {}
}
