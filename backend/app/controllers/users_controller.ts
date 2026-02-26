import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { UserService } from '#services/user_service'
import { updateProfileValidator } from '#validators/user_validator'
import { changePasswordValidator } from '#validators/change_password'

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

  async changePassword({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(changePasswordValidator)

    await this.userService.changePassword(user.id, data.currentPassword, data.newPassword)

    return { message: '密码修改成功' }
  }
}
