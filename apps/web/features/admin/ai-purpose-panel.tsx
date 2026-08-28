'use client';

import type { LlmAppSettingView, LlmModel, LlmProvider } from '@gloaming/shared/api/llm-config';
import type { AiSettingKey } from '@gloaming/shared/api/llm-config-keys';
import { getWireFamilyDefinition, getWireVariantLabel, isRuntimeImplemented } from '@gloaming/shared/llm/wire-registry';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AI_PURPOSE_LABELS: Record<AiSettingKey, { title: string; description: string }> = {
  'assist.default_model_id': {
    title: '阅读助手',
    description: '阅读页提问与划词帮助使用的默认模型。',
  },
  'translate.default_model_id': {
    title: '双语翻译',
    description: '阅读页双语模式下英译中使用的默认模型。',
  },
  'metadata-enrich.default_model_id': {
    title: '元数据回填',
    description: '上传 EPUB 后自动填充简介、标签与分类使用的默认模型。',
  },
};

type AiPurposePanelProps = {
  settings: LlmAppSettingView[];
  providers: LlmProvider[];
  models: LlmModel[];
  draftByKey: Partial<Record<AiSettingKey, string>>;
  onDraftChange: (key: AiSettingKey, modelId: string) => void;
  onSave: (key: AiSettingKey) => void;
};

function modelRuntimeReady(model: LlmModel, providers: LlmProvider[]): boolean {
  const provider = providers.find((item) => item.id === model.providerId);
  if (!provider?.isEnabled || !model.isEnabled) {
    return false;
  }
  return isRuntimeImplemented(provider.apiFamily);
}

function resolveHealth(
  setting: LlmAppSettingView,
  models: LlmModel[],
  providers: LlmProvider[],
): { label: string; tone: 'ok' | 'warn' | 'off' } {
  if (!setting.modelId) {
    return { label: '未配置', tone: 'warn' };
  }
  const model = models.find((item) => item.id === setting.modelId);
  if (!model) {
    return { label: '模型已删除', tone: 'off' };
  }
  if (!model.isEnabled) {
    return { label: '模型已停用', tone: 'warn' };
  }
  const provider = providers.find((item) => item.id === model.providerId);
  if (!provider?.isEnabled) {
    return { label: '服务商已停用', tone: 'warn' };
  }
  if (!isRuntimeImplemented(provider.apiFamily)) {
    return { label: '运行时尚未支持', tone: 'warn' };
  }
  return { label: '已配置', tone: 'ok' };
}

function modelOptionLabel(model: LlmModel, providers: LlmProvider[]): string {
  const provider = providers.find((item) => item.id === model.providerId);
  if (!provider) {
    return model.label;
  }
  const familyLabel = getWireFamilyDefinition(provider.apiFamily).label;
  const wireLabel = getWireVariantLabel(provider.apiFamily, model.wireVariant);
  return `${model.label} · ${provider.name} · ${familyLabel} · ${wireLabel}`;
}

export function AiPurposePanel({
  settings,
  providers,
  models,
  draftByKey,
  onDraftChange,
  onSave,
}: AiPurposePanelProps) {
  const bindableModels = models
    .filter((model) => modelRuntimeReady(model, providers))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-medium text-foreground">用途默认模型</h2>
        <p className="mt-1 text-sm text-muted-foreground">仅可选择已启用且运行时已接入的模型。</p>
      </div>

      <ul className="overflow-hidden rounded-2xl border border-border bg-secondary/60">
        {settings.map((setting) => {
          const copy = AI_PURPOSE_LABELS[setting.key];
          const draft = draftByKey[setting.key] ?? setting.modelId ?? '';
          const health = resolveHealth(
            { ...setting, modelId: draft || null, healthy: Boolean(draft) },
            models,
            providers,
          );
          const isDirty = draft !== (setting.modelId ?? '');
          const selectItems = (() => {
            const byId = new Map(
              bindableModels.map((model) => [model.id, { value: model.id, label: modelOptionLabel(model, providers) }]),
            );
            if (draft && !byId.has(draft)) {
              const model = models.find((item) => item.id === draft);
              byId.set(draft, {
                value: draft,
                label: model ? modelOptionLabel(model, providers) : (setting.modelLabel ?? draft),
              });
            }
            return [...byId.values()];
          })();

          return (
            <li
              key={setting.key}
              className="grid gap-5 border-t border-border/80 px-5 py-5 first:border-t-0 md:grid-cols-2 md:items-start md:gap-10 md:px-6 md:py-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-medium text-foreground">{copy.title}</p>
                  <Badge
                    variant="secondary"
                    className={
                      health.tone === 'ok'
                        ? 'bg-accent text-accent-foreground'
                        : health.tone === 'warn'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-destructive/10 text-destructive'
                    }
                  >
                    {health.label}
                  </Badge>
                  {!setting.runtimeReady && setting.modelId ? (
                    <Badge variant="outline" className="text-xs font-normal">
                      当前绑定不可运行
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
              </div>

              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`purpose-${setting.key}`}>默认模型</FieldLabel>
                <div className="flex items-center gap-3">
                  <Select
                    items={selectItems}
                    value={draft || null}
                    onValueChange={(value) => {
                      if (value == null) {
                        return;
                      }
                      onDraftChange(setting.key, value);
                    }}
                  >
                    <SelectTrigger
                      id={`purpose-${setting.key}`}
                      className="h-10 min-w-0 flex-1 rounded-xl"
                      disabled={bindableModels.length === 0 && !draft}
                    >
                      <SelectValue placeholder={bindableModels.length === 0 ? '暂无可绑定模型' : '选择可运行模型'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {bindableModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {modelOptionLabel(model, providers)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    className="h-10 shrink-0 rounded-xl px-6 hover:bg-brand-deep"
                    disabled={!draft || !isDirty}
                    onClick={() => onSave(setting.key)}
                  >
                    保存
                  </Button>
                </div>
                <FieldDescription>需服务商与模型均已启用，且 API 协议族运行时已接入。</FieldDescription>
              </Field>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
