'use client';

import { ChevronDown, Plus, Wallet } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import type { LlmModel, LlmProvider, ProviderBalanceResult } from '@gloaming/shared/api/llm-config';
import type { LlmApiFamily } from '@gloaming/shared/llm/wire-registry';
import { getWireFamilyDefinition, listWireFamilies } from '@gloaming/shared/llm/wire-registry';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { AiModelForm, type ModelFormValues } from '@/features/admin/ai-model-form';
import { AiModelList } from '@/features/admin/ai-model-list';
import { AiProviderForm, type ProviderFormValues } from '@/features/admin/ai-provider-form';
import { cn } from '@/lib/utils';

export type ProviderTestResult = {
  providerId: string;
  ok: boolean;
  message: string;
};

type FamilyFilter = 'all' | LlmApiFamily;

type CreateWizard = { step: 'family' } | { step: 'form'; apiFamily: LlmApiFamily };

type ModelFormState = {
  providerId: string;
  mode: 'create' | 'edit';
  model?: LlmModel;
};

type AiProviderWorkspaceProps = {
  providers: LlmProvider[];
  models: LlmModel[];
  onCreateProvider: (apiFamily: LlmApiFamily, values: ProviderFormValues) => Promise<LlmProvider>;
  onUpdateProvider: (provider: LlmProvider, values: ProviderFormValues) => Promise<void>;
  onDeleteProvider: (provider: LlmProvider) => void;
  onCreateModel: (provider: LlmProvider, values: ModelFormValues) => Promise<void>;
  onUpdateModel: (model: LlmModel, values: ModelFormValues) => Promise<void>;
  onDeleteModel: (model: LlmModel) => void;
  onTestProvider: (provider: LlmProvider) => void;
  onQueryBalance: (provider: LlmProvider) => void;
  testingProviderId: string | null;
  testResult: ProviderTestResult | null;
  balanceByProvider: Record<string, ProviderBalanceResult>;
  queryingBalanceId: string | null;
  isProviderSaving?: boolean;
  isModelSaving?: boolean;
};

function formatBalance(result: ProviderBalanceResult): string {
  if (!result.supported) {
    return '';
  }
  const amount = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(result.balance);
  return `${result.currency} ${amount}`;
}

function formatBaseUrlHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

export function AiProviderWorkspace({
  providers,
  models,
  onCreateProvider,
  onUpdateProvider,
  onDeleteProvider,
  onCreateModel,
  onUpdateModel,
  onDeleteModel,
  onTestProvider,
  onQueryBalance,
  testingProviderId,
  testResult,
  balanceByProvider,
  queryingBalanceId,
  isProviderSaving,
  isModelSaving,
}: AiProviderWorkspaceProps) {
  const providerFormId = useId();
  const modelFormId = useId();
  const families = listWireFamilies();

  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [createWizard, setCreateWizard] = useState<CreateWizard | null>(null);
  const [modelForm, setModelForm] = useState<ModelFormState | null>(null);

  const filteredProviders = useMemo(() => {
    if (familyFilter === 'all') {
      return providers;
    }
    return providers.filter((provider) => provider.apiFamily === familyFilter);
  }, [providers, familyFilter]);

  function toggleExpanded(providerId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
        setModelForm((current) => (current?.providerId === providerId ? null : current));
      } else {
        next.add(providerId);
      }
      return next;
    });
  }

  function startCreate() {
    setCreateWizard({ step: 'family' });
    setModelForm(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={familyFilter === 'all' ? 'secondary' : 'outline'}
            className="rounded-xl"
            onClick={() => setFamilyFilter('all')}
          >
            全部
          </Button>
          {families.map((family) => (
            <Button
              key={family.id}
              type="button"
              size="sm"
              variant={familyFilter === family.id ? 'secondary' : 'outline'}
              className="rounded-xl"
              onClick={() => setFamilyFilter(family.id)}
            >
              {family.label}
            </Button>
          ))}
        </div>
        <Button className="h-9 rounded-xl px-4 hover:bg-brand-deep" onClick={startCreate}>
          <Plus data-icon="inline-start" />
          添加服务商
        </Button>
      </div>

      {createWizard ? (
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 md:p-6">
          {createWizard.step === 'family' ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-medium">选择 API 协议族</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  创建后不可修改；同一网关可分别创建不同协议族的服务商。
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {families.map((family) => (
                  <li key={family.id}>
                    <button
                      type="button"
                      className="flex h-full w-full flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-4 text-left transition-colors hover:bg-secondary"
                      onClick={() => setCreateWizard({ step: 'form', apiFamily: family.id })}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{family.label}</span>
                        {!family.runtimeImplemented ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            运行时尚未支持
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{family.description}</p>
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                className="w-fit rounded-xl"
                onClick={() => setCreateWizard(null)}
              >
                取消
              </Button>
            </div>
          ) : (
            <AiProviderForm
              key={`create-${createWizard.apiFamily}`}
              apiFamily={createWizard.apiFamily}
              provider={null}
              formId={providerFormId}
              onCancel={() => setCreateWizard({ step: 'family' })}
              onSubmit={async (values) => {
                if (createWizard.step !== 'form') {
                  return;
                }
                const created = await onCreateProvider(createWizard.apiFamily, values);
                setCreateWizard(null);
                setExpandedIds((prev) => new Set([...prev, created.id]));
              }}
            />
          )}
        </div>
      ) : null}

      {filteredProviders.length === 0 && !createWizard ? (
        <Empty className="rounded-2xl border border-dashed border-border bg-card py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Plus />
            </EmptyMedia>
            <EmptyTitle>暂无服务商</EmptyTitle>
            <EmptyDescription>
              {familyFilter === 'all' ? '添加第一个系统级 AI 服务商。' : '当前筛选下没有服务商。'}
            </EmptyDescription>
          </EmptyHeader>
          <Button className="mt-2 rounded-xl hover:bg-brand-deep" onClick={startCreate}>
            添加服务商
          </Button>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredProviders.map((provider) => {
            const familyDef = getWireFamilyDefinition(provider.apiFamily);
            const isExpanded = expandedIds.has(provider.id);
            const providerModels = models
              .filter((model) => model.providerId === provider.id)
              .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
            const enabledModelCount = providerModels.filter((model) => model.isEnabled).length;
            const resultForRow = testResult?.providerId === provider.id ? testResult : null;
            const balanceResult = balanceByProvider[provider.id];
            const isTesting = testingProviderId === provider.id;
            const isQueryingBalance = queryingBalanceId === provider.id;
            const isModelFormOpen = modelForm?.providerId === provider.id;

            return (
              <li key={provider.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="px-4 py-4 md:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(provider.id)}
                    >
                      <div className="flex items-start gap-2">
                        <ChevronDown
                          className={cn(
                            'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            !isExpanded && '-rotate-90',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{provider.name}</span>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {familyDef.label}
                            </Badge>
                            {!provider.isEnabled ? (
                              <Badge variant="outline" className="text-xs">
                                停用
                              </Badge>
                            ) : null}
                            {!familyDef.runtimeImplemented ? (
                              <Badge variant="outline" className="text-xs font-normal">
                                运行时尚未支持
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {formatBaseUrlHost(provider.baseUrl)}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {providerModels.length} 个模型
                            {providerModels.length > 0 ? ` · ${enabledModelCount} 个启用` : null}
                            {provider.apiKeyMasked ? ` · Key ${provider.apiKeyMasked}` : null}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={isTesting || !familyDef.runtimeImplemented}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTestProvider(provider);
                        }}
                      >
                        {isTesting ? <Spinner data-icon="inline-start" /> : null}
                        测试连通
                      </Button>
                      {familyDef.provider.capabilities.balanceQuery ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={isQueryingBalance}
                          onClick={(event) => {
                            event.stopPropagation();
                            onQueryBalance(provider);
                          }}
                        >
                          {isQueryingBalance ? (
                            <Spinner data-icon="inline-start" />
                          ) : (
                            <Wallet data-icon="inline-start" />
                          )}
                          余额
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {resultForRow || balanceResult ? (
                    <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm">
                      {resultForRow ? (
                        <p className={resultForRow.ok ? 'text-muted-foreground' : 'text-destructive'}>
                          {resultForRow.message}
                        </p>
                      ) : null}
                      {balanceResult?.supported ? (
                        <p className="text-muted-foreground">余额：{formatBalance(balanceResult)}</p>
                      ) : balanceResult && !balanceResult.supported ? (
                        <p className="text-muted-foreground">{balanceResult.message}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {isExpanded ? (
                  <div className="flex flex-col gap-6 border-t border-border px-4 py-5 md:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">展开后可编辑完整配置与模型。</p>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => onDeleteProvider(provider)}
                      >
                        删除服务商
                      </Button>
                    </div>

                    <AiProviderForm
                      key={provider.id}
                      apiFamily={provider.apiFamily}
                      provider={provider}
                      formId={`${providerFormId}-${provider.id}`}
                      onSubmit={(values) => onUpdateProvider(provider, values)}
                    />

                    <section className="flex flex-col gap-4 border-t border-border pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-base font-medium">模型</h4>
                          <p className="mt-1 text-sm text-muted-foreground">API 模式由当前协议族决定。</p>
                        </div>
                        {!isModelFormOpen ? (
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-xl hover:bg-brand-deep"
                            onClick={() => setModelForm({ providerId: provider.id, mode: 'create' })}
                          >
                            <Plus data-icon="inline-start" />
                            添加模型
                          </Button>
                        ) : null}
                      </div>

                      {isModelFormOpen ? (
                        <AiModelForm
                          key={modelForm.mode === 'edit' ? modelForm.model?.id : `${provider.id}-create`}
                          formId={`${modelFormId}-${provider.id}`}
                          provider={provider}
                          model={modelForm.mode === 'edit' ? (modelForm.model ?? null) : null}
                          onCancel={() => setModelForm(null)}
                          onSubmit={async (values) => {
                            if (modelForm.mode === 'edit' && modelForm.model) {
                              await onUpdateModel(modelForm.model, values);
                            } else {
                              await onCreateModel(provider, values);
                            }
                            setModelForm(null);
                          }}
                        />
                      ) : (
                        <AiModelList
                          provider={provider}
                          models={providerModels}
                          onEdit={(model) => setModelForm({ providerId: provider.id, mode: 'edit', model })}
                          onDelete={onDeleteModel}
                        />
                      )}
                    </section>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {(isProviderSaving || isModelSaving) && <p className="text-sm text-muted-foreground">保存中…</p>}
    </div>
  );
}
