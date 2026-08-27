'use client';

import { useState } from 'react';

import { LLM_BALANCE_PRESETS, type LlmProvider } from '@gloaming/shared/api/llm-config';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

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

type AiProviderSheetProps = {
  open: boolean;
  provider: LlmProvider | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProviderFormValues) => void;
};

function emptyValues(): ProviderFormValues {
  return {
    name: '',
    baseUrl: 'https://',
    apiKey: '',
    proxyUrl: '',
    thinkingParam: '',
    balanceEndpoint: '',
    balanceAmountPath: '',
    balanceCurrencyPath: '',
    isEnabled: true,
  };
}

function fromProvider(provider: LlmProvider): ProviderFormValues {
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

function AiProviderSheetForm({
  provider,
  onSubmit,
  onCancel,
}: {
  provider: LlmProvider | null;
  onSubmit: (values: ProviderFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = provider != null;
  const [values, setValues] = useState<ProviderFormValues>(() => (provider ? fromProvider(provider) : emptyValues()));
  const [presetId, setPresetId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ProviderFormValues, string>>>({});

  function applyPreset(presetId: string) {
    const preset = LLM_BALANCE_PRESETS.find((item) => item.id === presetId);
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
    if (values.proxyUrl.trim()) {
      try {
        const proxy = new URL(values.proxyUrl.trim());
        if (!/^(https?|socks5):$/.test(proxy.protocol)) {
          next.proxyUrl = '代理地址需为 http/https/socks5';
        }
      } catch {
        next.proxyUrl = '代理地址格式不正确';
      }
    }
    if (values.thinkingParam.trim() && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(values.thinkingParam.trim())) {
      next.thinkingParam = '思考参数名需为合法标识符';
    }
    if (
      values.balanceEndpoint.trim() &&
      !/^(https?):\/\//i.test(values.balanceEndpoint.trim()) &&
      !values.balanceEndpoint.trim().startsWith('/')
    ) {
      next.balanceEndpoint = '余额端点需为 http(s) 地址或以 / 开头的路径';
    }
    if (values.balanceEndpoint.trim() && !values.balanceAmountPath.trim()) {
      next.balanceAmountPath = '填写端点后需指定余额字段路径';
    }
    if (!isEdit && !values.apiKey.trim()) {
      next.apiKey = '新建时需要填写 API Key';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEdit ? '编辑服务商' : '添加服务商'}</SheetTitle>
        <SheetDescription>OpenAI 兼容接口：填写 Base URL 与 API Key。原型仅保存在本页内存中。</SheetDescription>
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
          <Field data-invalid={Boolean(errors.name) || undefined}>
            <FieldLabel htmlFor="provider-name">名称</FieldLabel>
            <Input
              id="provider-name"
              value={values.name}
              aria-invalid={Boolean(errors.name) || undefined}
              placeholder="例如 OpenAI 兼容服务商"
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            />
            <FieldError>{errors.name}</FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.baseUrl) || undefined}>
            <FieldLabel htmlFor="provider-base-url">Base URL</FieldLabel>
            <Input
              id="provider-base-url"
              value={values.baseUrl}
              aria-invalid={Boolean(errors.baseUrl) || undefined}
              placeholder="https://api.example.com/v1"
              onChange={(event) => setValues((prev) => ({ ...prev, baseUrl: event.target.value }))}
            />
            {errors.baseUrl ? (
              <FieldError>{errors.baseUrl}</FieldError>
            ) : (
              <FieldDescription>需包含协议，通常以 /v1 结尾。</FieldDescription>
            )}
          </Field>

          <Field data-invalid={Boolean(errors.proxyUrl) || undefined}>
            <FieldLabel htmlFor="provider-proxy-url">代理地址（可选）</FieldLabel>
            <Input
              id="provider-proxy-url"
              value={values.proxyUrl}
              aria-invalid={Boolean(errors.proxyUrl) || undefined}
              placeholder="http://127.0.0.1:7890"
              onChange={(event) => setValues((prev) => ({ ...prev, proxyUrl: event.target.value }))}
            />
            {errors.proxyUrl ? (
              <FieldError>{errors.proxyUrl}</FieldError>
            ) : (
              <FieldDescription>
                填写后该服务商下所有模型请求均走此代理；留空则使用服务器环境变量或直连。清空输入框可移除已有代理。
              </FieldDescription>
            )}
          </Field>

          <Field data-invalid={Boolean(errors.thinkingParam) || undefined}>
            <FieldLabel htmlFor="provider-thinking-param">思考参数名（可选）</FieldLabel>
            <Input
              id="provider-thinking-param"
              value={values.thinkingParam}
              aria-invalid={Boolean(errors.thinkingParam) || undefined}
              placeholder="enable_thinking"
              onChange={(event) => setValues((prev) => ({ ...prev, thinkingParam: event.target.value }))}
            />
            {errors.thinkingParam ? (
              <FieldError>{errors.thinkingParam}</FieldError>
            ) : (
              <FieldDescription>
                该服务商下模型开启/关闭思考时透传的参数名（如
                enable_thinking）；留空则不传，跟随平台默认（测试与调用可能较慢）。
              </FieldDescription>
            )}
          </Field>

          <Field data-invalid={Boolean(errors.apiKey) || undefined}>
            <FieldLabel htmlFor="provider-api-key">API Key</FieldLabel>
            <Input
              id="provider-api-key"
              type="password"
              autoComplete="off"
              value={values.apiKey}
              aria-invalid={Boolean(errors.apiKey) || undefined}
              placeholder={isEdit ? '留空表示不修改' : 'sk-…'}
              onChange={(event) => setValues((prev) => ({ ...prev, apiKey: event.target.value }))}
            />
            {errors.apiKey ? (
              <FieldError>{errors.apiKey}</FieldError>
            ) : isEdit && provider?.apiKeyMasked ? (
              <FieldDescription>当前：{provider.apiKeyMasked}</FieldDescription>
            ) : (
              <FieldDescription>密钥不会在界面明文回显。</FieldDescription>
            )}
          </Field>

          <Field data-invalid={Boolean(errors.balanceEndpoint) || undefined}>
            <FieldLabel htmlFor="provider-balance-endpoint">余额查询（可选）</FieldLabel>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Select
                  items={LLM_BALANCE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                  value={presetId}
                  onValueChange={(value) => {
                    if (value != null) {
                      applyPreset(value);
                    }
                  }}
                >
                  <SelectTrigger id="provider-balance-preset" className="h-9 rounded-xl">
                    <SelectValue placeholder="选择平台预设（可再修改）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {LLM_BALANCE_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id} title={preset.hint ?? undefined}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <Input
                id="provider-balance-endpoint"
                value={values.balanceEndpoint}
                aria-invalid={Boolean(errors.balanceEndpoint) || undefined}
                placeholder="https://api.example.com/user/balance"
                className="font-mono"
                onChange={(event) => setValues((prev) => ({ ...prev, balanceEndpoint: event.target.value }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={Boolean(errors.balanceAmountPath) || undefined}>
                  <Input
                    id="provider-balance-amount-path"
                    value={values.balanceAmountPath}
                    aria-invalid={Boolean(errors.balanceAmountPath) || undefined}
                    placeholder="data.balance"
                    className="font-mono"
                    onChange={(event) => setValues((prev) => ({ ...prev, balanceAmountPath: event.target.value }))}
                  />
                  <FieldError>{errors.balanceAmountPath}</FieldError>
                </Field>
                <Field>
                  <Input
                    id="provider-balance-currency-path"
                    value={values.balanceCurrencyPath}
                    placeholder="data.currency（缺省 USD）"
                    className="font-mono"
                    onChange={(event) => setValues((prev) => ({ ...prev, balanceCurrencyPath: event.target.value }))}
                  />
                </Field>
              </div>
            </div>
            {errors.balanceEndpoint ? (
              <FieldError>{errors.balanceEndpoint}</FieldError>
            ) : (
              <FieldDescription>
                留空端点即关闭余额查询。端点可为完整 URL 或以 / 开头的相对路径（拼 Base URL 域名）；金额路径支持
                a.b[0].c 或两值相减（如 data.total_credits - data.total_usage）。
              </FieldDescription>
            )}
          </Field>

          <Field
            orientation="horizontal"
            className="items-center justify-between rounded-xl border border-border px-3 py-3"
          >
            <div>
              <FieldLabel htmlFor="provider-enabled">启用</FieldLabel>
              <FieldDescription>停用后其下模型不可被用途绑定。</FieldDescription>
            </div>
            <Switch
              id="provider-enabled"
              checked={values.isEnabled}
              onCheckedChange={(checked) => setValues((prev) => ({ ...prev, isEnabled: checked }))}
            />
          </Field>
        </FieldGroup>

        <SheetFooter className="px-0">
          <Button type="submit" className="rounded-xl hover:bg-brand-deep">
            {isEdit ? '保存修改' : '添加服务商'}
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>
            取消
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export function AiProviderSheet({ open, provider, onOpenChange, onSubmit }: AiProviderSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        {open ? (
          <AiProviderSheetForm
            key={provider?.id ?? 'create'}
            provider={provider}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
