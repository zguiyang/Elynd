'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { LLM_BALANCE_PRESETS, type LlmProvider } from '@gloaming/shared/api/llm-config';
import type { LlmApiFamily } from '@gloaming/shared/llm/wire-registry';
import { getWireFamilyDefinition, providerSupportsOptionalField } from '@gloaming/shared/llm/wire-registry';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type ProviderFormValues = {
  name: string;
  baseUrl: string;
  apiKey: string;
  proxyUrl: string;
  thinkingParam: string;
  balanceEndpoint: string;
  balanceAmountPath: string;
  balanceCurrencyPath: string;
  isEnabled: boolean;
};

type AiProviderFormProps = {
  apiFamily: LlmApiFamily;
  provider: LlmProvider | null;
  formId: string;
  onSubmit: (values: ProviderFormValues) => void;
  onCancel?: () => void;
};

export function emptyProviderValues(apiFamily: LlmApiFamily): ProviderFormValues {
  const familyDef = getWireFamilyDefinition(apiFamily);
  return {
    name: '',
    baseUrl: familyDef.provider.baseUrlPlaceholder,
    apiKey: '',
    proxyUrl: '',
    thinkingParam: '',
    balanceEndpoint: '',
    balanceAmountPath: '',
    balanceCurrencyPath: '',
    isEnabled: true,
  };
}

export function providerValuesFromRow(provider: LlmProvider): ProviderFormValues {
  return {
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: '',
    proxyUrl: provider.proxyUrl ?? '',
    thinkingParam: provider.thinkingParam ?? '',
    balanceEndpoint: provider.balanceEndpoint ?? '',
    balanceAmountPath: provider.balanceAmountPath ?? '',
    balanceCurrencyPath: provider.balanceCurrencyPath ?? '',
    isEnabled: provider.isEnabled,
  };
}

export function AiProviderForm({ apiFamily, provider, formId, onSubmit, onCancel }: AiProviderFormProps) {
  const familyDef = getWireFamilyDefinition(apiFamily);
  const isEdit = provider != null;
  const [values, setValues] = useState<ProviderFormValues>(() =>
    provider ? providerValuesFromRow(provider) : emptyProviderValues(apiFamily),
  );
  const [presetId, setPresetId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ProviderFormValues, string>>>({});
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const shouldShowThinkingParam = providerSupportsOptionalField(apiFamily, 'thinkingParam');
  const shouldShowBalance = familyDef.provider.capabilities.balanceQuery;

  function applyPreset(nextPresetId: string) {
    const preset = LLM_BALANCE_PRESETS.find((item) => item.id === nextPresetId);
    if (!preset) {
      return;
    }
    setPresetId(preset.id);
    setValues((prev) => ({
      ...prev,
      balanceEndpoint: preset.endpoint,
      balanceAmountPath: preset.amountPath,
      balanceCurrencyPath: preset.currencyPath ?? '',
    }));
    setIsAdvancedOpen(true);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof ProviderFormValues, string>> = {};
    if (!values.name.trim()) {
      next.name = '请填写服务商名称';
    }
    if (!values.baseUrl.trim()) {
      next.baseUrl = '请填写 Base URL';
    } else {
      try {
        new URL(values.baseUrl.trim());
      } catch {
        next.baseUrl = 'Base URL 格式不正确';
      }
    }
    if (!isEdit && !values.apiKey.trim()) {
      next.apiKey = '新建时需要填写 API Key';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <form
      id={formId}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!validate()) {
          return;
        }
        onSubmit(values);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">API 协议族</span>
        <Badge variant="secondary">{familyDef.label}</Badge>
        {!familyDef.runtimeImplemented ? (
          <Badge variant="outline" className="text-xs font-normal">
            运行时尚未支持
          </Badge>
        ) : null}
      </div>

      <FieldGroup className="gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field data-invalid={Boolean(errors.name) || undefined}>
            <FieldLabel htmlFor={`${formId}-name`}>名称</FieldLabel>
            <Input
              id={`${formId}-name`}
              value={values.name}
              onChange={(e) => setValues((p) => ({ ...p, name: e.target.value }))}
            />
            <FieldError>{errors.name}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.baseUrl) || undefined}>
            <FieldLabel htmlFor={`${formId}-base-url`}>Base URL</FieldLabel>
            <Input
              id={`${formId}-base-url`}
              className="font-mono text-sm"
              value={values.baseUrl}
              onChange={(e) => setValues((p) => ({ ...p, baseUrl: e.target.value }))}
            />
            <FieldDescription>{familyDef.provider.baseUrlHint}</FieldDescription>
            <FieldError>{errors.baseUrl}</FieldError>
          </Field>
        </div>

        <Field data-invalid={Boolean(errors.apiKey) || undefined}>
          <FieldLabel htmlFor={`${formId}-api-key`}>API Key</FieldLabel>
          <Input
            id={`${formId}-api-key`}
            type="password"
            autoComplete="off"
            value={values.apiKey}
            placeholder={isEdit ? '留空表示不修改' : 'sk-…'}
            onChange={(e) => setValues((p) => ({ ...p, apiKey: e.target.value }))}
          />
          {isEdit && provider?.apiKeyMasked ? <FieldDescription>当前：{provider.apiKeyMasked}</FieldDescription> : null}
          <FieldError>{errors.apiKey}</FieldError>
        </Field>

        {shouldShowThinkingParam ? (
          <Field>
            <FieldLabel htmlFor={`${formId}-thinking`}>思考参数名（可选）</FieldLabel>
            <Input
              id={`${formId}-thinking`}
              value={values.thinkingParam}
              placeholder="enable_thinking"
              onChange={(e) => setValues((p) => ({ ...p, thinkingParam: e.target.value }))}
            />
          </Field>
        ) : null}

        <Field
          orientation="horizontal"
          className="items-center justify-between rounded-xl border border-border px-3 py-3"
        >
          <FieldLabel htmlFor={`${formId}-enabled`}>启用</FieldLabel>
          <Switch
            id={`${formId}-enabled`}
            checked={values.isEnabled}
            onCheckedChange={(checked) => setValues((p) => ({ ...p, isEnabled: checked }))}
          />
        </Field>

        <div className="rounded-xl border border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
            onClick={() => setIsAdvancedOpen((open) => !open)}
            aria-expanded={isAdvancedOpen}
          >
            高级设置
            <ChevronDown
              className={cn('size-4 text-muted-foreground transition-transform', isAdvancedOpen && 'rotate-180')}
            />
          </button>
          {isAdvancedOpen ? (
            <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
              <Field>
                <FieldLabel htmlFor={`${formId}-proxy`}>代理地址</FieldLabel>
                <Input
                  id={`${formId}-proxy`}
                  value={values.proxyUrl}
                  onChange={(e) => setValues((p) => ({ ...p, proxyUrl: e.target.value }))}
                />
              </Field>
              {shouldShowBalance ? (
                <Field>
                  <FieldLabel>余额查询（可选）</FieldLabel>
                  <Select
                    items={LLM_BALANCE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                    value={presetId}
                    onValueChange={(value) => value != null && applyPreset(value)}
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="选择平台预设" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {LLM_BALANCE_PRESETS.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-2 font-mono text-sm"
                    value={values.balanceEndpoint}
                    placeholder="余额端点 URL"
                    onChange={(e) => setValues((p) => ({ ...p, balanceEndpoint: e.target.value }))}
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input
                      className="font-mono text-sm"
                      value={values.balanceAmountPath}
                      placeholder="data.balance"
                      onChange={(e) => setValues((p) => ({ ...p, balanceAmountPath: e.target.value }))}
                    />
                    <Input
                      className="font-mono text-sm"
                      value={values.balanceCurrencyPath}
                      placeholder="data.currency"
                      onChange={(e) => setValues((p) => ({ ...p, balanceCurrencyPath: e.target.value }))}
                    />
                  </div>
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>
      </FieldGroup>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="rounded-xl hover:bg-brand-deep">
          {isEdit ? '保存服务商' : '添加服务商'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>
            取消
          </Button>
        ) : null}
      </div>
    </form>
  );
}
