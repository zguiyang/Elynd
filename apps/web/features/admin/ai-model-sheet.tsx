'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

import type { LlmModel, LlmModelProtocol, LlmProvider, ProviderModelCandidate } from '@gloaming/shared/api/llm-config';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { fetchLlmProviderModels, formatAdminLlmApiError } from '@/features/admin/ai-config-api';
import { isLlmModelProtocol, LLM_MODEL_PROTOCOL_OPTIONS } from '@/features/admin/llm-model-protocol';

export type ModelFormValues = {
  modelId: string;
  label: string;
  protocol: LlmModelProtocol;
  temperature: string;
  maxTokens: string;
  contextLength: string;
  isEnabled: boolean;
  sortOrder: string;
};

type AiModelSheetProps = {
  open: boolean;
  provider: LlmProvider | null;
  model: LlmModel | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ModelFormValues) => void;
};

function emptyValues(): ModelFormValues {
  return {
    modelId: '',
    label: '',
    protocol: 'chat-completions',
    temperature: '0.3',
    maxTokens: '2048',
    contextLength: '',
    isEnabled: true,
    sortOrder: '0',
  };
}

function fromModel(model: LlmModel): ModelFormValues {
  return {
    modelId: model.modelId,
    label: model.label,
    protocol: model.protocol,
    temperature: model.temperature != null ? String(model.temperature) : '',
    maxTokens: model.maxTokens != null ? String(model.maxTokens) : '',
    contextLength: model.contextLength != null ? String(model.contextLength) : '',
    isEnabled: model.isEnabled,
    sortOrder: String(model.sortOrder),
  };
}

function AiModelSheetForm({
  provider,
  model,
  onSubmit,
  onCancel,
}: {
  provider: LlmProvider;
  model: LlmModel | null;
  onSubmit: (values: ModelFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = model != null;
  const [values, setValues] = useState<ModelFormValues>(() => (model ? fromModel(model) : emptyValues()));
  const [errors, setErrors] = useState<Partial<Record<keyof ModelFormValues, string>>>({});

  const [candidates, setCandidates] = useState<ProviderModelCandidate[] | null>(null);
  const [pickedModelId, setPickedModelId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  function applyCandidate(candidate: ProviderModelCandidate) {
    setPickedModelId(candidate.id);
    setValues((prev) => ({
      ...prev,
      modelId: candidate.id,
      label: candidate.label,
      contextLength: candidate.contextLength != null ? String(candidate.contextLength) : prev.contextLength,
      maxTokens: candidate.maxOutputTokens != null ? String(candidate.maxOutputTokens) : prev.maxTokens,
    }));
  }

  async function loadPlatformModels() {
    setIsFetching(true);
    setFetchError(null);
    try {
      const result = await fetchLlmProviderModels(provider.id);
      setCandidates(result.models);
      setPickedModelId(null);
    } catch (error) {
      setFetchError(formatAdminLlmApiError(error));
      setCandidates(null);
    } finally {
      setIsFetching(false);
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof ModelFormValues, string>> = {};
    if (!values.modelId.trim()) {
      next.modelId = '请填写上游 model id';
    }
    if (!values.label.trim()) {
      next.label = '请填写显示名称';
    }
    if (values.temperature.trim()) {
      const temperature = Number(values.temperature);
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
        next.temperature = '温度需在 0-2 之间';
      }
    }
    if (values.maxTokens.trim()) {
      const maxTokens = Number(values.maxTokens);
      if (!Number.isInteger(maxTokens) || maxTokens < 1) {
        next.maxTokens = 'maxTokens 需为正整数';
      }
    }
    if (values.contextLength.trim()) {
      const contextLength = Number(values.contextLength);
      if (!Number.isInteger(contextLength) || contextLength < 1) {
        next.contextLength = '上下文窗口需为正整数';
      }
    }
    if (values.sortOrder.trim()) {
      const sortOrder = Number(values.sortOrder);
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        next.sortOrder = '排序需为非负整数';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEdit ? '编辑模型' : '添加模型'}</SheetTitle>
        <SheetDescription>归属服务商：{provider.name}。原型仅保存在本页内存中。</SheetDescription>
      </SheetHeader>

      <form
        className="flex flex-1 flex-col gap-6 px-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!validate()) {
            return;
          }
          onSubmit(values);
        }}
      >
        <FieldGroup>
          {!isEdit ? (
            <Field>
              <FieldLabel>从平台拉取模型（可选）</FieldLabel>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={isFetching}
                    onClick={loadPlatformModels}
                  >
                    {isFetching ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        拉取中
                      </>
                    ) : (
                      <>
                        <RefreshCw data-icon="inline-start" />
                        拉取模型列表
                      </>
                    )}
                  </Button>
                  {candidates ? (
                    <span className="text-xs text-muted-foreground">{candidates.length} 个模型</span>
                  ) : null}
                </div>

                {fetchError ? <p className="text-xs text-destructive">{fetchError}</p> : null}

                {candidates && candidates.length > 0 ? (
                  <Select
                    items={candidates.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
                    value={pickedModelId}
                    onValueChange={(value) => {
                      if (value == null) {
                        return;
                      }
                      const candidate = candidates.find((item) => item.id === value);
                      if (candidate) {
                        applyCandidate(candidate);
                      }
                    }}
                  >
                    <SelectTrigger id="model-pick" className="h-10 w-full rounded-xl">
                      <SelectValue placeholder="选择平台模型，自动填充下方字段" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {candidates.map((candidate) => (
                          <SelectItem
                            key={candidate.id}
                            value={candidate.id}
                            title={candidate.description ?? undefined}
                          >
                            {candidate.label}
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{candidate.id}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : null}

                {candidates && candidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">平台未返回任何模型，可手动填写。</p>
                ) : null}
              </div>
              <FieldDescription>
                选中后自动填充 Model ID、显示名称、上下文窗口与 Max tokens（平台未提供的留空），可继续修改。
              </FieldDescription>
            </Field>
          ) : null}

          <Field data-invalid={Boolean(errors.label) || undefined}>
            <FieldLabel htmlFor="model-label">显示名称</FieldLabel>
            <Input
              id="model-label"
              value={values.label}
              aria-invalid={Boolean(errors.label) || undefined}
              placeholder="例如 GPT-4o mini"
              onChange={(event) => setValues((prev) => ({ ...prev, label: event.target.value }))}
            />
            <FieldError>{errors.label}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.modelId) || undefined}>
            <FieldLabel htmlFor="model-id">Model ID</FieldLabel>
            <Input
              id="model-id"
              value={values.modelId}
              aria-invalid={Boolean(errors.modelId) || undefined}
              placeholder="gpt-4o-mini"
              className="font-mono"
              onChange={(event) => setValues((prev) => ({ ...prev, modelId: event.target.value }))}
            />
            {errors.modelId ? (
              <FieldError>{errors.modelId}</FieldError>
            ) : (
              <FieldDescription>传给上游的模型标识。</FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="model-protocol">API 协议</FieldLabel>
            <Select
              items={LLM_MODEL_PROTOCOL_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              value={values.protocol}
              onValueChange={(value) => {
                if (value != null && isLlmModelProtocol(value)) {
                  setValues((prev) => ({ ...prev, protocol: value }));
                }
              }}
            >
              <SelectTrigger id="model-protocol" className="h-10 w-full rounded-xl">
                <SelectValue placeholder="选择 API 协议" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {LLM_MODEL_PROTOCOL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{option.endpoint}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {LLM_MODEL_PROTOCOL_OPTIONS.find((option) => option.value === values.protocol)?.description}
            </FieldDescription>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field data-invalid={Boolean(errors.temperature) || undefined}>
              <FieldLabel htmlFor="model-temperature">Temperature</FieldLabel>
              <Input
                id="model-temperature"
                value={values.temperature}
                aria-invalid={Boolean(errors.temperature) || undefined}
                placeholder="0.3"
                onChange={(event) => setValues((prev) => ({ ...prev, temperature: event.target.value }))}
              />
              <FieldError>{errors.temperature}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.maxTokens) || undefined}>
              <FieldLabel htmlFor="model-max-tokens">Max tokens</FieldLabel>
              <Input
                id="model-max-tokens"
                value={values.maxTokens}
                aria-invalid={Boolean(errors.maxTokens) || undefined}
                placeholder="2048"
                onChange={(event) => setValues((prev) => ({ ...prev, maxTokens: event.target.value }))}
              />
              <FieldError>{errors.maxTokens}</FieldError>
            </Field>
          </div>

          <Field data-invalid={Boolean(errors.contextLength) || undefined}>
            <FieldLabel htmlFor="model-context-length">上下文窗口（可选）</FieldLabel>
            <Input
              id="model-context-length"
              value={values.contextLength}
              aria-invalid={Boolean(errors.contextLength) || undefined}
              placeholder="128000"
              onChange={(event) => setValues((prev) => ({ ...prev, contextLength: event.target.value }))}
            />
            {errors.contextLength ? (
              <FieldError>{errors.contextLength}</FieldError>
            ) : (
              <FieldDescription>模型上下文窗口（token），仅作记录，不影响调用。</FieldDescription>
            )}
          </Field>

          <Field data-invalid={Boolean(errors.sortOrder) || undefined}>
            <FieldLabel htmlFor="model-sort-order">排序</FieldLabel>
            <Input
              id="model-sort-order"
              value={values.sortOrder}
              aria-invalid={Boolean(errors.sortOrder) || undefined}
              placeholder="0"
              onChange={(event) => setValues((prev) => ({ ...prev, sortOrder: event.target.value }))}
            />
            {errors.sortOrder ? (
              <FieldError>{errors.sortOrder}</FieldError>
            ) : (
              <FieldDescription>数字越小越靠前。</FieldDescription>
            )}
          </Field>

          <Field
            orientation="horizontal"
            className="items-center justify-between rounded-xl border border-border px-3 py-3"
          >
            <div>
              <FieldLabel htmlFor="model-enabled">启用</FieldLabel>
              <FieldDescription>停用后不可被用途选为默认。</FieldDescription>
            </div>
            <Switch
              id="model-enabled"
              checked={values.isEnabled}
              onCheckedChange={(checked) => setValues((prev) => ({ ...prev, isEnabled: checked }))}
            />
          </Field>
        </FieldGroup>

        <SheetFooter className="px-0">
          <Button type="submit" className="rounded-xl hover:bg-brand-deep">
            {isEdit ? '保存修改' : '添加模型'}
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>
            取消
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function AiModelSheet({ open, provider, model, onOpenChange, onSubmit }: AiModelSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        {open && provider ? (
          <AiModelSheetForm
            key={model?.id ?? `create-${provider.id}`}
            provider={provider}
            model={model}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
