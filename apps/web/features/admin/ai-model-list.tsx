'use client';

import type { LlmModel, LlmProvider } from '@gloaming/shared/api/llm-config';
import { getWireFamilyDefinition, getWireVariantLabel } from '@gloaming/shared/llm/wire-registry';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type AiModelListProps = {
  provider: LlmProvider;
  models: LlmModel[];
  onEdit: (model: LlmModel) => void;
  onDelete: (model: LlmModel) => void;
};

export function AiModelList({ provider, models, onEdit, onDelete }: AiModelListProps) {
  const familyDef = getWireFamilyDefinition(provider.apiFamily);

  if (models.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">该服务商下还没有模型。</p>;
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>显示名</TableHead>
              <TableHead>Model ID</TableHead>
              <TableHead>API 模式</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-medium">{model.label}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{model.modelId}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {getWireVariantLabel(provider.apiFamily, model.wireVariant)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={model.isEnabled ? 'secondary' : 'outline'}>{model.isEnabled ? '启用' : '停用'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onEdit(model)}>
                      编辑
                    </Button>
                    <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => onDelete(model)}>
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {models.map((model) => (
          <li key={model.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{model.label}</p>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{model.modelId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-normal">
                    {getWireVariantLabel(provider.apiFamily, model.wireVariant)}
                  </Badge>
                  <Badge variant={model.isEnabled ? 'secondary' : 'outline'}>{model.isEnabled ? '启用' : '停用'}</Badge>
                  {!familyDef.runtimeImplemented ? (
                    <Badge variant="outline" className="text-xs font-normal">
                      运行时尚未支持
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onEdit(model)}>
                  编辑
                </Button>
                <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => onDelete(model)}>
                  删除
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
