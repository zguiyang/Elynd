import { BaseTransformer } from '@adonisjs/core/transformers';

import type { User as UserDto } from '@elynd/shared/api/auth';

import type User from '#models/user';

export default class UserTransformer extends BaseTransformer<User> {
  toObject(): UserDto {
    return {
      id: this.resource.id,
      email: this.resource.email,
      username: this.resource.username,
      fullName: this.resource.fullName,
      role: this.resource.role,
      image: this.resource.image,
      emailVerified: this.resource.emailVerifiedAt !== null,
      createdAt: this.resource.createdAt.toISO()!,
      updatedAt: this.resource.updatedAt?.toISO() ?? null,
    };
  }
}
