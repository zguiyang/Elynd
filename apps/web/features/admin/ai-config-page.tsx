'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import type { LlmModel, LlmProvider, ProviderBalanceResult } from '@gloaming/shared/api/llm-config';
import type { AiSettingKey } from '@gloaming/shared/api/llm-config-keys';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  adminLlmQueryKey,
  createLlmModel,
  createLlmProvider,
  deleteLlmModel,
  deleteLlmProvider,
  formatAdminLlmApiError,
  listLlmModels,
  listLlmProviders,
  listLlmSettings,
  putLlmSetting,
  queryLlmProviderBalance,
  testLlmProvider,
  updateLlmModel,
  updateLlmProvider,
} from '@/features/admin/ai-config-api';
import { AiModelSheet, type ModelFormValues } from '@/features/admin/ai-model-sheet';
import { AiProviderList, type ProviderTestResult } from '@/features/admin/ai-provider-list';
import { AiProviderSheet, type ProviderFormValues } from '@/features/admin/ai-provider-sheet';
import { AiPurposePanel } from '@/features/admin/ai-purpose-panel';

type DeleteTarget = { kind: 'provider'; provider: LlmProvider } | { kind: 'model'; model: LlmModel } | null;

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function AiConfigPage() {
  const queryClient = useQueryClient();

  const providersQuery = useQuery({
    queryKey: adminLlmQueryKey.providers(),
    queryFn: ({ signal }) => listLlmProviders({ signal }),
  });
  const modelsQuery = useQuery({
    queryKey: adminLlmQueryKey.models(),
    queryFn: ({ signal }) => listLlmModels(undefined, { signal }),
  });
  const settingsQuery = useQuery({
    queryKey: adminLlmQueryKey.settings(),
    queryFn: ({ signal }) => listLlmSettings({ signal }),
  });

  const providers = providersQuery.data ?? [];
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? [];

  const isPending = providersQuery.isPending || modelsQuery.isPending || settingsQuery.isPending;
  const loadError = providersQuery.error ?? modelsQuery.error ?? settingsQuery.error;

  const [purposeDraft, setPurposeDraft] = useState<Partial<Record<AiSettingKey, string>>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [isProviderSheetOpen, setIsProviderSheetOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LlmProvider | null>(null);
  const [isModelSheetOpen, setIsModelSheetOpen] = useState(false);
  const [modelSheetProvider, setModelSheetProvider] = useState<LlmProvider | null>(null);
  const [editingModel, setEditingModel] = useState<LlmModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [balanceByProvider, setBalanceByProvider] = useState<Record<string, ProviderBalanceResult>>({});
  const [queryingBalanceId, setQueryingBalanceId] = useState<string | null>(null);

  async function invalidateLlmQueries() {
    await queryClient.invalidateQueries({ queryKey: adminLlmQueryKey.all });
  }

  const providerMutation = useMutation({
    mutationFn: async (values: ProviderFormValues) => {
      if (editingProvider) {
        const apiKey = values.apiKey.trim();
        return updateLlmProvider(editingProvider.id, {
          name: values.name.trim(),
          baseUrl: values.baseUrl.trim(),
          proxyUrl: values.proxyUrl.trim() || null,
          thinkingParam: values.thinkingParam.trim() || null,
          balanceEndpoint: values.balanceEndpoint.trim() || null,
          balanceAmountPath: values.balanceAmountPath.trim() || null,
          balanceCurrencyPath: values.balanceCurrencyPath.trim() || null,
          isEnabled: values.isEnabled,
          ...(apiKey ? { apiKey } : {}),
        });
      }
      return createLlmProvider({
        name: values.name.trim(),
        baseUrl: values.baseUrl.trim(),
        apiKey: values.apiKey.trim(),
        proxyUrl: values.proxyUrl.trim() || null,
        thinkingParam: values.thinkingParam.trim() || null,
        balanceEndpoint: values.balanceEndpoint.trim() || null,
        balanceAmountPath: values.balanceAmountPath.trim() || null,
        balanceCurrencyPath: values.balanceCurrencyPath.trim() || null,
        isEnabled: values.isEnabled,
      });
    },
    onSuccess: async (provider) => {
      await invalidateLlmQueries();
      if (!editingProvider) {
        setExpandedIds((prev) => new Set([...prev, provider.id]));
      }
      setIsProviderSheetOpen(false);
      toast.success(editingProvider ? '已保存服务商' : '已添加服务商');
    },
    onError: (error) => {
      toast.error(formatAdminLlmApiError(error));
    },
  });

  const modelMutation = useMutation({
    mutationFn: async (values: ModelFormValues) => {
      if (!modelSheetProvider) {
        throw new Error('缺少服务商上下文');
      }
      const temperature = parseOptionalNumber(values.temperature);
      const maxTokensRaw = parseOptionalNumber(values.maxTokens);
      const maxTokens = maxTokensRaw != null ? Math.trunc(maxTokensRaw) : null;
      const contextLength = parseOptionalNumber(values.contextLength);
      const sortOrder = Math.trunc(parseOptionalNumber(values.sortOrder) ?? 0);

      if (editingModel) {
        return updateLlmModel(editingModel.id, {
          modelId: values.modelId.trim(),
          label: values.label.trim(),
          protocol: values.protocol,
          temperature,
          maxTokens,
          contextLength,
          isEnabled: values.isEnabled,
          sortOrder,
        });
      }
      return createLlmModel({
        providerId: modelSheetProvider.id,
        modelId: values.modelId.trim(),
        label: values.label.trim(),
        protocol: values.protocol,
        temperature,
        maxTokens,
        contextLength,
        isEnabled: values.isEnabled,
        sortOrder,
      });
    },
    onSuccess: async () => {
      await invalidateLlmQueries();
      setIsModelSheetOpen(false);
      toast.success(editingModel ? '已保存模型' : '已添加模型');
    },
    onError: (error) => {
      toast.error(formatAdminLlmApiError(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: NonNullable<DeleteTarget>) => {
      if (target.kind === 'provider') {
        await deleteLlmProvider(target.provider.id);
        return;
      }
      await deleteLlmModel(target.model.id);
    },
    onSuccess: async (_data, target) => {
      await invalidateLlmQueries();
      setDeleteTarget(null);
      toast.success(target.kind === 'provider' ? '已删除服务商' : '已删除模型');
    },
    onError: (error) => {
      toast.error(formatAdminLlmApiError(error));
      setDeleteTarget(null);
    },
  });

  const purposeMutation = useMutation({
    mutationFn: async (key: AiSettingKey) => {
      const modelId = purposeDraft[key];
      if (!modelId) {
        throw new Error('请先选择模型');
      }
      return putLlmSetting(key, { modelId });
    },
    onSuccess: async (_setting, key) => {
      await invalidateLlmQueries();
      setPurposeDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success('已保存用途默认模型');
    },
    onError: (error) => {
      toast.error(formatAdminLlmApiError(error));
    },
  });

  const testMutation = useMutation({
    mutationFn: async (provider: LlmProvider) => {
      setTestingProviderId(provider.id);
      setTestResult(null);
      return testLlmProvider(provider.id);
    },
    onSuccess: (result, provider) => {
      setTestResult({
        providerId: provider.id,
        ok: true,
        message: `连通成功 · ${result.modelLabel} · ${result.latencyMs} ms`,
      });
      toast.message('连通测试完成');
    },
    onError: (error, provider) => {
      setTestResult({
        providerId: provider.id,
        ok: false,
        message: formatAdminLlmApiError(error),
      });
      toast.error(formatAdminLlmApiError(error));
    },
    onSettled: () => {
      setTestingProviderId(null);
    },
  });

  const balanceMutation = useMutation({
    mutationFn: async (provider: LlmProvider) => {
      setQueryingBalanceId(provider.id);
      return queryLlmProviderBalance(provider.id);
    },
    onSuccess: (result, provider) => {
      setBalanceByProvider((prev) => ({ ...prev, [provider.id]: result }));
      if (result.supported) {
        toast.message('余额已更新');
      }
    },
    onError: (error, provider) => {
      setBalanceByProvider((prev) => ({
        ...prev,
        [provider.id]: {
          supported: false,
          reason: 'request-failed',
          message: formatAdminLlmApiError(error),
        },
      }));
    },
    onSettled: () => {
      setQueryingBalanceId(null);
    },
  });

  function openCreateProvider() {
    setEditingProvider(null);
    setIsProviderSheetOpen(true);
  }

  function openEditProvider(provider: LlmProvider) {
    setEditingProvider(provider);
    setIsProviderSheetOpen(true);
  }

  function openCreateModel(provider: LlmProvider) {
    setModelSheetProvider(provider);
    setEditingModel(null);
    setIsModelSheetOpen(true);
  }

  function openEditModel(model: LlmModel) {
    const provider = providers.find((item) => item.id === model.providerId) ?? null;
    setModelSheetProvider(provider);
    setEditingModel(model);
    setIsModelSheetOpen(true);
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight">AI 配置</h1>
          <p className="mt-3 text-lg text-muted-foreground">配置 OpenAI 兼容服务商与模型，并指定阅读助手默认调用。</p>
        </div>
        <Button className="h-10 shrink-0 rounded-xl px-6 hover:bg-brand-deep" onClick={openCreateProvider}>
          <Plus data-icon="inline-start" />
          添加服务商
        </Button>
      </div>

      <div className="mt-10 flex flex-col gap-8">
        {isPending ? (
          <>
            <Skeleton className="h-40 w-full rounded-2xl bg-muted/70" />
            <Skeleton className="h-72 w-full rounded-2xl bg-muted/70" />
          </>
        ) : loadError ? (
          <p className="rounded-2xl border border-border bg-secondary/60 px-5 py-8 text-sm text-destructive md:px-6">
            {formatAdminLlmApiError(loadError)}
          </p>
        ) : (
          <>
            <AiPurposePanel
              settings={settings}
              providers={providers}
              models={models}
              draftByKey={purposeDraft}
              onDraftChange={(key, modelId) =>
                setPurposeDraft((prev) => ({
                  ...prev,
                  [key]: modelId,
                }))
              }
              onSave={(key) => purposeMutation.mutate(key)}
            />

            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-medium text-foreground">服务商与模型</h2>
                <p className="mt-1 text-sm text-muted-foreground">展开服务商查看模型；测试将请求上游做一次连通探测。</p>
              </div>
              <AiProviderList
                providers={providers}
                models={models}
                expandedIds={expandedIds}
                testingProviderId={testingProviderId}
                testResult={testResult}
                balanceByProvider={balanceByProvider}
                queryingBalanceId={queryingBalanceId}
                onToggleExpand={(providerId) => {
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(providerId)) {
                      next.delete(providerId);
                    } else {
                      next.add(providerId);
                    }
                    return next;
                  });
                }}
                onAddProvider={openCreateProvider}
                onEditProvider={openEditProvider}
                onDeleteProvider={(provider) => setDeleteTarget({ kind: 'provider', provider })}
                onTestProvider={(provider) => testMutation.mutate(provider)}
                onQueryBalance={(provider) => balanceMutation.mutate(provider)}
                onAddModel={openCreateModel}
                onEditModel={openEditModel}
                onDeleteModel={(model) => setDeleteTarget({ kind: 'model', model })}
              />
            </section>
          </>
        )}
      </div>

      <AiProviderSheet
        open={isProviderSheetOpen}
        provider={editingProvider}
        onOpenChange={setIsProviderSheetOpen}
        onSubmit={(values) => providerMutation.mutate(values)}
      />

      <AiModelSheet
        open={isModelSheetOpen}
        provider={modelSheetProvider}
        model={editingModel}
        onOpenChange={setIsModelSheetOpen}
        onSubmit={(values) => modelMutation.mutate(values)}
      />

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.kind === 'provider' ? '删除服务商？' : '删除模型？'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'provider'
                ? `将同时移除「${deleteTarget.provider.name}」下的全部模型。若仍被用途引用则无法删除。`
                : deleteTarget?.kind === 'model'
                  ? `将移除模型「${deleteTarget.model.label}」。若仍被用途引用则无法删除。`
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget);
                }
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
