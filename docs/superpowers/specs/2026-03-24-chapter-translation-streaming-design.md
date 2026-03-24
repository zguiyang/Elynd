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
translation_progress:{translationId}
{
  "totalParagraphs": 10,
  "title": { "original": "...", "translated": "..." },
  "paragraphs": {
    "0": { "status": "completed", "sentences": [...] },
    "1": { "status": "completed", "sentences": [...] },
    "2": { "status": "failed", "error": "..." }
  },
  "currentParagraph": 3,
  "overallStatus": "processing"
}

# 最终结果（全部完成后写入）
translation_result:{translationId}
{
  "title": { "original": "...", "translated": "..." },
  "paragraphs": [{ "paragraphIndex": 0, "sentences": [...] }, ...]
}
```

### 3.2 SSE 事件类型

| 事件类型 | payload | 说明 |
|----------|---------|------|
| `paragraph` | `{ paragraphIndex, sentences, status }` | 单个段落翻译完成 |
| `progress` | `{ currentParagraph, totalParagraphs }` | 进度更新 |
| `error` | `{ paragraphIndex, message }` | 段落翻译失败 |
| `done` | `{ translationId }` | 全部完成 |
| `failed` | `{ message }` | 整体失败 |

---

## 4. 核心变更

### 4.1 TranslateChapterJob

**现状问题：**
- 一次性请求整个章节的 JSON 翻译
- 超大章节超出 maxTokens 限制导致 Invalid JSON

**改造方案：**
```
1. 解析章节内容为段落数组
2. 先翻译标题（作为整体）
3. 逐段落翻译：
   a. 调用 AI 翻译单个段落
   b. 写入 Redis progress
   c. 推送 SSE paragraph 事件
   d. 继续下一个段落
4. 全部完成后写入 translation_result
```

**段落 prompt 设计：**
```
系统提示词保持简洁，要求 AI 只返回一个段落的翻译结果 JSON
```

### 4.2 SSE events 端点

**现状问题：**
- 每 1500ms 轮询数据库状态
- 只推送整体状态，不推送翻译内容

**改造方案：**
```
1. 建立 SSE 连接后，订阅 Redis pub/sub 或轮询 progress
2. 每当有新段落完成，立即推送 paragraph 事件
3. 监听 overallStatus 变化，completed 时推送 done
```

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

### 5.2 失败重试

- 前端点击重试按钮
- 调用单独的段落翻译 API
- 成功后更新 Redis 和 SSE

### 5.3 整体失败

- Job 异常终止时
- 状态标记为 failed
- SSE 推送 failed 事件
- 前端提示用户重新发起翻译

---

## 6. 缓存策略

### 6.1 进度缓存

- Key: `translation_progress:{translationId}`
- 不设置 TTL，Job 完成后保留
- 前端可随时获取当前进度

### 6.2 最终结果缓存

- Key: `translation_result:{translationId}`
- TTL: 与现有 `CHAPTER_TRANSLATION.RESULT_TTL_SECONDS` 一致
- 完成后从 progress 写入 result

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
