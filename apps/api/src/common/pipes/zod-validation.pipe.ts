import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common'

import type { ZodObject, ZodRawShape } from 'zod'
import { ZodError } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodObject<ZodRawShape>) {}

  transform(value: unknown, _: ArgumentMetadata) {
    try {
      return this.schema.parse(value)
    } catch (error) {
      if (error instanceof ZodError) {
        const e = error as ZodError
        const firstError = e.issues && e.issues[0]
        if (firstError) {
          const path = Array.isArray(firstError.path)
            ? firstError.path
            : firstError.path
              ? [firstError.path]
              : []
          const fieldPath = path.length > 0 ? path.join('.') + ': ' : ''
          const message = firstError.message ?? String(error)
          throw new BadRequestException(`${fieldPath}${message}`)
        }
        throw new BadRequestException('Validation failed')
      }
      throw new BadRequestException('Validation failed')
    }
  }
}
