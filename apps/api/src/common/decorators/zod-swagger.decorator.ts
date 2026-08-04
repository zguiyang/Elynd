import type { Type } from '@nestjs/common'
import { applyDecorators } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger'

import { createZodDto } from 'nestjs-zod'
import type { ZodObject, ZodRawShape } from 'zod'
import { z } from 'zod'

import { getRegisteredName, registerSchema } from '../../swagger/zod-schema-registry.js'

let __zodSwaggerId = 0

type Opts = {
  summary?: string
  body?: ZodObject<ZodRawShape>
  response?: ZodObject<ZodRawShape>
  query?: ZodObject<ZodRawShape>
  params?: ZodObject<ZodRawShape>
  successStatus?: number
  errorStatus?: number
}

export function zodSwaggerDocs(options: Opts) {
  const decorators: unknown[] = []

  try {
    if (options.body) {
      registerSchema(options.body)
    }
    if (options.response) {
      registerSchema(options.response)
    }
    if (options.query) {
      registerSchema(options.query)
    }
    if (options.params) {
      registerSchema(options.params)
    }
  } catch (err) {
    console.warn('Failed to register Zod schema for Swagger components:', (err as Error).message)
  }

  if (options.summary) {
    decorators.push(ApiOperation({ summary: options.summary }))
  } else if (options.body && (options.body as { description?: string }).description) {
    decorators.push(
      ApiOperation({ summary: (options.body as { description?: string }).description })
    )
  }

  if (options.body) {
    const registered = getRegisteredName(options.body)
    if (registered) {
      decorators.push(
        ApiBody({
          schema: { $ref: `#/components/schemas/${registered}` }
        })
      )
    } else {
      const BaseBodyDto = createZodDto(options.body) as Type<object>
      const BodyDto = class extends (BaseBodyDto as new () => object) {}
      Object.defineProperty(BodyDto, 'name', { value: `ZodBodyDto_${++__zodSwaggerId}` })
      decorators.push(ApiBody({ type: BodyDto }))
    }
  }

  if (options.response) {
    const successStatus = options.successStatus ?? 200
    const respDesc =
      (options.response as { description?: string }).description ??
      (options.response as { _def?: { meta?: { description?: string } } })._def?.meta
        ?.description ??
      options.summary ??
      ''

    const registered = getRegisteredName(options.response)
    if (registered) {
      decorators.push(
        ApiResponse({
          status: successStatus,
          description: respDesc,
          schema: { $ref: `#/components/schemas/${registered}` }
        })
      )
    } else {
      const BaseRespDto = createZodDto(options.response) as Type<object>
      const RespDto = class extends (BaseRespDto as new () => object) {}
      Object.defineProperty(RespDto, 'name', { value: `ZodRespDto_${++__zodSwaggerId}` })
      decorators.push(
        ApiResponse({
          status: successStatus,
          description: respDesc,
          type: RespDto
        })
      )
    }

    if (options.errorStatus) {
      decorators.push(
        ApiResponse({
          status: options.errorStatus,
          description: 'Error'
        })
      )
    }
  }

  if (options.query) {
    try {
      const json = (
        z as unknown as {
          toJSONSchema: (
            s: unknown,
            o: object
          ) => {
            properties?: Record<string, { description?: string }>
            required?: string[]
            definitions?: Record<
              string,
              { properties?: Record<string, unknown>; required?: string[] }
            >
          }
        }
      ).toJSONSchema(options.query, { io: 'input' })
      let props = json?.properties
      let requiredList: string[] = Array.isArray(json?.required) ? json.required : []

      if ((!props || Object.keys(props).length === 0) && json?.definitions) {
        const firstDef = Object.values(json.definitions)[0]
        props = firstDef?.properties as typeof props
        requiredList = Array.isArray(firstDef?.required) ? firstDef.required : requiredList
      }

      if (props && typeof props === 'object') {
        for (const [name, propSchema] of Object.entries(props)) {
          const desc = propSchema?.description
          const required = requiredList.includes(name)
          decorators.push(
            ApiQuery({
              name,
              description: desc,
              required,
              schema: propSchema
            })
          )
        }
      } else {
        const QueryDto = createZodDto(options.query) as Type<object>
        decorators.push(ApiQuery({ type: QueryDto, required: false }))
      }
    } catch {
      const QueryDto = createZodDto(options.query) as Type<object>
      decorators.push(ApiQuery({ type: QueryDto, required: false }))
    }
  }

  if (options.params) {
    try {
      const json = (
        z as unknown as {
          toJSONSchema: (
            s: unknown,
            o: object
          ) => {
            properties?: Record<string, { description?: string }>
            required?: string[]
            definitions?: Record<
              string,
              { properties?: Record<string, unknown>; required?: string[] }
            >
          }
        }
      ).toJSONSchema(options.params, { io: 'input' })
      let props = json?.properties
      let requiredList: string[] = Array.isArray(json?.required) ? json.required : []

      if ((!props || Object.keys(props).length === 0) && json?.definitions) {
        const firstDef = Object.values(json.definitions)[0]
        props = firstDef?.properties as typeof props
        requiredList = Array.isArray(firstDef?.required) ? firstDef.required : requiredList
      }

      if (props && typeof props === 'object' && Object.keys(props).length > 0) {
        for (const [name, propSchema] of Object.entries(props)) {
          const desc = propSchema?.description
          const required = requiredList.includes(name)
          decorators.push(ApiParam({ name, description: desc, required }))
        }
      } else {
        decorators.push(ApiParam({ name: 'id' }))
      }
    } catch (err) {
      console.warn('Failed to extract params shape for Swagger:', (err as Error).message)
      decorators.push(ApiParam({ name: 'id' }))
    }
  }

  return applyDecorators(...(decorators as Parameters<typeof applyDecorators>))
}
