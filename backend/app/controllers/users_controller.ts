import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { UserService } from '#services/user_service'
import {
  changeEmailValidator,
  updateProfileValidator,
  avatarUploadValidator,
} from '#validators/user_validator'

@inject()
export default class UsersController {
  constructor(private userService: UserService) {}

  async me({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    return user.serialize()
  }

  async update({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(updateProfileValidator)

    const updatedUser = await this.userService.update(user.id, {
      fullName: data.fullName,
    })

    return updatedUser.serialize()
  }

  async changeEmail({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(changeEmailValidator)

    await this.userService.changeEmail(user.id, data.newEmail, data.password)

    return { message: 'Verification email sent' }
  }

  async verifyEmail({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const emailToken = request.input('emailToken')

    const result = await this.userService.verifyEmailByUser(user.id, emailToken)
    return result.serialize()
  }

  async resendVerification({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    await this.userService.resendVerificationEmail(user.id)
  }

  async uploadAvatar({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(avatarUploadValidator)

    const filename = await this.userService.uploadAvatar(user.id, data.avatar)

    return {
      url: `/avatars/${filename}`,
    }
  }

  async removeAvatar({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    await this.userService.removeAvatar(user.id)
    return { success: true }
  }
}
