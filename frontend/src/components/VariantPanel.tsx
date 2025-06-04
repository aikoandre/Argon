import React from "react";
import { useVariants } from "../hooks/useVariants";

interface VariantPanelProps {
  messageId: string;
  onBranchCreated?: (branch: any) => void;
  onDeleted?: () => void;
  onVariantCommitted?: () => void;
}

export const VariantPanel: React.FC<VariantPanelProps> = ({
  messageId,
  onBranchCreated,
  onDeleted,
  onVariantCommitted,
}) => {
  const {
    variants,
    currentVariant,
    currentIdx,
    loading,
    error,
    goToNext,
    goToPrev,
    addVariant,
    commitVariant,
    branchFromHere,
    deleteAfter,
  } = useVariants(messageId);

  const handleCommit = async () => {
    if (!currentVariant) return;
    await commitVariant(currentVariant.id);
    if (onVariantCommitted) onVariantCommitted();
  };

  const handleBranch = async () => {
    const branch = await branchFromHere();
    if (branch && onBranchCreated) onBranchCreated(branch);
  };

  const handleDelete = async () => {
    await deleteAfter();
    if (onDeleted) onDeleted();
  };

  return (
    <div className="variant-panel border rounded p-2 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <button onClick={goToPrev} disabled={currentIdx === 0 || loading}>&lt;</button>
        <span className="mx-2">
          Variante {currentIdx + 1} / {variants.length || 1}
        </span>
        <button onClick={goToNext} disabled={currentIdx >= variants.length - 1 || loading}>&gt;</button>
        <button onClick={addVariant} disabled={loading} className="ml-4">+ Nova Variante</button>
      </div>
      {loading && <div className="text-blue-500">Carregando...</div>}
      {error && <div className="text-red-500">{error}</div>}
      <div className="border p-2 bg-white min-h-[60px] mb-2">
        {currentVariant ? (
          <>
            <div className="font-semibold mb-1">Resposta da IA:</div>
            <div>{currentVariant.text || currentVariant.content || JSON.stringify(currentVariant)}</div>
          </>
        ) : (
          <div>Nenhuma variante disponível.</div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={handleCommit} disabled={!currentVariant || loading} className="bg-green-500 text-white px-2 py-1 rounded">Selecionar</button>
        <button onClick={handleBranch} disabled={loading} className="bg-blue-500 text-white px-2 py-1 rounded">Branch</button>
        <button onClick={handleDelete} disabled={loading} className="bg-red-500 text-white px-2 py-1 rounded">Deletar após</button>
      </div>
    </div>
  );
};
