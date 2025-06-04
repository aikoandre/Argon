import React from "react";
import { VariantPanel } from "../components/VariantPanel";

// This component is a wrapper to inject the VariantPanel for AI messages in ChatPage
export const ChatMessageVariants: React.FC<{ messageId: string }> = ({ messageId }) => {
  // Optionally, handle navigation or UI updates after branch/delete/commit here
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
    <div className="my-2">
      <VariantPanel
        messageId={messageId}
        onBranchCreated={handleBranchCreated}
        onDeleted={handleDeleted}
        onVariantCommitted={handleVariantCommitted}
      />
    </div>
  );
};
