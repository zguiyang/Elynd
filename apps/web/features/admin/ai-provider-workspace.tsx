'use client';

import { ArrowLeft, Plus, Wallet } from 'lucide-react';
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

type AiProviderWorkspaceProps = {
  providers: LlmProvider[];
  models: LlmModel[];
  onCreateProvider: (apiFamily: LlmApiFamily, values: ProviderFormValues) => Promise<void>;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createWizard, setCreateWizard] = useState<CreateWizard | null>(null);
  const [modelForm, setModelForm] = useState<{ mode: 'create' | 'edit'; model?: LlmModel } | null>(null);
  const [isMobileDetailVisible, setIsMobileDetailVisible] = useState(false);

  const filteredProviders = useMemo(() => {
    if (familyFilter === 'all') {
      return providers;
    }
    return providers.filter((provider) => provider.apiFamily === familyFilter);
  }, [providers, familyFilter]);

  const activeProviderId = useMemo(() => {
    if (createWizard) {
      return null;
    }
    if (filteredProviders.length === 0) {
      return null;
    }
    if (selectedId && filteredProviders.some((provider) => provider.id === selectedId)) {
      return selectedId;
    }
    return filteredProviders[0]?.id ?? null;
  }, [createWizard, filteredProviders, selectedId]);

  const selectedProvider = activeProviderId
    ? (filteredProviders.find((provider) => provider.id === activeProviderId) ?? null)
    : null;

  const providerModels = selectedProvider
    ? models
        .filter((model) => model.providerId === selectedProvider.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    : [];

  const resultForProvider = testResult?.providerId === selectedProvider?.id ? testResult : null;
  const balanceResult = selectedProvider ? balanceByProvider[selectedProvider.id] : undefined;
  const isTesting = selectedProvider != null && testingProviderId === selectedProvider.id;
  const isQueryingBalance = selectedProvider != null && queryingBalanceId === selectedProvider.id;

  function startCreate() {
    setCreateWizard({ step: 'family' });
    setSelectedId(null);
    setModelForm(null);
    setIsMobileDetailVisible(true);
  }

  function selectProvider(provider: LlmProvider) {
    setCreateWizard(null);
    setModelForm(null);
    setSelectedId(provider.id);
    setIsMobileDetailVisible(true);
  }

  const isDetailPanelVisible = createWizard != null || selectedProvider != null;

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

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
        <aside className={cn('flex flex-col gap-2', isMobileDetailVisible && 'hidden lg:flex')}>
          {filteredProviders.length === 0 ? (
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
            <ul className="flex flex-col gap-2">
              {filteredProviders.map((provider) => {
                const familyDef = getWireFamilyDefinition(provider.apiFamily);
                const isActive = !createWizard && provider.id === selectedId;
                const modelCount = models.filter((model) => model.providerId === provider.id).length;
                return (
                  <li key={provider.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                        isActive
                          ? 'border-border bg-card shadow-card'
                          : 'border-transparent bg-secondary/60 hover:bg-secondary',
                      )}
                      onClick={() => selectProvider(provider)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground">{provider.name}</p>
                        {!provider.isEnabled ? (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            停用
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {familyDef.label}
                        </Badge>
                        {!familyDef.runtimeImplemented ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            运行时尚未支持
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">{modelCount} 个模型</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className={cn('min-w-0', !isMobileDetailVisible && 'hidden lg:block')}>
          {!isDetailPanelVisible ? (
            <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-sm text-muted-foreground">
              选择左侧服务商，或添加新服务商。
            </div>
          ) : (
            <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 md:p-6">
              <div className="flex items-center gap-3 lg:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setIsMobileDetailVisible(false)}
                >
                  <ArrowLeft />
                </Button>
                <p className="font-medium">{createWizard ? '新建服务商' : selectedProvider?.name}</p>
              </div>

              {createWizard?.step === 'family' ? (
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
              ) : null}

              {createWizard?.step === 'form' ? (
                <AiProviderForm
                  key={`create-${createWizard.apiFamily}`}
                  apiFamily={createWizard.apiFamily}
                  provider={null}
                  formId={providerFormId}
                  onCancel={() => setCreateWizard({ step: 'family' })}
                  onSubmit={async (values) => {
                    if (createWizard?.step !== 'form') {
                      return;
                    }
                    await onCreateProvider(createWizard.apiFamily, values);
                    setCreateWizard(null);
                    setIsMobileDetailVisible(true);
                  }}
                />
              ) : null}

              {selectedProvider && !createWizard ? (
                <>
                  <div className="flex flex-col gap-4 border-b border-border pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-medium">{selectedProvider.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          系统级服务商配置；API Key 仅在此保存，不会返回明文。
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={
                            isTesting || !getWireFamilyDefinition(selectedProvider.apiFamily).runtimeImplemented
                          }
                          onClick={() => onTestProvider(selectedProvider)}
                        >
                          {isTesting ? <Spinner data-icon="inline-start" /> : null}
                          测试连通
                        </Button>
                        {getWireFamilyDefinition(selectedProvider.apiFamily).provider.capabilities.balanceQuery ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            disabled={isQueryingBalance}
                            onClick={() => onQueryBalance(selectedProvider)}
                          >
                            {isQueryingBalance ? (
                              <Spinner data-icon="inline-start" />
                            ) : (
                              <Wallet data-icon="inline-start" />
                            )}
                            查询余额
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => onDeleteProvider(selectedProvider)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>

                    {resultForProvider ? (
                      <p className={cn('text-sm', resultForProvider.ok ? 'text-muted-foreground' : 'text-destructive')}>
                        {resultForProvider.message}
                      </p>
                    ) : null}
                    {balanceResult?.supported ? (
                      <p className="text-sm text-muted-foreground">余额：{formatBalance(balanceResult)}</p>
                    ) : balanceResult && !balanceResult.supported ? (
                      <p className="text-sm text-muted-foreground">{balanceResult.message}</p>
                    ) : null}
                  </div>

                  <AiProviderForm
                    key={selectedProvider.id}
                    apiFamily={selectedProvider.apiFamily}
                    provider={selectedProvider}
                    formId={providerFormId}
                    onSubmit={(values) => onUpdateProvider(selectedProvider, values)}
                  />

                  <section className="flex flex-col gap-4 border-t border-border pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-medium">模型</h4>
                        <p className="mt-1 text-sm text-muted-foreground">Wire 选项由当前服务商协议族决定。</p>
                      </div>
                      {!modelForm ? (
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl hover:bg-brand-deep"
                          onClick={() => setModelForm({ mode: 'create' })}
                        >
                          <Plus data-icon="inline-start" />
                          添加模型
                        </Button>
                      ) : null}
                    </div>

                    {modelForm ? (
                      <AiModelForm
                        key={modelForm.mode === 'edit' ? modelForm.model?.id : 'create'}
                        formId={modelFormId}
                        provider={selectedProvider}
                        model={modelForm.mode === 'edit' ? (modelForm.model ?? null) : null}
                        onCancel={() => setModelForm(null)}
                        onSubmit={async (values) => {
                          if (modelForm.mode === 'edit' && modelForm.model) {
                            await onUpdateModel(modelForm.model, values);
                          } else {
                            await onCreateModel(selectedProvider, values);
                          }
                          setModelForm(null);
                        }}
                      />
                    ) : (
                      <AiModelList
                        provider={selectedProvider}
                        models={providerModels}
                        onEdit={(model) => setModelForm({ mode: 'edit', model })}
                        onDelete={onDeleteModel}
                      />
                    )}
                  </section>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {(isProviderSaving || isModelSaving) && <p className="text-sm text-muted-foreground">保存中…</p>}
    </div>
  );
}
