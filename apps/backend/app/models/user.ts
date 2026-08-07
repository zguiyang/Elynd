import { UserSchema } from '#database/schema';
import hash from '@adonisjs/core/services/hash';
import { compose } from '@adonisjs/core/helpers';
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid';

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
