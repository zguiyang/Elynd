import { BaseTransformer } from '@adonisjs/core/transformers'
import type User from '#models/user'

export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'email',
        'username',
        'fullName',
        'role',
        'image',
        'createdAt',
        'updatedAt',
      ]),
      emailVerified: this.resource.emailVerifiedAt !== null,
    }
  }
}
