import { test } from '@japa/runner'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { BookParserService } from '#services/book-parse/book_parser_service'
import { extractPlainTextFromHtml } from '#utils/book_text_normalizer'

const execFileAsync = promisify(execFile)

test.group('BookParserService.parseEpub', () => {
  test('parses metadata and chapters from a minimal epub file', async ({ assert }) => {
    const fixture = await createMinimalEpubFixture()
    const service = new BookParserService()

    try {
      const result = await service.parseEpub(fixture.epubPath)

      assert.equal(result.title, 'Test EPUB Title')
      assert.equal(result.author, 'Test Author')
      assert.equal(result.description, 'Test EPUB Description')
      assert.equal(result.chapters.length, 2)
      assert.equal(result.chapters[0].title, 'First Chapter')
      assert.isFalse(result.chapters[0].content.startsWith('First Chapter'))
      assert.isTrue(result.chapters[0].content.includes('Hello from chapter one'))
      assert.equal(result.chapters[1].title, 'Second Chapter')
      assert.isFalse(result.chapters[1].content.startsWith('Second Chapter'))
      assert.isTrue(result.wordCount > 0)
    } finally {
      await fixture.cleanup()
    }
  })

  test('cleans dangling epub html fragments from extracted chapter text', async ({ assert }) => {
    const rawFragment =
      'id="pgepubid00000">THE TALE OF\n\nPETER RABBIT\n\nBY\n\n<h2 class="no-break"'

    const text = extractPlainTextFromHtml(rawFragment)

    assert.notInclude(text, 'id="pgepubid00000"')
    assert.notInclude(text, '<h2 class="no-break"')
    assert.include(text, 'THE TALE OF')
    assert.include(text, 'PETER RABBIT')
  })
})

async function createMinimalEpubFixture() {
  const rootDir = await mkdtemp(join(tmpdir(), 'elynd-epub-'))
  const epubPath = join(rootDir, 'fixture.epub')
  const metaInfDir = join(rootDir, 'META-INF')
  const oebpsDir = join(rootDir, 'OEBPS')

  await mkdir(metaInfDir, { recursive: true })
  await mkdir(oebpsDir, { recursive: true })

  await writeFile(join(rootDir, 'mimetype'), 'application/epub+zip', 'utf8')
  await writeFile(
    join(metaInfDir, 'container.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    'utf8'
  )

  await writeFile(
    join(oebpsDir, 'content.opf'),
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test EPUB Title</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:description>Test EPUB Description</dc:description>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">urn:uuid:12345678-1234-1234-1234-1234567890ab</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="chap1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chap2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chap1"/>
    <itemref idref="chap2"/>
  </spine>
</package>`,
    'utf8'
  )

  await writeFile(
    join(oebpsDir, 'toc.ncx'),
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:12345678-1234-1234-1234-1234567890ab"/>
  </head>
  <docTitle><text>Test EPUB Title</text></docTitle>
  <navMap>
    <navPoint id="chap1" playOrder="1">
      <navLabel><text>First Chapter</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="chap2" playOrder="2">
      <navLabel><text>Second Chapter</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`,
    'utf8'
  )

  await writeFile(
    join(oebpsDir, 'chapter1.xhtml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>First Chapter</h1>
    <p>Hello from chapter one.</p>
  </body>
</html>`,
    'utf8'
  )

  await writeFile(
    join(oebpsDir, 'chapter2.xhtml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Second Chapter</h1>
    <p>Hello from chapter two.</p>
  </body>
</html>`,
    'utf8'
  )

  await execFileAsync('zip', ['-X0', epubPath, 'mimetype'], { cwd: rootDir })
  await execFileAsync('zip', ['-Xr9D', epubPath, 'META-INF', 'OEBPS'], { cwd: rootDir })

  return {
    epubPath,
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  }
}
