import React from "react";
import { VariantPanel } from "./VariantPanel";

// Example usage: wrap this in your chat message component
export const ExampleMessageWithVariants: React.FC<{ messageId: string }> = ({ messageId }) => {
  // You can handle navigation or UI updates after branch/delete/commit here
  const handleBranchCreated = (branch: any) => {
    // TODO: navigate to new branch session (branch.session_id or similar)
    alert("Novo branch criado! ID: " + (branch?.session_id || JSON.stringify(branch)));
  };
  const handleDeleted = () => {
    // TODO: refresh chat UI after deletion
    alert("Mensagens após este ponto foram deletadas.");
  };
  const handleVariantCommitted = () => {
    // TODO: update UI to reflect committed variant
    alert("Variante selecionada e confirmada!");
  };

  return (
    <div className="my-4">
      <VariantPanel
        messageId={messageId}
        onBranchCreated={handleBranchCreated}
        onDeleted={handleDeleted}
        onVariantCommitted={handleVariantCommitted}
      />
    </div>
  );
};
