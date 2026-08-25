# 竞品调研备忘：电子书解析 + 音频生成

> **备忘用途：** 后续功能讨论（EPUB 解析管线、音频生成管线）的输入源。**本备忘记录过的东西不再重复调研**——新调研只做增量（新增竞品 / 新增格式 / 新方向）。
>
> **调研日期：** 2026-08-25
>
> **调研范围：** 三个已体验竞品（textstack、readest、openkoto）源码 + 同方向开源工具扩展搜索。方向：① 电子书上传后的解析/清洗/分章；② 音频生成（TTS / 有声书）。
>
> **仓库快照：** 源码 clone 在临时目录（一次性阅读），以下为结论记录；原文可随时重新 `gh repo clone`。

---

## 1. 竞品清单

| 竞品                 | 仓库                  | 形态                               | 与 Gloaming 的关系                                                     |
| -------------------- | --------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| textstack            | `mrviduus/textstack`  | ASP.NET Core + React（26★）        | 最接近：英语阅读 + 生词解释 + SRS + 离线；EPUB/PDF/FB2；有播客音频生成 |
| readest              | `readest/readest`     | Rust(Tauri) + foliate-js（23.7k★） | 阅读器标杆：EPUB 解析性能、TTS 分段与虚拟时间线                        |
| openkoto (TextLingo) | `hikariming/openkoto` | Tauri 桌面 + iOS（431★）           | AI 外语阅读学习；分段算法、导入性能哲学                                |

扩展搜索到的同方向工具（未逐行读，仅确认方向）：

| 项目                       | 语言                  | 要点                                                                                                                                  |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `BradleyFallon/SimpleBook` | Python (ebooklib)     | 确定性 no-LLM EPUB 归一化：container→OPF→TOC→spine→章节推断→chunk；章节判定启发式（chapter/book/part/罗马数字 + front matter 黑名单） |
| `buchwandler/epub2text`    | Python (ebooklib+BS4) | 智能清洗：去 `[1]` 脚注、去页码、空白归一化；导航优先（NAV→NCX）                                                                      |
| `henacodes/epubix`         | TypeScript            | 轻量 EPUB2/3 解析，href/锚点解析健壮（`./`、`../`、percent-encoding）                                                                 |
| `NellowTCS/lexepub`        | Rust                  | 流式逐章解析、内存高效、WASM                                                                                                          |
| `zhangwfjh/epub-parser`    | Rust (zip+quick-xml)  | 元数据/TOC/文本/封面提取                                                                                                              |

---

## 2. 核心结论（竞品"上传后解析为什么快"）

**答案：全程不经 LLM，纯确定性解析，毫秒级/章。** 所有调研对象无一例外：EPUB 解析 = zip 解压 → `container.xml` → OPF 定位 → spine/NCX/nav 解析 → XHTML 提文本 → 规则清洗 → 规则分章。LLM 只出现在边角场景：

- textstack：播客剧本生成（800 词 excerpt）
- openkoto：网页导入的**行级清洗**（LLM 只删行不改写）、PDF 无文本层时 OCR
- 结论：**我们也不该用 LLM 做解析/清洗主流程**；LLM 最多做"清洗辅助"，且必须不改写原文

三个工程手段让它"感觉快"：

1. **上传即时返回**：存文件 + 建 job 就响应，解析放后台（textstack：数据库表即队列 + 5s 轮询 worker，一次一个 job，stuck 10min 重拾）
2. **惰性加载**：readest 打开书只解析 OPF/nav/ncx 三个小 XML，章节正文运行时才解压（打开 1.5s→0.3s）；openkoto 桌面端导入**只复制文件**，正文解析推迟到首次打开章节（"50 万字小说约 1.5 万句，导入时全切会卡死主线程也撑爆内存"）
3. **成本分层**：EPUB 纯规则；PDF 无文本层才 OCR；用户 PDF 的 RAG 才上 vision-LLM

---

## 3. textstack（最接近我们的竞品）

### 3.1 解析管线

```
POST /admin/books/upload → 校验(扩展名白名单/大小) → 存文件 + SHA256 + IngestionJob(Queued) → 立即返回 jobId
  → [后台] IngestionWorker（BackgroundService，5s 轮询，一次一个，DB 表即队列）
  → ExtractorRegistry 按扩展名分发 (.epub/.pdf/.html)
  → EpubTextExtractor.ExtractAsync → IngestionService.ProcessParsedBookAsync（存 Chapter 行 + 质量分）
  → 同 job 内：图片优化 / cover / 搜索索引 / RAG chunk / Lint（17 条规则）
```

- **库：** `VersOne.Epub`（一行 `EpubReader.ReadBookAsync` 完成解压+OPF/NCX/NAV/spine）+ `HtmlAgilityPack`（清洗）
- **元数据：** `dc:language` "en-US" → ISO 639-1 "en"（`ExtractLanguage`）
- **标题映射：** NCX/NAV 递归 → 文件路径 → 标题字典（`BuildNavigationTitleMap`）
- **文本后处理：** 9 个 Processor（软连字符、HTML 实体、断词、空白、拼写、空标签、盗版水印、语义、排版）

### 3.2 清洗逻辑（HtmlCleaner.cs）

- 安全清洗：删 `iframe/object/embed/base/form/link/meta/noscript/frame/applet`；删全部 `on*` 事件属性；URL 属性按 scheme 白名单拒绝（`javascript:/vbscript:/file:/blob:/data:text/html`），`data:image/*` 放行
- 正文识别：直接取 `//body`；NFC 归一化；修 `<title/>` 自闭合陷阱
- 去版权页/目录页/书名页标题：`skipPatterns`（"novel by", "the end", "copyright", "table of contents", "about the author", "acknowledgment"...）
- 盗版水印：整章命中水印模式则跳过，留 warning
- Front matter 识别：短章节（<3000 字符）命中关键词 → 标题标记为 Copyright/Contents/Acknowledgments/About the Author/Afterword/Appendix

### 3.3 分章逻辑（做得最细）

1. 单文件 EPUB：按 h2/h3 分割（`SplitSingleFileByHeadings`）；标题须匹配 `chapter|part|book|section|глава|часть` 等正则 / 罗马数字 / 数字词 ONE..TWENTY；过滤 >100 字符标题
2. 多文件：spine 文件天然一章；标题降级链 `GetChapterTitle`：NCX/NAV → **可见 h1/h2/h3**（刻意不用 `<head><title>`，因为专业 EPUB 每个文件 title 都是书名）→ front matter 类型 → `"Section N"`
3. 无标题文件 → 合并进上一章
4. 纯数字标题 stub（如 `<h1>10</h1>`）→ 与本章 body 合并，保留 nav 标题

### 3.4 音频生成（Podcast，NotebookLM 式双主播）

```
POST /admin/podcasts → PodcastGenerationJob 表（DB 即队列，Queued/Running/Succeeded/Failed）
  → PodcastScriptBuilder：加载章节 PlainText → 截断 800 词 → LLM(gpt-4.1-nano) 写剧本
  → AudioAssembler：Edge TTS 逐行合成 mp3 段 → ffmpeg concat 拼接
  → 存 /storage/podcast-{lang}.mp3
```

- **TTS 引擎：Edge TTS 逆向 WebSocket**（`EdgeTtsClient.cs`，基于 rany2/edge-tts 逆向，零第三方依赖）：wss 连接 → `speech.config`（`wordBoundaryEnabled=true`）→ SSML（voice + prosody rate/pitch/volume）→ 收二进制音频 + `Path:audio.metadata` 文本帧 → 解析 **WordBoundary word timing**；伪造 `Sec-MS-GEC` 时间戳签名 + Chromium UA
- **分段粒度 = 剧本行**；每行一个 TTS 调用一个 mp3 segment
- **拼接：ffmpeg concat demuxer 不重编码**：`-f concat -safe 0 -i list.txt -c copy`
- **缓存：磁盘 LRU**，key = SHA256(voice|rate|text) 前 16 hex，并发双检锁，TTL + MaxCacheSizeBytes 两遍清理；成对缓存 `.mp3` + `.ts.json`
- **实时 TTS 端点**（阅读器内逐句合成）：ETag 确定性哈希 + If-None-Match 304 + `immutable` 缓存头 + rate limiting 双桶

---

## 4. readest（TTS 最强 / 性能标杆）

### 4.1 架构分工

- **Rust 只做机械活**（`epub_parser.rs`）：partialMD5、container.xml → OPF 定位、封面定位/缩放（长边 ≤512px，Triangle 滤波比 Lanczos3 快 3-5x）、把 OPF/nav/NCX 字节 + 全条目尺寸表预取给 JS
- **全部语义解析归 foliate-js**（submodule，未初始化）：OPF 元数据、spine、TOC/CFI、章节正文——刻意不在 Rust 重实现，保证 CFI/缓存语义字节级一致
- `parse_epub_full`：一次 zip 打开返回 `{partial_md5, opf_path, opf_bytes, nav/ncx_bytes, sizes}`；`sizes` 走 zip 中央目录**零解压**取 uncompressedSize
- `locate_toc_sources`：quick-xml 流式单遍扫 OPF，O(OPF) <1ms
- `read_zip_entry`：percent-encoded 路径两遍查找（`My%20Chapter.xhtml`）；UTF-8 BOM 剥离 + UTF-16→UTF-8（旧 InDesign 导出）

### 4.2 性能三板斧

1. **spawn_blocking 线程池**：打开热路径 1.5-1.7s → ~0.3s（iOS）
2. **惰性解压**：zip.js 按需 inflate，运行时每节懒加载；in-flight 去重（`computeBookNav` 对同一 href 并发调用 loadText+createDocument，去重后一次 inflate 省 ~300-500ms）
3. **持久化缓存**：`nav.json`（版本化 `BOOK_NAV_VERSION=4`）、搜索索引 SQLite、TTS 音频缓存

- nav 构建并发上限 128（Tauri IPC/fd 池饱和导致 zip.js 流 ERRORED 的失败模式）
- 打开时若 nav.json 命中 → 纯内存回放

### 4.3 TTS（40+ 文件，约 9500 行）

四类音源：

| 引擎                 | 实现                                             | 说明                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge TTS（默认）** | `libs/edgeTTS.ts`（831 行）+ `providers/edge.ts` | 直连微软免费端点 `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`，伪造 Chrome/Edge UA + `TrustedClientToken: 6A5AA1D4...`；SSML 合成开 word boundary；wss 被墙时回退自建代理 `/api/tts/edge`（仅认证用户） |
| Web Speech API       | `WebSpeechClient.ts`                             | 浏览器/系统本地语音                                                                                                                                                                                                                      |
| 原生 TTS             | `NativeTTSClient.ts`                             | Tauri 插件 native-tts，Android 20 种引擎                                                                                                                                                                                                 |
| EPUB3 Media Overlays | `TTSController.ts`                               | 预录旁白，SMIL 精确时长                                                                                                                                                                                                                  |

**分段合成机制（核心 `TTSController.ts`，2028 行）：**

- 分段粒度：foliate-js `tts.js` + textWalker + `createTTSNodeFilter`；**CJK 用 sentence、西文用 word 粒度**
- 合成流程：paragraph 级 SSML → `parseSSMLMarks` 拆句 → 逐句 `speak()`（async generator 流式）；段落间隙/句间间隙/live rate 调整/preload 预合成
- **词级高亮**：Edge boundary 事件 + `wordHighlight.ts`
- **虚拟时间线（关键设计）**：`SectionTimeline.ts` **不拼接真实音频**——句子前缀和时长表即"整章音频"；时长三级：Media Overlay 精确值 > 缓存实测值 > `estimateSentenceSeconds` 按 voice 校准估计；scrubber/seek/媒体会话都基于它
- 离线：逐句音频缓存到 SQLite/OPFS，章节全部合成后打包成一个 pack 文件离线播放

### 4.4 阅读进度 / 文本供给

- 进度格式：**EPUB CFI**（foliate-js epubcfi.js）；`BookProgress` 含 location + sectionHref/label/pageinfo/fraction/index
- 翻页高频写内存 zustand store，防抖 1s+500ms 落盘，`visibilitychange`/`pagehide` 立即 flush（应对 Android WebView 后台被杀）
- AI RAG 文本：clone body → 删 `script/style/noscript/nav/header/footer` → textContent → chunk 500 字/块、50 字重叠、按句子边界切
- TTS 文本：**重放显示变换管线**（proofread/simplecc/标点等），保证 TTS 文档与屏幕显示逐字一致

---

## 5. openkoto / TextLingo（AI 外语阅读，与我们方向最近的竞品）

### 5.1 导入与解析

- **桌面端 EPUB 不解析正文**：`import_book_cmd` 只 `std::fs::copy` 文件到数据目录，content 放占位符 `"[EPUB 书籍] {title}"`，`segments: Vec::new()`（"书籍不预分段，由阅读器处理"）
- EPUB 渲染交给 **epubjs / react-reader**；文件经本地 warp HTTP 服务流式提供（支持 HTTP Range 分段请求）；进度/书签用 **EPUB CFI**
- 书籍的 AI 能力走**书签 + 选区**，而非整章切段
- **iOS 端是完整解析**：自研 ZIP（ZIPArchive + RawDeflate + CRC32）+ SAX（XMLParser）：container.xml → OPF → manifest/spine/toc；`EncryptionInspector` 检测 DRM（绝不静默变占位符）；XHTML 提取跳过 `script/style/head/svg/template`，块级元素产生 `\n`；对非良构野生 XHTML 先做实体/DOCTYPE 容错预处理，失败退手写扫描器

### 5.2 分段算法（确定性规则，可迁移）

`create_segments_from_content`：按 `\n` 切段落 → 每段 `split_into_sentences` → 每句一个 segment；段落首句 `is_new_paragraph = true`。

`split_into_sentences` 要点：逐字符迭代，句末符 `. 。 ？ ！ ? !`；句末符后紧跟闭引号/右括号并入本句；**缩写启发式**（句点后跟字母视为缩写，如 Mr./U.S.A）；无分隔符整段回退一句。iOS 端 1:1 移植，用 `segmentation_golden.json` 跨端对齐（含 CRLF 陷阱）。

**性能哲学（重要）**：导入不切句；切分推迟到首次打开章节，且不碰 UIKit/WebKit 可在后台线程跑（一章几十毫秒）。

### 5.3 网页清洗（LLM 辅助但只删不改）

`clean_web_content_cmd`：正文按行送 LLM 判定"是否正文"，**只删行、不改写原文**。性能参数：`WEB_CLEAN_PREVIEW_CHARS=120`（长行截断预览+标注真实长度）、`WEB_CLEAN_BATCH_CHARS=4000`/`BATCH_LINES=80`、`WEB_CLEAN_CONCURRENCY=3`；失败自动回滚原文。

### 5.4 音频

- **无 TTS 生成管线**（无整篇/整句预生成音频）
- iOS：`AVSpeechSynthesizer` 实时单句/单词发音；多音字纠音（日语假名、中文拼音→IPA、英语 IPA 注音属性）
- 音频方向是**输入**：本地音频 + srt 导入、ASR 转写（whisper 系，长视频 600s 分片 + 重叠去重）、KTV 字幕烧录

---

## 6. 对 Gloaming 的启示（后续方案讨论的输入）

### 6.1 EPUB 解析管线（MVP 1a admin 侧）

1. **不经 LLM**：zip 解压（jszip/yauzl）+ `container.xml` → OPF/spine/nav/ncx 解析（fast-xml-parser/xmldom）+ XHTML 提文本（cheerio）——无需重库
2. **清洗规则照抄 textstack**：安全标签/属性白名单、正文取 body、NFC 归一化、front matter 识别、skipPatterns、盗版水印跳过
3. **分章规则照抄 textstack**：spine 天然一章 → nav/NCX 标题映射 → 可见 h1/h2/h3（不用 head title）→ 无标题合并 → 数字 stub 合并；单文件 EPUB 按 h2/h3 分割
4. **队列**：BullMQ 已有 → 加 `epub-ingest` job；上传即返回（现状已满足），解析异步落 ReadingPart[]
5. **性能可选**：长书惰性解析（先解析章节结构，正文按需），参考 openkoto/readest

### 6.2 音频生成管线

已有资产：Azure TTS SDK（`lib/tts/azure.ts`，已有 word timing）+ ContentAsset（audio_us/audio_uk）+ BullMQ。候选路线：

- **A. readest 式虚拟时间线**：句子级分段 → 逐句合成（带 word timing）→ 不拼真实音频，时长表驱动播放——成本最低，天然支持逐词高亮，支持边听边读
- **B. textstack 式整本预生成**：批量合成 mp3 段 + ffmpeg `concat -c copy` 不重编码拼接——更像"有声书"，适合下载/离线
- 两者可共存：先 A（阅读器内），后 B（下载导出）
- **缓存**：磁盘 LRU（key=SHA256(voice|rate|text)）+ ETag 304（textstack 模式）
- **引擎选项**：Azure（已有，稳）为主；Edge TTS 免费端点（textstack/readest 都在用）可作低成本备选，但有被封风险

### 6.3 分段

句子分段可直接复用 openkoto 的确定性算法（句末符 + 缩写启发式 + 引号并入），作为 TTS/翻译/助读的统一文本边界。

---

## 7. 调研边界声明

- ✅ 已覆盖：EPUB 解析/清洗/分章（3 竞品 + 5 工具）、TTS 生成（textstack 播客、readest 完整管线、openkoto 无）、分段算法（openkoto）、导入性能设计
- ❌ 未覆盖（如后续需要再补）：PDF 解析细节、MOBI/AZW、EPUB3 Media Overlays SMIL 细节、ASR 转写细节、长文本 TTS 的上下文一致性（情绪/口音保持）、多音色角色分配
- 📌 本备忘内容作为后续讨论输入源；同方向不重复调研，只做增量
