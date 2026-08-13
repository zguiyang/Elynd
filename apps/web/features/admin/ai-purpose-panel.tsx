'use client';

import type { LlmAppSettingView, LlmModel, LlmProvider } from '@elynd/shared/api/llm-config';
import type { AiSettingKey } from '@elynd/shared/api/llm-config-keys';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AI_PURPOSE_LABELS: Record<AiSettingKey, { title: string; description: string }> = {
  'assist.default_model_id': {
    title: '阅读助手',
    description: '阅读页提问与划词帮助使用的默认模型。',
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
  return { label: '已配置', tone: 'ok' };
}

export function AiPurposePanel({
  settings,
  providers,
  models,
  draftByKey,
  onDraftChange,
  onSave,
}: AiPurposePanelProps) {
  const enabledModels = models
    .filter((model) => {
      if (!model.isEnabled) {
        return false;
      }
      const provider = providers.find((item) => item.id === model.providerId);
      return Boolean(provider?.isEnabled);
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  return (
    <section className="rounded-3xl border border-border bg-secondary/60 px-5 py-5 md:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-foreground">用途默认模型</h2>
        <p className="text-sm text-muted-foreground">决定各业务能力实际调用哪一个已启用模型。</p>
      </div>

      <ul className="mt-5 flex flex-col gap-4">
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
            const byId = new Map(enabledModels.map((model) => [model.id, { value: model.id, label: model.label }]));
            if (draft && !byId.has(draft)) {
              const model = models.find((item) => item.id === draft);
              byId.set(draft, {
                value: draft,
                label: model?.label ?? setting.modelLabel ?? draft,
              });
            }
            return [...byId.values()];
          })();

          return (
            <li
              key={setting.key}
              className="flex flex-col gap-4 border-t border-border/80 pt-4 first:border-t-0 first:pt-0 md:flex-row md:items-end md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{copy.title}</p>
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
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end md:w-auto">
                <Field className="min-w-0 flex-1 sm:min-w-56">
                  <FieldLabel htmlFor={`purpose-${setting.key}`}>默认模型</FieldLabel>
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
                      className="h-10 w-full rounded-xl"
                      disabled={enabledModels.length === 0 && !draft}
                    >
                      <SelectValue placeholder={enabledModels.length === 0 ? '暂无可用模型' : '选择启用中的模型'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {enabledModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>仅列出已启用服务商下的启用模型。</FieldDescription>
                </Field>
                <Button
                  className="h-10 shrink-0 rounded-xl px-5 hover:bg-brand-deep"
                  disabled={!draft || !isDirty}
                  onClick={() => onSave(setting.key)}
                >
                  保存
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
