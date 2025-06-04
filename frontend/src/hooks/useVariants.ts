import { useState, useCallback, useEffect } from "react";
import {
  getMessageVariants,
  generateMessageVariant,
  selectMessageVariant,
  createBranchFromMessage,
  deleteMessagesAfter,
} from "../services/advancedSessionApi";

export function useVariants(messageId: string) {
  const [variants, setVariants] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all variants for a message
  const fetchVariants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMessageVariants(messageId);
      setVariants(data.variants || []);
      setCurrentIdx(0);
    } catch (e: any) {
      setError(e.message || "Failed to fetch variants");
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  // Fetch variants on mount or when messageId changes
  useEffect(() => {
    fetchVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  // Generate a new variant
  const addVariant = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await generateMessageVariant(messageId);
      const data = await getMessageVariants(messageId);
      setVariants(data.variants || []);
      setCurrentIdx((data.variants?.length || 1) - 1); // Move to the new variant
    } catch (e: any) {
      setError(e.message || "Failed to generate variant");
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  // Select/commit a variant
  const commitVariant = useCallback(async (variantId: string) => {
    setLoading(true);
    setError(null);
    try {
      await selectMessageVariant(messageId, variantId);
      // Optionally refetch or update UI
    } catch (e: any) {
      setError(e.message || "Failed to select variant");
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  // Navigation
  const goToNext = () => setCurrentIdx((idx) => Math.min(idx + 1, variants.length - 1));
  const goToPrev = () => setCurrentIdx((idx) => Math.max(idx - 1, 0));

  // Branching
  const branchFromHere = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const branch = await createBranchFromMessage(messageId);
      return branch;
    } catch (e: any) {
      setError(e.message || "Failed to create branch");
      return null;
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  // Deletion
  const deleteAfter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteMessagesAfter(messageId);
    } catch (e: any) {
      setError(e.message || "Failed to delete messages");
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  return {
    variants,
    currentVariant: variants[currentIdx],
    currentIdx,
    setCurrentIdx,
    loading,
    error,
    fetchVariants,
    refresh: fetchVariants,
    addVariant,
    commitVariant,
    goToNext,
    goToPrev,
    branchFromHere,
    deleteAfter,
  };
}
