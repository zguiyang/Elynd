'use client';

import { ChevronDown, Plus } from 'lucide-react';

import type { LlmModel, LlmProvider } from '@gloaming/shared/api/llm-config';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type ProviderTestResult = {
  providerId: string;
  ok: boolean;
  message: string;
};

function formatProxyHost(proxyUrl: string): string {
  try {
    return new URL(proxyUrl).host;
  } catch {
    return proxyUrl;
  }
}

type AiProviderListProps = {
  providers: LlmProvider[];
  models: LlmModel[];
  expandedIds: Set<string>;
  testingProviderId: string | null;
  testResult: ProviderTestResult | null;
  onToggleExpand: (providerId: string) => void;
  onAddProvider: () => void;
  onEditProvider: (provider: LlmProvider) => void;
  onDeleteProvider: (provider: LlmProvider) => void;
  onTestProvider: (provider: LlmProvider) => void;
  onAddModel: (provider: LlmProvider) => void;
  onEditModel: (model: LlmModel) => void;
  onDeleteModel: (model: LlmModel) => void;
};

export function AiProviderList({
  providers,
  models,
  expandedIds,
  testingProviderId,
  testResult,
  onToggleExpand,
  onAddProvider,
  onEditProvider,
  onDeleteProvider,
  onTestProvider,
  onAddModel,
  onEditModel,
  onDeleteModel,
}: AiProviderListProps) {
  if (providers.length === 0) {
    return (
      <Empty className="rounded-2xl border border-dashed border-border bg-card py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Plus />
          </EmptyMedia>
          <EmptyTitle>还没有服务商</EmptyTitle>
          <EmptyDescription>添加第一个 OpenAI 兼容服务商，再挂载可用模型。</EmptyDescription>
        </EmptyHeader>
        <Button className="mt-2 h-10 rounded-xl px-6 hover:bg-brand-deep" onClick={onAddProvider}>
          添加服务商
        </Button>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {providers.map((provider) => {
          const isExpanded = expandedIds.has(provider.id);
          const providerModels = models
            .filter((model) => model.providerId === provider.id)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
          const resultForRow = testResult?.providerId === provider.id ? testResult : null;

          return (
            <li key={provider.id}>
              <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-start md:justify-between">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  onClick={() => onToggleExpand(provider.id)}
                  aria-expanded={isExpanded}
                >
                  <ChevronDown
                    className={cn(
                      'mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      isExpanded ? 'rotate-0' : '-rotate-90',
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{provider.name}</p>
                      <Badge variant={provider.isEnabled ? 'secondary' : 'outline'}>
                        {provider.isEnabled ? '已启用' : '已停用'}
                      </Badge>
                      <Badge variant="outline">{providerModels.length} 个模型</Badge>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{provider.baseUrl}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {provider.apiKeySet ? `API Key ${provider.apiKeyMasked ?? '已设置'}` : '尚未设置 API Key'}
                      </p>
                      {provider.proxyUrl ? (
                        <Badge variant="outline" className="text-xs">
                          经代理出站 · {formatProxyHost(provider.proxyUrl)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2 pl-7 md:pl-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={testingProviderId === provider.id || !provider.apiKeySet}
                    onClick={() => onTestProvider(provider)}
                  >
                    {testingProviderId === provider.id ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        测试中
                      </>
                    ) : (
                      '测试'
                    )}
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onEditProvider(provider)}>
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => onDeleteProvider(provider)}
                  >
                    删除
                  </Button>
                </div>
              </div>

              {resultForRow ? (
                <div
                  className={cn(
                    'mx-5 mb-4 rounded-xl border px-3 py-2 text-sm md:ml-12',
                    resultForRow.ok
                      ? 'border-border bg-accent/60 text-accent-foreground'
                      : 'border-destructive/30 bg-destructive/5 text-destructive',
                  )}
                >
                  {resultForRow.message}
                </div>
              ) : null}

              {isExpanded ? (
                <div className="border-t border-border/70 bg-surface-container-low px-5 py-4 md:pl-12">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">模型</p>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onAddModel(provider)}>
                      <Plus data-icon="inline-start" />
                      添加模型
                    </Button>
                  </div>

                  {providerModels.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">该服务商下还没有模型。</p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                      <Table className="min-w-[36rem]">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-10 bg-surface-container-low px-4">显示名</TableHead>
                            <TableHead className="h-10 bg-surface-container-low px-4">Model ID</TableHead>
                            <TableHead className="h-10 bg-surface-container-low px-4">温度</TableHead>
                            <TableHead className="h-10 bg-surface-container-low px-4">Max tokens</TableHead>
                            <TableHead className="h-10 bg-surface-container-low px-4">状态</TableHead>
                            <TableHead className="h-10 bg-surface-container-low px-4">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {providerModels.map((model) => (
                            <TableRow key={model.id} className="border-border">
                              <TableCell className="px-4 py-3 font-medium">{model.label}</TableCell>
                              <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {model.modelId}
                              </TableCell>
                              <TableCell className="px-4 py-3 tabular-nums text-muted-foreground">
                                {model.temperature ?? '-'}
                              </TableCell>
                              <TableCell className="px-4 py-3 tabular-nums text-muted-foreground">
                                {model.maxTokens ?? '-'}
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <Badge variant={model.isEnabled ? 'secondary' : 'outline'}>
                                  {model.isEnabled ? '启用' : '停用'}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => onEditModel(model)}
                                  >
                                    编辑
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => onDeleteModel(model)}
                                  >
                                    删除
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
