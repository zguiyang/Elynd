import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api', {
    exclude: ['health']
  })

  app.enableCors({
    origin: true,
    credentials: true
  })

  const port = process.env.PORT ?? 3336
  await app.listen(port)
  logger.log(`Application is running on: ${await app.getUrl()}`)
}

void bootstrap()
