'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, BookOpenIcon } from 'lucide-react';
import Link from 'next/link';

import type { ArticleLevel } from '@elynd/shared/api/articles';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { ArticlesRequestError } from '@/features/articles-http';
import { formatLibraryApiError, getPublishedArticle, libraryArticlesQueryKey } from '@/features/library/articles-api';
import { LEVEL_LABEL, paragraphsFromBody } from '@/features/library/library-model';

type ArticleReaderPageProps = {
  articleId: string;
};

export function ArticleReaderPage({ articleId }: ArticleReaderPageProps) {
  const detailQuery = useQuery({
    queryKey: libraryArticlesQueryKey.detail(articleId),
    queryFn: ({ signal }) => getPublishedArticle(articleId, { signal }),
  });

  const article = detailQuery.data;
  const isNotFound = detailQuery.error instanceof ArticlesRequestError && detailQuery.error.status === 404;

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-6xl">
      <Button
        nativeButton={false}
        variant="ghost"
        className="mb-6 h-10 gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground"
        render={<Link href={AUTH_ROUTES.library} />}
      >
        <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
        返回图书馆
      </Button>

      {detailQuery.isPending ? (
        <p className="text-sm text-muted-foreground">正在打开这册书…</p>
      ) : isNotFound ? (
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>找不到这册书</EmptyTitle>
            <EmptyDescription>它可能已下架，或链接不正确。回图书馆再挑一册吧。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : detailQuery.isError ? (
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>暂时打不开</EmptyTitle>
            <EmptyDescription>{formatLibraryApiError(detailQuery.error)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : article ? (
        <ReaderArticle
          title={article.title}
          body={article.body}
          level={article.level}
          themes={article.themes}
          estimatedMinutes={article.estimatedMinutes}
        />
      ) : null}
    </div>
  );
}

function ReaderArticle({
  title,
  body,
  level,
  themes,
  estimatedMinutes,
}: {
  title: string;
  body: string;
  level: ArticleLevel;
  themes: string[];
  estimatedMinutes: number | null;
}) {
  const paragraphs = paragraphsFromBody(body);
  const levelLabel = LEVEL_LABEL[level];
  const metaParts = [
    levelLabel,
    themes.length > 0 ? themes.join(' · ') : null,
    estimatedMinutes != null ? `约 ${estimatedMinutes} 分钟` : null,
  ].filter(Boolean);

  return (
    <Card className="mx-auto max-w-[42rem] gap-0 rounded-3xl border border-border bg-card py-0 shadow-none ring-0">
      <CardHeader className="gap-3 px-6 pt-9 pb-0 md:px-10 md:pt-11">
        {metaParts.length > 0 ? <p className="text-sm tracking-wide text-brand-deep">{metaParts.join(' · ')}</p> : null}
        <CardTitle className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pt-8 pb-9 md:px-10 md:pb-11">
        {paragraphs.length > 0 ? (
          <div className="flex max-w-[65ch] flex-col gap-5 text-base leading-relaxed text-foreground">
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <Empty className="border-0 p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenIcon />
              </EmptyMedia>
              <EmptyTitle>这册还没有正文</EmptyTitle>
              <EmptyDescription>请稍后再试，或回图书馆挑选其他短文。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
