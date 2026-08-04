import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { z } from 'zod/v4'

import type { CreateExampleDto, QueryExamplePageDto, UpdateExampleDto } from '@elynd/shared/schemas'
import {
  createExampleDtoSchema,
  examplePageListResponseSchema,
  exampleResponseSchema,
  queryExamplePageDtoSchema,
  updateExampleDtoSchema
} from '@elynd/shared/schemas'

import { GetUser } from '../../common/decorators/get-user.decorator.js'
import { zodSwaggerDocs } from '../../common/decorators/zod-swagger.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { ExamplesService } from './examples.service.js'

@ApiTags('examples')
@Controller('examples')
export class ExamplesController {
  constructor(private readonly examplesService: ExamplesService) {}

  @zodSwaggerDocs({
    summary: 'Create example',
    body: createExampleDtoSchema,
    response: exampleResponseSchema,
    successStatus: 201
  })
  @Post('create')
  async createExample(
    @GetUser('id') userId: string,
    @Body(new ZodValidationPipe(createExampleDtoSchema)) createExampleDto: CreateExampleDto
  ) {
    return await this.examplesService.createExample(userId, createExampleDto)
  }

  @zodSwaggerDocs({
    summary: 'Get example by id',
    params: z.object({ id: z.string().describe('Example ID') }),
    response: exampleResponseSchema
  })
  @Get('detail/:id')
  async getExampleById(@GetUser('id') userId: string, @Param('id') id: string) {
    return await this.examplesService.getExampleById(userId, id)
  }

  @zodSwaggerDocs({
    summary: 'Update example',
    params: z.object({ id: z.string().describe('Example ID') }),
    body: updateExampleDtoSchema,
    response: exampleResponseSchema,
    successStatus: 201
  })
  @Put('update/:id')
  async updateExample(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExampleDtoSchema)) updateExampleDto: UpdateExampleDto
  ) {
    return await this.examplesService.updateExample(userId, id, updateExampleDto)
  }

  @zodSwaggerDocs({
    summary: 'Delete example',
    params: z.object({ id: z.string().describe('Example ID') })
  })
  @Delete('del/:id')
  async deleteExample(@GetUser('id') userId: string, @Param('id') id: string) {
    await this.examplesService.deleteExample(userId, id)
    return
  }

  @zodSwaggerDocs({
    summary: 'Paginated examples',
    query: queryExamplePageDtoSchema,
    response: examplePageListResponseSchema
  })
  @Get('page')
  async getExamples(
    @GetUser('id') userId: string,
    @Query(new ZodValidationPipe(queryExamplePageDtoSchema)) query: QueryExamplePageDto
  ) {
    return await this.examplesService.getExamples(userId, query)
  }
}
