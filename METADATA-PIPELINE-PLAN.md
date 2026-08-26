# 元数据自动化管线方案（定稿）

> 状态：已定稿 + 评审修订（含后续确认的全部决策与调研实证）
> 范围：后端管线 + 数据建模 + AI 回填 + **LLM 接入层协议兼容（Responses API）**；前端为后续阶段
> 编写日期：2026-08-26（评审修订同日）
> 评审结论：代码引用已全部对照验证；新增 LLM 协议兼容改造为前置基础设施，见 §2.5 与 §10 执行顺序

---

## 1. 背景与目标

### 1.1 问题

后台 EPUB 上传解析管线中，**简介（description）识别为空**，而 TextStack 平台（`github.com/mrviduus/textstack`）能正确识别。其余内容解析（章节/封面/导航）已与 TextStack 对齐。

根因（实证）：本项目 `apps/backend/src/modules/epub-ingest/epub.ts:256` 用 `textOf(metadata['dc:description'])` 提取简介，`textOf` 只接受 string 或 `#text` 键对象，遇到以下真实 EPUB 变体全部返回空：

| 场景                                          | fast-xml-parser 结果  | 本项目结果      | VersOne.Epub      |
| --------------------------------------------- | --------------------- | --------------- | ----------------- |
| 纯文本 `<dc:description>xxx</dc:description>` | string                | ✅              | ✅                |
| **带 `<p>` 子元素**（Calibre 等大量产出）     | 嵌套对象              | ❌ 空           | ✅ 拼接后代文本   |
| 嵌套 `<div><span>`                            | 嵌套对象              | ❌ 空           | ✅                |
| 多个 `<dc:description>`                       | 数组                  | ❌ 空           | ✅ 取第一个       |
| 非 `dc:` 前缀 / 大小写变体                    | 键名不匹配            | ❌ 空           | ✅ LocalName 匹配 |
| CDATA                                         | string（含原始 HTML） | ⚠️ 有值但带标签 | ✅                |

### 1.2 目标

1. **规则层**：对齐 VersOne.Epub 语义修复简介提取（不调 AI）
2. **AI 回填独立步骤**：规则层为空/弱值时，独立 job 调 AI 填充（简介+标签+分类），全流程审计
3. **共享维度建模**：标签/分类/来源独立建表，与作品多对多关联（带来源标注），可复用于其他渠道资料

### 1.3 产品决策（已确认）

| 决策项             | 结论                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| metadata-fill 职责 | **选项 A**：title/author/description/language 规则落库全量迁入 metadata-fill，content-parse 收敛为内容侧（**保留** status='draft'/coverAssetId/publishedAt/originMeta.parsed 于 content-parse，见 §5.3） |
| 分类来源           | **预定义枚举集合**（对齐 TextStack 16 类，清单见附录），存 category 表可增补，AI 只能从集合选                                                                                                            |
| 来源               | **不用 AI**：规则解析（dc:source → matchRule）→ 命中关联；未命中留空，用户手填（provenance=manual）                                                                                                      |
| AI 回填字段        | description + tags + category（source 不参与，`aiFillable: false`）                                                                                                                                      |
| AI 调用路径        | **复用现有 invokeAi**（tools + `withStructuredOutput({method:'functionCalling'})`）；删除 createAgent/toolStrategy 独立路径（评审确认）                                                                  |
| AI 复用策略        | 三层防线（prompt 引导复用 + normalized 规范化 + DB 唯一约束），物理上杜绝重复创建                                                                                                                        |
| 上下文防膨胀       | 全局数据（标签/分类）100% 走 LangChain Tools 按需查询，不塞 prompt；prompt 只含单书固定量上下文                                                                                                          |
| provenance 优先级  | `manual > ai > extracted`：只填空/弱值字段；弱值 extracted 可被 ai 覆盖（provenance 升 ai）；manual 永不覆盖（评审确认）                                                                                 |
| 失败链路           | metadata-fill 失败只写 `originMeta.lastError`，**仍 enqueue metadata-enrich**（AI 兜底，enrich 自带短路检查）（评审确认）                                                                                |
| 手填覆盖语义       | updateWork 手填 **只删 manual 再插 manual**；extracted/ai 关联永不删（评审确认）                                                                                                                         |
| jsonb 双写         | 写**合并视图**（extracted+ai+manual 全量快照）；所有写方事务内同步；读 jsonb 过渡前端零改动；阶段 4 删列切关联表（评审确认）                                                                             |
| 重试语义           | **at-least-once**：job catch 恢复 Pending；attempts:2 封顶；neededFields 只算空+弱值，重试天然幂等（评审确认）                                                                                           |
| 存量数据           | 迁移时存量 work `metadataEnrichmentStatus='skipped'`（不批量烧钱回填，阶段 4 手动触发）（评审确认）                                                                                                      |
| 模型               | OFox 平台 + `bailian/qwen3.7-plus`（function calling 实测可用）；**协议走 Responses 或 Chat Completions（model 级配置）**，锁 functionCalling 结构化输出                                                 |
| LLM 协议           | `llm_model.protocol`：`'chat-completions' \| 'responses'`，默认 chat-completions；换平台零代码（见 §2.5）                                                                                                |

---

## 2. 调研结论（实证）

### 2.1 TextStack 的简介识别机制

- 依赖 **VersOne.Epub**（NuGet）`book.Description`，产品侧零后处理（`EpubTextExtractor.cs:41`）
- 用户书链路额外 `StripHtml`（`UserIngestionService.cs:379-387`：正则去标签 → HtmlDecode → 空白压缩）
- **平台展示的简介大量来自 AI 兜底**（非解析）：用户书 `UserBookEnrichmentService` + 官方书 `SeoCrew/AutoPublishCrew`——用户选择不采用 AI 过早介入，仅作为回填层

### 2.2 VersOne.Epub 库内实现（源码实证）

```
MetadataReader.cs:48-50    GetLowerCaseLocalName()=="description" 命中
MetadataReader.cs:211-215  ReadDescription → ReadMetadataItemWithIdDirLangAndContent
MetadataReader.cs:415      content = metadataItemNode.Value   ← XElement.Value 拼接全部后代文本
BookRefReader.cs:58        Descriptions.FirstOrDefault()?.Description   ← 取第一个
XmlExtensionMethods.cs:7-10 Name.LocalName.ToLowerInvariant()  ← 去前缀 + 大小写不敏感
```

### 2.3 Node 生态替代库（源码实证）

| 库                   | description 提取                                                                | 结论                  |
| -------------------- | ------------------------------------------------------------------------------- | --------------------- |
| epub2 v3.0.2         | LocalName+小写匹配 ✅，但子元素场景输出 `[object Object]`（bug），2023 后不维护 | ❌                    |
| epubjs v0.3.93       | 面向渲染，元数据弱                                                              | ❌                    |
| foliate-js v1.0.1    | `textContent` 拼接 + `localName` 匹配（语义最接近）                             | ⚠️ 整包渲染库，引入重 |
| epub-metadata-parser | 只提取封面                                                                      | ❌                    |
| **自研增强**（采纳） | ~30 行对齐 VersOne.Epub 语义                                                    | ✅ 推荐               |

### 2.4 模型选型（调研+实测）

| 平台                                     | 大陆直连                              | 结构化输出                          | 结论           |
| ---------------------------------------- | ------------------------------------- | ----------------------------------- | -------------- |
| DeepSeek 官方                            | ✅                                    | 仅 json_object（无 json_schema）    | 能力短板，替换 |
| 302.AI                                   | ❌ 实测 api.302.ai 连不通             | 有专门「结构化输出」API             | 当前网络不可用 |
| **OFox**（`api.ofox.ai/v1`）             | ❌ 本地需代理；**服务器海外直连可用** | function calling ✅ 实测            | **采纳**       |
| 阿里百炼 / 智谱 / Kimi / 硅基流动 / 豆包 | ✅                                    | 官方支持（Qwen3.7+/GLM-5+/Kimi-K3） | 备选           |

**OFox 实测结果**（`bailian/qwen3.7-plus`，用户带代理执行）：

| 测试                          | 结果                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 普通 chat                     | ✅ 正常                                                                                                                    |
| **function calling（tools）** | ✅ `tool_calls` 正常返回——**方案主路径确定可用**                                                                           |
| json_schema                   | ⚠️ 思考模式吃掉 max_tokens 导致输出空（已实测）；**结论：放弃该路径，结构化输出统一锁 `functionCalling`（§2.4 实现形态）** |
| json_object                   | ⚠️ 同上                                                                                                                    |

**关键配置注意**：qwen 系默认思考模式，reasoning tokens 计入 completion_tokens——`llm_model.max_tokens` 必须 ≥2048，否则结构化输出被截断。

**实现形态决策（评审确认）**：**直接复用现有 `invokeAi`**（`modules/ai/service.ts` 已实现 tools 循环 + `withStructuredOutput` 组合，审计/token/503 降级全部内置）——删除原 createAgent/toolStrategy 独立路径，业务层零新调用栈；结构化输出**锁死 `withStructuredOutput({ method: 'functionCalling' })`**（OpenAI 兼容 tools 协议承载），全主流模型通用、零厂商特判。json_schema 原生（providerStrategy）增强路径**放弃**，不做自动探测降级。

---

## 2.5 LLM 接入层协议兼容改造（前置基础设施，Responses API）

> 需求：当前平台 OFox（`api.ofox.ai`）同时提供 OpenAI 双协议，官方推荐新项目用 **Responses API**（`/v1/responses`）；平台后续可能更换，代码层需做到"换平台零代码"。兼容社区主流接口协议（OpenAI Chat Completions + OpenAI Responses），不做小众协议。

### 2.5.1 调研实证

- **OFox 双协议同源**：同一 `baseUrl=https://api.ofox.ai/v1` 同时提供 `/v1/chat/completions` 与 `/v1/responses`（另有 `/anthropic`、`/gemini` 协议，本期不做）。模型 ID 带 provider 前缀（如 `openai/gpt-5.4-mini`、`bailian/qwen3.7-plus`）——**换平台 = 改 DB 配置（baseUrl + modelId + protocol + apiKey），零代码**。
- **Responses API 与 Chat Completions 差异**：`input`/`instructions` 分离（独立 prompt caching）、结构化 item、`function_call` output item / `function_call_output` input item、`max_output_tokens`、usage 字段名不同。
- **LangChain 已原生支持**（本地 `@langchain/openai@1.5.7`，远超 `0.4.5-rc.0`）：`ChatOpenAI({ useResponsesApi: true })` 自动走 `/v1/responses`，内部 `responses.create/parse` + `converters/responses.ts` 转回标准 AIMessage（tool_calls / usage_metadata / reasoning / parsed 齐全）——**业务层（invokeAi、tools、withStructuredOutput、流式、审计）零改动**。
- **防回归**：LangChain 2026-03 曾修 #10428（传 tools 时误路由到 `/v1/responses`、忽略 `useResponsesApi:false`）；1.5.7 已含修复，仍**显式写死** `useResponsesApi:false` 于 chat 路径以防上游回归。
- **现状 dead code**：`lib/llm/create-chat.ts` 的 DeepSeek thinking 特判（`modelKwargsFor`，按模型名判断）业务零调用点、仅单测覆盖——**删除**，落实零厂商特判。

### 2.5.2 已确认决策

| 决策项   | 结论                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| 协议建模 | `llm_model.protocol` 列（`'chat-completions' \| 'responses'`），model 级最细粒度，OFox 同 baseURL 可混用     |
| 默认值   | **`'chat-completions'`**（最大兼容，换到仅支持 chat 的平台不炸；OFox 模型显式改 responses）                  |
| 分支实现 | `createChatModel` 按 `resolved.protocol`：chat → `useResponsesApi:false`；responses → `useResponsesApi:true` |
| 厂商特判 | **删除** DeepSeek thinking 特判（死代码）；思考模式一律走配置层（`max_tokens`≥2048），代码零模型判断         |
| 前端     | 本期不做 protocol 下拉，DB/脚本配置即可；随阶段 4 一起加 UI                                                  |
| 不做     | Anthropic/Gemini 协议；自动协议探测/降级（显式可预期，零魔法）                                               |

### 2.5.3 改动清单

| 层      | 改动                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB      | `llm_model.protocol` 列（default `'chat-completions'`）+ drizzle 迁移                                                                                        |
| 共享    | `packages/shared/src/api/llm-config.ts`：`llmModelSchema` / `createLlmModelBodySchema` 加 `protocol`（optional，`z.enum(['chat-completions','responses'])`） |
| Backend | `resolve.ts`：`ResolvedLlm` 加 `protocol`；`create-chat.ts`：按协议分支 + 删特判；`llm-config/service.ts`：透传 `protocol` 落库                              |
| 测试    | `create-chat.spec.ts`：删 thinking 用例，加 protocol 分支断言（`useResponsesApi` 值）；阶段 0 冒烟补 responses 模式（tools + 结构化输出 + 流式）             |

**影响面**：`modules/ai/service.ts`（invokeAi）零改动，metadata-enrich 自动受益，协议与元数据管线解耦。

---

## 3. 方案总览（三步管线）

```
content-parse（现有 job）
  └→ 解析 EPUB → parts/cover/images + originMeta.parsed（原始元数据快照，含 subjects/sourceRaw）
     → 成功（status='draft'）后 enqueue
metadata-fill（新增 job：原数据填充/规则层）
  └→ cleanDescription 写 description、subjects→tag 关联、dc:source→source 关联、language
     （provenance=extracted，沿用 hasParsedBefore 语义；幂等：重试先删 extracted 再插）
     → 无论成败均 enqueue metadata-enrich（失败只写 originMeta.lastError，AI 兜底）
metadata-enrich（新增 job：AI 回填）
  └→ 短路检查 → 原子 claim → invokeAi(tools + withStructuredOutput functionCalling)
     → 只填空/弱字段（provenance=ai）→ 状态终态 + metadataProvenance 更新
```

**时序保证**：job 依赖链串行（content-parse 成功 → metadata-fill → metadata-enrich），规则层永不晚于 AI 层；**metadata-fill 失败不阻断 enrich**（评审确认）。

**enqueue 位置**：放 job 层（`jobs/content-parse.ts` → `jobs/work-metadata-fill.ts` → `jobs/metadata-enrich.ts`），与 worker switch-case 注册一致；测试直接调 service 层不触发链路（见 §8 适配）。

**范围**：metadata-fill/enrich 仅 `admin_epub`（`admin_text` 是内部 dev/test 源，不参与）。

---

## 4. 阶段 1：规则层增强（修复简介为空，独立交付）

### 4.1 改动清单

| 文件                                                 | 改动                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/epub-ingest/epub.ts`       | 新增 `textOfDeep(value)`：递归遍历 fast-xml-parser 对象树拼接文本（string / `#text` / 嵌套对象，跳过 `@_*` 属性键）                                                                                                                       |
| 同上                                                 | 新增 `metadataByLocalName(metadata, name)`：大小写不敏感 + 去命名空间前缀匹配（覆盖 `dc:description`/`dcterms:description`/`description`/大写变体）；数组取第一个。应用于 description / title / creator / language / subject / **source** |
| 同上                                                 | 新增 subjects 提取（`dc:subject` 宽容匹配 + 数组展开）、sourceRaw 提取（`dc:source`）                                                                                                                                                     |
| `apps/backend/src/modules/epub-ingest/metadata.ts`   | 新增 `cleanDescription()`（对齐 TextStack StripHtml：正则去标签 → HTML 实体解码 → 空白压缩 → trim）                                                                                                                                       |
| `apps/backend/src/modules/content-parser/types.ts`   | `ParsedContentMetadata` 增加 `subjects: string[]`、`sourceRaw: string`                                                                                                                                                                    |
| `apps/backend/src/modules/epub-ingest/parser.ts`     | 组装新字段                                                                                                                                                                                                                                |
| `apps/backend/src/modules/content-parser/service.ts` | content-parse 收敛：`originMeta.parsed` 快照增加 subjects/sourceRaw（保留原始值供审计）                                                                                                                                                   |

### 4.2 测试

- 单测：`textOfDeep`（子元素/嵌套/CDATA/数组/顺序）、`metadataByLocalName`（前缀/大小写变体）、`cleanDescription`
- `epub-builder.ts` 增加构造参数：`<p>` 子元素 description、多个 description、`dcterms:` 前缀、subjects、dc:source
- 回归：`epub-gutenberg.spec.ts`（fixture 无 dc:description → 行为不变）

---

## 5. 阶段 2：共享维度建模 + metadata-fill

### 5.1 表结构（`packages/db/src/schema.ts`）

```sql
tag                 (id, name UNIQUE, normalized UNIQUE, created_at, updated_at)
category            (id, name UNIQUE, normalized UNIQUE, created_at, updated_at)
source              (id, name UNIQUE, match_rule, created_at, updated_at)   -- match_rule: 域名/关键词（dc:source 匹配用）
reading_work_tag      (work_id FK CASCADE, tag_id FK CASCADE, provenance TEXT 默认 'extracted', UNIQUE(work_id, tag_id))
reading_work_category (work_id FK CASCADE, category_id FK CASCADE, provenance, UNIQUE(work_id, category_id))
reading_work_source   (work_id FK CASCADE, source_id FK CASCADE, provenance, UNIQUE(work_id, source_id))
-- provenance: 'extracted' | 'ai' | 'manual'（对齐 TextStack SeoSource 思路）
```

`reading_work` 新增：`metadataEnrichmentStatus`（pending/running/completed/failed/skipped）、`metadataEnrichmentAt`、`metadataProvenance` jsonb（`{description, tags, category}` → 来源标注快照，供展示"AI 来源填充"）。

- `metadataProvenance` 语义（评审确认）：**jsonb = 展示快照，关联表 provenance 是事实源**；各写方（fill/enrich/updateWork）事务内同步
- 存量行初始值（评审确认）：迁移时存量 work 的 `metadataEnrichmentStatus='skipped'`（不批量回填烧钱；阶段 4 管理端提供手动触发）

### 5.2 迁移

- drizzle-kit generate 产出 DDL + **手写数据迁移**（同迁移文件）：`reading_work.tags` jsonb → `reading_work_tag`（provenance='manual'，手填数据）；**catgory 16 类 seed** 亦在此手写迁移写入（清单见附录 A）
- **兼容策略（已确认）**：`tags` jsonb 列**保留**，写路径双写（关联表 + jsonb **合并视图**），读路径维持 jsonb → 前端零改动、catalog 查询零改动；阶段 4 前端改造后删列

### 5.3 服务层改动

| 文件                                        | 改动                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `works/service.ts` `updateWork`（:472-494） | tags/sources 写关联表（**drizzle 事务**：upsert tag 行 + **只删 manual 关联再插** + 同步 jsonb 合并视图，provenance='manual'）；新增 `sources: string[]` 手填来源（manual）；extracted/ai 关联永不删                                               |
| `works/service.ts` `toAdminWork`            | 增加 sources 读取（单 work JOIN `reading_work_source`，无 N+1）；category 阶段 3 加                                                                                                                                                                |
| `works/service.ts` `insertEpubWorkAndAsset` | 初始 tags 保持（列保留期）                                                                                                                                                                                                                         |
| `packages/shared/src/api/works.ts`          | `updateWorkBodySchema` 增加 `sources`（optional，兼容前端）；`adminWorkSchema` 增加 enrichment 状态 + provenance 字段（optional/nullable）                                                                                                         |
| 新增 `jobs/work-metadata-fill.ts`           | 规则落库（见 5.4）                                                                                                                                                                                                                                 |
| `worker.ts`                                 | 注册新 job；`lib/queue.ts` `enqueue` 扩展 `jobOptions?: { attempts, backoff }`                                                                                                                                                                     |
| `content-parser/service.ts`                 | 元数据落库块迁出至 metadata-fill：**仅迁 title/author/description/language 写入**；`status='draft'`、`coverAssetId`、`publishedAt`、`originMeta.parsed` 快照**保留在 content-parse**（评审确认，避免 status 转换职责漂移与跨 job 覆盖 originMeta） |

### 5.4 metadata-fill 规则落库语义

- `description = cleanDescription(parsed.description)`，沿用现有 `hasParsedBefore` 合并（首次填满，re-parse 保留手改只填空）
- subjects → upsert tag（normalized 去重）→ reading_work_tag（provenance='extracted'）
- dc:source → URL 提取域名 / 关键词 contains 匹配 `source.match_rule` → reading_work_source（extracted）；未命中留空（交用户手填）
- **幂等**：重试时**只删 extracted 关联**再插（对齐 `clearDerivedAssets` 模式）；manual/ai 关联永不删
- **成功时零写 originMeta**（避免与 content-parse 覆盖；subjects/sourceRaw 原始值已存于 `originMeta.parsed` 快照供审计）
- **失败语义**：失败不置 work 为 failed（内容已就绪），只写 `originMeta.lastError` + 日志；**仍 enqueue metadata-enrich（AI 兜底）**；reparse 可重触发

---

## 6. 阶段 3：AI 回填（可扩展字段注册表 + LangChain 工具化）

### 6.1 架构

```
modules/metadata-enrich/
  fields.ts     → MetadataFieldId = 'description' | 'tags' | 'category' | 'source'
  registry.ts   → fieldRegistry: Record<MetadataFieldId, MetadataFieldDef>
  quality.ts    → 弱值判断 + 停用词表
  tools.ts      → list_existing_tags / list_categories（LangChain tool() 工厂）
  prompt.ts     → 精简 prompt 构建（只含单书上下文）
  service.ts    → EnrichWorkMetadata(workId) 编排（复用 invokeAi，无独立 agent 层）
```

```ts
type MetadataFieldDef = {
  id: MetadataFieldId;
  aiFillable: boolean; // source = false（本期不参与 AI）
  promptSection: string; // 精简指令，不含全局数据
  outputKey: string;
  schema: ZodType; // description ≤2000 / tags ≤6×40 / category 枚举白名单
  isWeak?(value): boolean; // 弱值：超短 / 泛词 / 全大写
  normalize(value): unknown; // trim / 去重 / 停用词过滤 / 句子边界截断
  apply(work, value, provenance): Promise<void>; // 落库 + tag 复用 + 事务
};
```

**可扩展性**：加新字段（如 publishedYear）= 注册新 `MetadataFieldDef`（prompt 片段 + schema + apply），编排零改动。

### 6.2 编排语义（service.ts）

1. 读 work + 第一章 excerpt + 各字段现状 → 计算 `neededFields`（`aiFillable=true` 的**空字段 + 弱值字段**；provenance 优先级 manual > ai > extracted，弱值 extracted 可进回填范围）
2. 全空/无 needed → 状态 completed 短路（零费用）
3. 原子 claim：`ExecuteUpdate` Pending→Running（对齐 TextStack `UserBookEnrichmentService.cs:27-33`，防重复扣费）
4. **`invokeAi` 一次调用**：`{ purpose:'metadata-enrich', tools, outputSchema: metadataOutputSchema, source:'metadata-enrich.fill', ref }`——tools 按需查询全局标签/分类 + `withStructuredOutput({ method:'functionCalling' })` 结构化输出（评审确认：复用 invokeAi，审计/token/503 降级内置）
5. 逐字段校验 / 规范化 / **事务落库**（invokeAi 在事务外，先调用后写库）
6. 更新 `metadataEnrichmentStatus=completed` + `metadataProvenance`（快照）

### 6.3 Tools 设计（防上下文膨胀核心）

| Tool                                     | 作用                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `list_existing_tags({ query?, limit? })` | 无 query 返回高频 top-N（按关联数），有 query 返回匹配项（normalized/名称/次数）——**全局标签表永不进 prompt** |
| `list_categories()`                      | 返回 category 表全量枚举（管理端可控规模）                                                                    |

**prompt 只含单书上下文**（固定量）：标题/作者/语言/已有 tags/规则层简介/第一章 excerpt（wordCount≥100 跳过 front matter，≤2500 字符）/目录前 15 标题。

### 6.4 复用优先三层防线

1. **Prompt 引导**："Prefer reusing existing tags from `list_existing_tags`; only create a new tag if none accurately describes the work."；分类必须来自 `list_categories`
2. **规范化**：统一 `normalized`（小写+去标点+去空格）→ 停用词过滤 → ≤6 项
3. **DB 唯一约束**：`tag.normalized` unique，upsert 命中已有行即复用——AI 造词物理上无法重复建标签

已知边界：不做 fuzzy 语义匹配（"Sci-Fi" vs "Science Fiction"），管理端合并功能兜底（阶段 4）。

### 6.5 内容质量约束（三层保障）

| 维度     | 机制                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| 真实贴合 | 上下文=单书数据；指令：只基于提供内容、不足留空不猜、禁止剧透                                                              |
| 有意义   | 分类枚举选择；标签名词短语+停用词过滤+复用已有；简介 2-3 句、书籍语言输出                                                  |
| 长度限制 | 输入截断（excerpt 2500/目录 15）；输出校验（description ≤2000、tags ≤6×40、category 枚举），与 `updateWorkBodySchema` 对齐 |

### 6.6 审计与监控（用户要求）

- `invokeAi` 自动记 `ai_invocation_log`：`source: 'metadata-enrich.fill'` + `ref: {type:'reading_work', id}` + purpose（新注册 `metadata-enrich` → `llm_app_setting` key `metadata-enrich.default_model_id`，白名单加入 `AI_SETTING_KEY_VALUES`）
- 每字段 provenance（extracted/ai/manual）+ `metadataProvenance` jsonb → admin API 返回 → 页面展示"AI 来源填充"徽标（阶段 4 UI）
- 模型未配置时（503）→ 状态置 `skipped` 静默降级，不阻塞主流程

### 6.7 重试与 re-parse

- `enqueue` 扩展 jobOptions，metadata-enrich `attempts: 2`
- **重试语义（评审确认，at-least-once）**：job catch 中 Running→Pending 恢复；AI 调用后崩溃、重试最多重复调用一次（attempts:2 封顶）；`neededFields` 只算空+弱值，已落库字段重试时自动跳过——天然幂等，无需额外去重机制
- re-parse → 重置 enrichmentStatus=pending → AI 只填空/弱字段（provenance=ai 不覆盖）→ 已全则短路，不会重复扣费

### 6.8 模型配置注意（OFox + qwen3.7-plus）

- `llm_model.max_tokens` ≥ 2048（思考模式吃 completion tokens；Responses 下 LangChain 自动映射为 `max_output_tokens`）
- **零厂商特判**：metadata-enrich 不传 `thinking` 选项、不做任何模型名判断；DeepSeek thinking 特判已整体删除（§2.5）
- 协议：模型级 `llm_model.protocol` 配置（`chat-completions` / `responses`），由 `createChatModel` 分支，**代码零模型判断**（§2.5）；json_schema 原生路径**放弃**，结构化输出统一 `withStructuredOutput({ method: 'functionCalling' })`

---

## 7. 阶段 4（后续，本期不做）

- 前端管理页：编辑页用自动填充数据、分类/来源管理 CRUD UI、provenance/AI 徽标、发现页分类过滤
- 读路径切关联表（catalog JOIN 改造 + N+1 规避批量聚合）
- 删除 `reading_work.tags` jsonb 列

---

## 8. 测试计划

### 阶段 1

- `textOfDeep` / `metadataByLocalName` / `cleanDescription` 单测（含全部变体 case）
- epub-builder 新构造参数 + Gutenberg 回归

### 阶段 2

- 上传 → tags/source 关联落库断言（extracted）
- updateWork tags/sources 写关联表（manual）+ jsonb 双写一致性
- metadata-fill 幂等（重试不重复、manual/ai 不删）
- catalog 过滤回归（读 jsonb 不变）

### 阶段 3

- tools 单测：list_existing_tags 查询/过滤/limit、list_categories
- prompt 断言：不含全局标签列表（防膨胀回归）
- apply 复用已有 tag（upsert 冲突命中已有行）
- 弱值/停用词单测
- mock invokeAi：填充 / 短路 / 原子 claim / 只填空字段 / provenance 更新
- 状态流转：pending→running→completed/failed/skipped；崩溃重试 Running→Pending 恢复
- 手填 sources 接口测试

### LLM 协议兼容（§2.5）

- `create-chat.spec.ts`：protocol 分支断言（chat → `useResponsesApi:false`；responses → `useResponsesApi:true`）；删 DeepSeek thinking 用例
- 阶段 0 冒烟（OFox）：responses 模式下 `invokeAi` tools + `withStructuredOutput(functionCalling)` + 流式实测

### 适配

- `epub-ingest.spec.ts:118-121` 元数据断言 → 改为 content-parse + metadata-fill 两步后断言

---

## 9. 风险与对策（审查记录）

| #   | 风险                                                 | 对策                                                                                                              |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| R1  | tools + outputSchema 组合在本仓库无实测先例          | **复用 invokeAi**（已实现 tools 循环 + `withStructuredOutput`，`ai/service.ts:198-237`）；阶段 0 冒烟锁定组合行为 |
| R2  | `toWork` tags 读点是 N+1 风险区                      | 兼容期写双写+读 jsonb，读路径零改动；阶段 4 一次性切关联表                                                        |
| R3  | `enqueue` 不支持 per-job 重试                        | 扩展 `enqueue(name, data, jobOptions)`                                                                            |
| R4  | metadata-fill 失败语义未定义                         | 不置 failed，写 originMeta.lastError + **仍 enqueue enrich（AI 兜底）** + 支持重触发                              |
| R5  | 模型未配置时 job 崩                                  | 捕获 → 状态 skipped 静默降级                                                                                      |
| R6  | 思考模式吃 token 截断输出                            | max_tokens ≥2048（配置层）                                                                                        |
| R7  | 弱值简介留存                                         | isWeak() 判定，弱值进入 AI 回填范围（provenance=ai，不覆盖 manual）                                               |
| R8  | excerpt 取到 front matter                            | wordCount≥100 阈值跳过封面/版权/目录                                                                              |
| R9  | 302.AI / OFox 大陆直连                               | 服务器海外部署直连 OFox（已确认部署在国外 VPS）；国内官方平台为备选 provider                                      |
| R10 | chat 路径被上游误路由到 `/v1/responses`（#10428 类） | chat 路径显式 `useResponsesApi:false`（§2.5）；responses 仅显式配置启用                                           |
| R11 | 换平台后协议不匹配 404                               | 协议全配置化（`llm_model.protocol`）；阶段 0 冒烟覆盖双协议                                                       |

---

## 10. 执行顺序

```
阶段 0   LLM 协议兼容改造（§2.5）+ OFox 冒烟：protocol 列 + createChatModel 分支 + 删特判
         → 冒烟验证双协议（chat / responses：tools + 结构化输出 + 流式）→ 可独立交付
阶段 1   规则层增强（修复简介为空，独立可交付）
阶段 2   共享维度建模 + metadata-fill
阶段 3   AI 回填（字段注册表 + 复用 invokeAi + functionCalling 结构化输出）
阶段 4   前端 + 删 jsonb 列（后续）
```

**依赖**：阶段 0 → 1 → 2 → 3 递进，每阶段可独立验证；阶段 0（协议改造）为后续 AI 阶段的通用前置，可并行于 1。

---

## 附录 A：TextStack 对齐 16 类分类枚举（seed）

> 默认清单（占位，实施后可按 TextStack 平台实际枚举校正；写入 §5.2 手写数据迁移）：

`Fiction`, `Non-Fiction`, `Science`, `Fantasy`, `Science Fiction`, `Mystery`, `Thriller`, `Romance`, `History`, `Biography`, `Self-Help`, `Business`, `Technology`, `Philosophy`, `Poetry`, `Classic`
