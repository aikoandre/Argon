import apiClient from "./api";

// --- Variants API ---
export async function getMessageVariants(messageId: string) {
  const res = await apiClient.get(`/variants/message/${messageId}`);
  return res.data;
}

export async function generateMessageVariant(messageId: string) {
  const res = await apiClient.post(`/variants/message/${messageId}/generate`);
  return res.data;
}

export async function selectMessageVariant(messageId: string, variantId: string) {
  const res = await apiClient.post(`/variants/message/${messageId}/select/${variantId}`);
  return res.data;
}

export async function regenerateAiResponse(messageId: string) {
  const res = await apiClient.post(`/variants/message/${messageId}/regenerate`);
  return res.data;
}

// --- Branching API ---
export async function createBranchFromMessage(messageId: string) {
  const res = await apiClient.post(`/branch/from_message/${messageId}`);
  return res.data;
}

// --- Deletion API ---
export async function deleteMessagesAfter(messageId: string) {
  const res = await apiClient.post(`/delete/after_message/${messageId}`);
  return res.data;
}

export async function deleteSpecificMessage(messageId: string) {
  const res = await apiClient.delete(`/delete/message/${messageId}`);
  return res.data;
}

// --- Continue API ---
export async function continueConversation(chatId: string) {
  const res = await apiClient.post(`/chat/${chatId}/continue`);
  return res.data;
}
