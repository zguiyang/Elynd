'use client';

import { useState } from 'react';

import type { LlmModel } from '@elynd/shared/api/llm-config';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

export type ModelFormValues = {
  modelId: string;
  label: string;
  temperature: string;
  maxTokens: string;
  isEnabled: boolean;
  sortOrder: string;
};

type AiModelSheetProps = {
  open: boolean;
  providerName: string;
  model: LlmModel | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ModelFormValues) => void;
};

function emptyValues(): ModelFormValues {
  return {
    modelId: '',
    label: '',
    temperature: '0.3',
    maxTokens: '2048',
    isEnabled: true,
    sortOrder: '0',
  };
}

function fromModel(model: LlmModel): ModelFormValues {
  return {
    modelId: model.modelId,
    label: model.label,
    temperature: model.temperature != null ? String(model.temperature) : '',
    maxTokens: model.maxTokens != null ? String(model.maxTokens) : '',
    isEnabled: model.isEnabled,
    sortOrder: String(model.sortOrder),
  };
}

function AiModelSheetForm({
  providerName,
  model,
  onSubmit,
  onCancel,
}: {
  providerName: string;
  model: LlmModel | null;
  onSubmit: (values: ModelFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = model != null;
  const [values, setValues] = useState<ModelFormValues>(() => (model ? fromModel(model) : emptyValues()));
  const [errors, setErrors] = useState<Partial<Record<keyof ModelFormValues, string>>>({});

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
        <SheetDescription>归属服务商：{providerName}。原型仅保存在本页内存中。</SheetDescription>
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

export function AiModelSheet({ open, providerName, model, onOpenChange, onSubmit }: AiModelSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        {open ? (
          <AiModelSheetForm
            key={model?.id ?? `create-${providerName}`}
            providerName={providerName}
            model={model}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
