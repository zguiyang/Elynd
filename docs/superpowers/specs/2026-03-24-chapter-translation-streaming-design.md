# 章节翻译流式分片方案

## 1. 概述

将双语翻译功能从"一次性全量翻译"改为"段落级流式分片翻译"，解决大章节的 Invalid JSON 错误和响应慢的问题。

### 目标

- 大章节不再出现 Invalid JSON 错误
- 用户实时看到翻译进度
- 部分失败不影响已成功内容

---

## 2. 架构设计

### 2.1 整体流程

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ 前端请求翻译 │────▶│  创建 Job    │────▶│  逐段落翻译  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    ▼                            ▼                            ▼
           ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
           │  写入 Redis   │          │   推送 SSE    │          │   更新状态    │
           │    进度        │          │   段落事件    │          │              │
           └───────────────┘          └───────────────┘          └───────────────┘
                    │                            │
                    ▼                            ▼
           ┌─────────────────────────────────────────────┐
           │              前端增量展示                    │
           │   按 paragraphIndex 插入段落，实时可见        │
           └─────────────────────────────────────────────┘
```

### 2.2 组件职责

| 组件 | 职责 |
|------|------|
| `TranslateChapterJob` | 按段落分批调用 AI，每完成一个段落写入 Redis |
| `ChapterTranslationsController.events` | SSE 端点，实时推送段落翻译结果 |
| Redis | 存储翻译进度和最终结果 |
| 前端 | 接收 SSE 事件，增量展示翻译段落 |

---

## 3. 数据结构

### 3.1 Redis Key 设计

```
# 翻译进度（实时更新）
# Key: translation_progress:{translationId}
# 与现有 cache key (CHAPTER_TRANSLATION.CACHE_PREFIX) 用途区分：
# - translation_progress: 仅用于 SSE 实时推送，Job 完成后可删除
# - translation_result: 最终结果缓存，与现有语义一致
{
  "totalParagraphs": 10,
  "title": { "original": "...", "translated": "..." },
  "paragraphs": [
    { "paragraphIndex": 0, "status": "completed", "sentences": [...] },
    { "paragraphIndex": 1, "status": "completed", "sentences": [...] },
    { "paragraphIndex": 2, "status": "failed", "error": "..." }
  ],
  "currentParagraph": 3,
  "overallStatus": "processing"
}

# 最终结果（全部完成后写入）
# Key: translation_result:{translationId}
# 格式与现有 ChapterTranslationResult 类型完全一致
{
  "title": { "original": "...", "translated": "..." },
  "paragraphs": [{ "paragraphIndex": 0, "sentences": [...] }, ...]
}

# Redis Pub/Sub 频道（用于 Job 与 SSE 解耦）
# Channel: translation_events:{translationId}
```

### 3.2 SSE 事件类型

| 事件类型 | payload | 说明 |
|----------|---------|------|
| `status` | `{ translationId, status, errorMessage? }` | 兼容现有前端 |
| `paragraph` | `{ paragraphIndex, sentences, status }` | 单个段落翻译完成 |
| `error` | `{ translationId, message }` | 段落翻译失败或整体失败 |
| `done` | `{ translationId }` | 全部完成 |
| `failed` | `{ translationId, message }` | 整体失败 |

---

## 4. 核心变更

### 4.1 TranslateChapterJob

**现状问题：**
- 一次性请求整个章节的 JSON 翻译
- 超大章节超出 maxTokens 限制导致 Invalid JSON

**改造方案：**
```
1. 解析章节内容为段落数组（按 \n\n 分割）
2. 先翻译标题（作为整体）
3. 逐段落翻译（每段落间延迟 200ms 避免速率限制）：
   a. 调用 AI 翻译单个段落
   b. 写入 Redis progress + 发布 Pub/Sub 事件
   c. 继续下一个段落
4. 全部完成后写入 translation_result
```

**段落分割逻辑：**
- 按 `\n\n` 分割章节内容为空行分隔的段落
- 过滤空段落
- 每个段落独立翻译

**段落 prompt 设计：**
```
系统提示词保持简洁，要求 AI 只返回一个段落的翻译结果 JSON
```

**Job 与 SSE 解耦机制：**
- Job 通过 Redis Pub/Sub 发布事件到 `translation_events:{translationId}`
- SSE 端点订阅同一频道，收到事件后推送给前端
- 不需要 Job 直接持有 SSE writer 实例

### 4.2 SSE events 端点

**现状问题：**
- 每 1500ms 轮询数据库状态
- 只推送整体状态，不推送翻译内容

**改造方案：**
```
1. 建立 SSE 连接后，订阅 Redis pub/sub 频道 `translation_events:{translationId}`
2. 每当 Job 发布新事件（paragraph/status/done），立即推送给前端
3. 保持现有 1500ms 心跳机制，发送 status 事件保持连接活跃
```

**SSE 端点事件流：**
1. 连接建立 → 发送 `status: processing`
2. 订阅 Redis Pub/Sub → 收到事件立即转发
3. 每 1500ms → 发送 `status` 心跳
4. Job 完成 → 发送 `done` 事件
5. 连接关闭 → 取消订阅

### 4.3 前端展示

**现状问题：**
- 等待翻译完成后一次性展示

**改造方案：**
```
1. 前端显示原文段落列表
2. 接收 SSE paragraph 事件后，按 paragraphIndex 插入翻译
3. 未翻译的段落显示原文，翻译完成显示双语
4. 支持段落失败状态和重试按钮
```

---

## 5. 错误处理

### 5.1 单段落失败策略

- 段落翻译失败不影响其他段落
- 失败段落记录到 `paragraphs[index].status = 'failed'`
- SSE 推送 error 事件
- 前端显示失败状态 + 重试按钮

### 5.2 单段落重试 API

**端点：** `POST /api/chapter-translations/:id/paragraphs/:paragraphIndex/retry`

**请求体：** 无

**响应：**
```json
{
  "status": "queued",
  "translationId": 123,
  "paragraphIndex": 2
}
```

**处理流程：**
1. 前端点击重试按钮
2. 调用重试 API
3. 创建新的 `TranslateParagraphJob`（独立于主 Job）
4. 新 Job 完成后更新 Redis progress
5. 通过 Pub/Sub 推送结果

**注意：** 重试 Job 与主 Job 并发执行，需要通过 paragraphIndex 作为锁防止竞争。

### 5.3 整体失败

- Job 异常终止时
- 状态标记为 failed
- SSE 推送 failed 事件
- 前端提示用户重新发起翻译

---

## 6. 缓存策略

### 6.1 进度缓存

- Key: `translation_progress:{translationId}`
- TTL: 1 小时（防止孤儿数据）
- Job 完成后保留，供前端查询
- 后续可清理或转入最终结果

### 6.2 最终结果缓存

- Key: `translation_result:{translationId}`
- TTL: 与现有 `CHAPTER_TRANSLATION.RESULT_TTL_SECONDS` 一致
- 完成后从 progress 写入 result
- 与现有 `result_json` 字段同步

---

## 7. 向后兼容

- 现有缓存机制保持不变
- 轮询模式作为 SSE 失败的 fallback
- 现有 API 接口不变

---

## 8. 文件变更清单

### 后端
- `app/jobs/translate_chapter_job.ts` - 改为逐段落翻译
- `app/services/book/chapter_translation_service.ts` - 添加进度写入方法
- `app/controllers/chapter_translations_controller.ts` - SSE 实时推送
- `app/utils/sse.ts` - 可能需要 minor 调整

### 前端
- `web/src/views/learning/learning-book.vue` - 增量展示逻辑
- `web/src/api/chapter-translation.ts` - SSE paragraph 事件处理
- `web/src/types/book.ts` - 新增类型定义

---

## 9. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| AI 段落间上下文丢失 | prompt 包含章节标题和位置信息 |
| SSE 断连 | 前端 fallback 到轮询模式 |
| Redis 不可用 | Job 内部 catch，写入数据库状态 |
| AI API 速率限制 | 每段落间延迟 200ms，并发 Job=2 |
| Job 崩溃导致状态不一致 | progress 数据保留，Job 重启可恢复 |
| 重复触发翻译 | 检查 existing active translation，阻止重复 Job |
