import axios from "axios";

// --- Variants API ---
export async function getMessageVariants(messageId: string) {
  const res = await axios.get(`/api/variants/message/${messageId}`);
  return res.data;
}

export async function generateMessageVariant(messageId: string) {
  const res = await axios.post(`/api/variants/message/${messageId}/generate`);
  return res.data;
}

export async function selectMessageVariant(messageId: string, variantId: string) {
  const res = await axios.post(`/api/variants/message/${messageId}/select/${variantId}`);
  return res.data;
}

export async function regenerateAiResponse(messageId: string) {
  const res = await axios.post(`/api/variants/message/${messageId}/regenerate`);
  return res.data;
}

// --- Branching API ---
export async function createBranchFromMessage(messageId: string) {
  const res = await axios.post(`/api/branch/from_message/${messageId}`);
  return res.data;
}

// --- Deletion API ---
export async function deleteMessagesAfter(messageId: string) {
  const res = await axios.post(`/api/delete/after_message/${messageId}`);
  return res.data;
}

export async function deleteSpecificMessage(messageId: string) {
  const res = await axios.delete(`/api/delete/message/${messageId}`);
  return res.data;
}

// --- Continue API ---
export async function continueConversation(chatId: string) {
  const res = await axios.post(`/api/chat/${chatId}/continue`);
  return res.data;
}
