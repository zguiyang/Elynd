import { withAuthFinder } from '@adonisjs/auth/mixins/lucid';
import { compose } from '@adonisjs/core/helpers';
import hash from '@adonisjs/core/services/hash';

import { UserSchema } from '#database/schema';

export default class User extends compose(
  UserSchema,
  withAuthFinder(hash, {
    uids: ['email', 'username'],
    passwordColumnName: 'password',
  }),
) {
  get isEmailVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }
}
