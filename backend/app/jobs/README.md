# Jobs Directory

## Overview

This directory contains background job classes for processing asynchronous tasks using `adonisjs-jobs` framework.

## Service Resolution Pattern

**IMPORTANT**: Job classes cannot use the `@inject()` decorator because `adonisjs-jobs` does not support dependency injection. Instead, you must use `app.container.make()` to resolve services from the IoC container.

### Correct Pattern

```typescript
import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { SomeService } from '#services/some_service'

export default class ExampleJob extends Job {
  async handle(payload: ExamplePayload) {
    const someService = await app.container.make(SomeService)
    await someService.process(payload)
  }
}
```

### Incorrect Patterns

```typescript
// WRONG: Direct instantiation - fails if service uses @inject()
export default class ExampleJob extends Job {
  private someService = new SomeService() // Will fail!
}

// WRONG: Cannot use @inject() in Job classes
@inject()
export default class ExampleJob extends Job {
  constructor(private someService: SomeService) {} // Not supported!
}
```

## Why `app.container.make()`?

According to AdonisJS v6 documentation:

> For situations where you want to self-construct a class instance using the container, you can use the `container.make` method. The `container.make` method accepts a class constructor and returns an instance of it after resolving all its dependencies.

Using `app.container.make()` ensures that:
1. All dependencies declared with `@inject()` are properly resolved
2. The service receives correct context (e.g., HTTP context if needed)
3. Logging and monitoring are properly configured

## Service Usage Examples

### GenerateBook Job

```typescript
import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { BookService } from '#services/book_service'
import { TransmitService } from '#services/transmit_service'

export default class GenerateBook extends Job {
  async handle(payload: GenerateBookPayload) {
    const bookService = await app.container.make(BookService)
    const transmitService = await app.container.make(TransmitService)
    
    // ... job logic
  }
}
```

### GenerateAiTags Job

```typescript
import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { AiService } from '#services/ai_service'
import { SettingService } from '#services/setting_service'
import PromptService from '#services/prompt_service'

export default class GenerateAiTags extends Job {
  async handle(payload: GenerateAiTagsPayload) {
    const settingService = await app.container.make(SettingService)
    const aiService = await app.container.make(AiService)
    const promptService = await app.container.make(PromptService)
    
    // ... job logic
  }
}
```

## Best Practices

1. **Always use `app.container.make()`** for service resolution in Job classes
2. **Avoid circular dependencies** between jobs and services
3. **Use `logger`** from `@adonisjs/core/services/logger` for logging
4. **Throw exceptions** instead of returning error objects
5. **Handle errors gracefully** and log them properly

## Related Documentation

- [AdonisJS IoC Container](https://docs.adonisjs.com/guides/concepts/ioc-container)
- [AdonisJS Dependency Injection](https://docs.adonisjs.com/guides/concepts/dependency-injection)
- [adonisjs-jobs GitHub](https://github.com/adonisjs/adonisjs-jobs)
