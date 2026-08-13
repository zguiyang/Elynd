'use client';

/**
 * Prototype stub: Admin AI model configuration hub.
 * Local in-memory state only — not wired to `/api/admin/llm/*`.
 */

import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { LlmAppSettingView, LlmModel, LlmProvider } from '@elynd/shared/api/llm-config';
import type { AiSettingKey } from '@elynd/shared/api/llm-config-keys';

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
  createLocalId,
  maskApiKeyPreview,
  MOCK_LLM_MODELS,
  MOCK_LLM_PROVIDERS,
  MOCK_LLM_SETTINGS,
} from '@/features/admin/ai-config-mock';
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

function refreshSettingViews(
  settings: LlmAppSettingView[],
  models: LlmModel[],
  providers: LlmProvider[],
): LlmAppSettingView[] {
  return settings.map((setting) => {
    if (!setting.modelId) {
      return { ...setting, modelLabel: null, healthy: false };
    }
    const model = models.find((item) => item.id === setting.modelId);
    if (!model) {
      return { ...setting, modelId: null, modelLabel: null, healthy: false };
    }
    const provider = providers.find((item) => item.id === model.providerId);
    const isHealthy = Boolean(model.isEnabled && provider?.isEnabled);
    return {
      ...setting,
      modelLabel: model.label,
      healthy: isHealthy,
    };
  });
}

export function AiConfigPage() {
  const [isReady, setIsReady] = useState(false);
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [settings, setSettings] = useState<LlmAppSettingView[]>([]);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProviders(MOCK_LLM_PROVIDERS);
      setModels(MOCK_LLM_MODELS);
      setSettings(MOCK_LLM_SETTINGS);
      setExpandedIds(new Set([MOCK_LLM_PROVIDERS[0]?.id].filter(Boolean) as string[]));
      setIsReady(true);
    }, 280);
    return () => window.clearTimeout(timer);
  }, []);

  const syncedSettings = useMemo(() => refreshSettingViews(settings, models, providers), [settings, models, providers]);

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

  function handleProviderSubmit(values: ProviderFormValues) {
    const stamp = new Date().toISOString();
    if (editingProvider) {
      setProviders((prev) =>
        prev.map((item) => {
          if (item.id !== editingProvider.id) {
            return item;
          }
          const nextKey = values.apiKey.trim();
          return {
            ...item,
            name: values.name.trim(),
            baseUrl: values.baseUrl.trim(),
            isEnabled: values.isEnabled,
            apiKeySet: nextKey ? true : item.apiKeySet,
            apiKeyMasked: nextKey ? maskApiKeyPreview(nextKey) : item.apiKeyMasked,
            updatedAt: stamp,
          };
        }),
      );
      toast.success('已模拟保存服务商');
    } else {
      const id = createLocalId('prov');
      const next: LlmProvider = {
        id,
        name: values.name.trim(),
        baseUrl: values.baseUrl.trim(),
        isEnabled: values.isEnabled,
        apiKeySet: true,
        apiKeyMasked: maskApiKeyPreview(values.apiKey),
        createdAt: stamp,
        updatedAt: stamp,
      };
      setProviders((prev) => [...prev, next]);
      setExpandedIds((prev) => new Set([...prev, id]));
      toast.success('已模拟添加服务商');
    }
    setIsProviderSheetOpen(false);
  }

  function handleModelSubmit(values: ModelFormValues) {
    if (!modelSheetProvider) {
      return;
    }
    const stamp = new Date().toISOString();
    const temperature = parseOptionalNumber(values.temperature);
    const maxTokensRaw = parseOptionalNumber(values.maxTokens);
    const maxTokens = maxTokensRaw != null ? Math.trunc(maxTokensRaw) : null;
    const sortOrder = Math.trunc(parseOptionalNumber(values.sortOrder) ?? 0);

    if (editingModel) {
      setModels((prev) =>
        prev.map((item) =>
          item.id === editingModel.id
            ? {
                ...item,
                modelId: values.modelId.trim(),
                label: values.label.trim(),
                temperature,
                maxTokens,
                isEnabled: values.isEnabled,
                sortOrder,
                updatedAt: stamp,
              }
            : item,
        ),
      );
      toast.success('已模拟保存模型');
    } else {
      const next: LlmModel = {
        id: createLocalId('mdl'),
        providerId: modelSheetProvider.id,
        modelId: values.modelId.trim(),
        label: values.label.trim(),
        temperature,
        maxTokens,
        isEnabled: values.isEnabled,
        sortOrder,
        createdAt: stamp,
        updatedAt: stamp,
      };
      setModels((prev) => [...prev, next]);
      toast.success('已模拟添加模型');
    }
    setIsModelSheetOpen(false);
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    if (deleteTarget.kind === 'provider') {
      const providerId = deleteTarget.provider.id;
      const isBlocked = syncedSettings.some((setting) => {
        if (!setting.modelId) {
          return false;
        }
        const model = models.find((item) => item.id === setting.modelId);
        return model?.providerId === providerId;
      });
      if (isBlocked) {
        toast.error('该服务商下的模型仍被用途引用，请先改绑默认模型');
        setDeleteTarget(null);
        return;
      }
      setProviders((prev) => prev.filter((item) => item.id !== providerId));
      setModels((prev) => prev.filter((item) => item.providerId !== providerId));
      toast.success('已模拟删除服务商');
    } else {
      const modelId = deleteTarget.model.id;
      const isBlocked = syncedSettings.some((setting) => setting.modelId === modelId);
      if (isBlocked) {
        toast.error('该模型仍被用途引用，请先改绑默认模型');
        setDeleteTarget(null);
        return;
      }
      setModels((prev) => prev.filter((item) => item.id !== modelId));
      toast.success('已模拟删除模型');
    }
    setDeleteTarget(null);
  }

  async function handleTestProvider(provider: LlmProvider) {
    const candidate =
      models
        .filter((model) => model.providerId === provider.id && model.isEnabled)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;

    setTestingProviderId(provider.id);
    setTestResult(null);
    await new Promise((resolve) => window.setTimeout(resolve, 700));

    if (!provider.isEnabled) {
      setTestResult({
        providerId: provider.id,
        ok: false,
        message: '服务商已停用，模拟测试未执行。',
      });
      setTestingProviderId(null);
      return;
    }
    if (!provider.apiKeySet) {
      setTestResult({
        providerId: provider.id,
        ok: false,
        message: '缺少 API Key，模拟测试失败。',
      });
      setTestingProviderId(null);
      return;
    }
    if (!candidate) {
      setTestResult({
        providerId: provider.id,
        ok: false,
        message: '没有启用中的模型可供测试。',
      });
      setTestingProviderId(null);
      return;
    }

    const latencyMs = 180 + Math.floor(Math.random() * 320);
    setTestResult({
      providerId: provider.id,
      ok: true,
      message: `模拟连通成功 · ${candidate.label} · ${latencyMs} ms（未请求真实上游）`,
    });
    setTestingProviderId(null);
    toast.message('已模拟完成连通测试');
  }

  function handlePurposeSave(key: AiSettingKey) {
    const modelId = purposeDraft[key];
    if (!modelId) {
      return;
    }
    const model = models.find((item) => item.id === modelId);
    setSettings((prev) =>
      prev.map((setting) =>
        setting.key === key
          ? {
              ...setting,
              modelId,
              modelLabel: model?.label ?? null,
              healthy: Boolean(model?.isEnabled),
            }
          : setting,
      ),
    );
    setPurposeDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    toast.success('已模拟保存用途默认模型');
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">AI 配置</h1>
            <span className="text-sm text-muted-foreground">原型 · 本地演示数据，尚未对接后端</span>
          </div>
          <p className="mt-3 text-lg text-muted-foreground">配置 OpenAI 兼容服务商与模型，并指定阅读助手默认调用。</p>
        </div>
        <Button className="h-11 shrink-0 rounded-xl px-7 hover:bg-brand-deep" onClick={openCreateProvider}>
          <Plus data-icon="inline-start" />
          添加服务商
        </Button>
      </div>

      <div className="mt-10 flex flex-col gap-8">
        {!isReady ? (
          <>
            <Skeleton className="h-40 w-full rounded-3xl bg-muted/70" />
            <Skeleton className="h-72 w-full rounded-3xl bg-muted/70" />
          </>
        ) : (
          <>
            <AiPurposePanel
              settings={syncedSettings}
              providers={providers}
              models={models}
              draftByKey={purposeDraft}
              onDraftChange={(key, modelId) =>
                setPurposeDraft((prev) => ({
                  ...prev,
                  [key]: modelId,
                }))
              }
              onSave={handlePurposeSave}
            />

            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-medium text-foreground">服务商与模型</h2>
                <p className="mt-1 text-sm text-muted-foreground">展开服务商查看模型；测试不会请求真实上游。</p>
              </div>
              <AiProviderList
                providers={providers}
                models={models}
                expandedIds={expandedIds}
                testingProviderId={testingProviderId}
                testResult={testResult}
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
                onTestProvider={handleTestProvider}
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
        onSubmit={handleProviderSubmit}
      />

      <AiModelSheet
        open={isModelSheetOpen}
        providerName={modelSheetProvider?.name ?? ''}
        model={editingModel}
        onOpenChange={setIsModelSheetOpen}
        onSubmit={handleModelSubmit}
      />

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.kind === 'provider' ? '删除服务商？' : '删除模型？'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'provider'
                ? `将同时移除「${deleteTarget.provider.name}」下的全部模型。原型仅改本页内存，刷新后恢复演示数据。`
                : deleteTarget?.kind === 'model'
                  ? `将移除模型「${deleteTarget.model.label}」。原型仅改本页内存。`
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
