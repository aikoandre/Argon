import React, { useEffect, useState } from "react";
import { useVariants } from "../hooks/useVariants";

interface VariantArrowsProps {
  messageId: string;
  onVariantChange?: (messageId: string, currentVariant: any) => void;
  onShowLoadingVariant?: (messageId: string, show: boolean) => void;
}

export const VariantArrows: React.FC<VariantArrowsProps> = ({ 
  messageId, 
  onVariantChange,
  onShowLoadingVariant 
}) => {
  const {
    variants,
    currentIdx,
    goToNext,
    goToPrev,
    loading,
    setCurrentIdx,
    addVariant,
    currentVariant,
  } = useVariants(messageId);

  const [isGeneratingNewVariant, setIsGeneratingNewVariant] = useState(false);

  // Rule 1: Always show counter (default 1/1, then 1/2, 2/2, etc.)
  const isFirst = currentIdx === 0;
  const showCounter = true; // Always show counter

  // Rule 3: Show blank for new variant slot
  const showBlank = variants.length > 0 && currentIdx === variants.length;

  // Function to generate a new variant using the variant generation system
  const generateNewVariant = async () => {
    if (isGeneratingNewVariant || loading) return;
    
    setIsGeneratingNewVariant(true);
    
    // Show loading state if callback is provided
    if (onShowLoadingVariant) {
      onShowLoadingVariant(messageId, true);
    }
    
    try {
      // Use the addVariant function from useVariants hook
      await addVariant();
      
    } catch (error) {
      console.error("Failed to generate new variant:", error);
    } finally {
      setIsGeneratingNewVariant(false);
      
      // Hide loading state if callback is provided
      if (onShowLoadingVariant) {
        onShowLoadingVariant(messageId, false);
      }
    }
  };

  // Notify parent when current variant changes
  useEffect(() => {
    if (onVariantChange && currentVariant) {
      onVariantChange(messageId, currentVariant);
    }
  }, [currentVariant, messageId, onVariantChange]);

  // When user clicks right arrow on last variant, generate a new variant using chat flow
  const handleNext = async () => {
    if (currentIdx === variants.length - 1) {
      await generateNewVariant();
    } else {
      goToNext();
    }
  };

  // When variants update, if we are on the blank slot and a new variant is loaded, jump to it
  useEffect(() => {
    if (currentIdx === variants.length && variants.length > 0) {
      setCurrentIdx(variants.length - 1);
    }
  }, [variants.length]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Left arrow: positioned at bottom-left corner */}
      {!isFirst && (
        <button
          className="absolute bottom-2 left-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors pointer-events-auto "
          title="Previous variant"
          disabled={loading}
          onClick={goToPrev}
        >
          <span className="material-icons-outlined text-2xl">keyboard_arrow_left</span>
        </button>
      )}
      
      {/* Right arrow: positioned at bottom-right corner with increased margin */}
      <button
        className="absolute bottom-2 right-4 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors pointer-events-auto"
        title="Generate new variant"
        disabled={loading || isGeneratingNewVariant}
        onClick={handleNext}
      >
        {isGeneratingNewVariant ? (
          <span className="animate-spin text-2xl">⟳</span>
        ) : (
          <span className="material-icons-outlined text-2xl">keyboard_arrow_right</span>
        )}
      </button>
      
      {/* Counter: positioned at bottom center */}
      {showCounter && (
        <span className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-app-accent-3 whitespace-nowrap pointer-events-none px-2 py-1 rounded">
          {showBlank ? variants.length + 1 : currentIdx + 1}/{Math.max(1, variants.length + (showBlank ? 1 : 0))}
        </span>
      )}
    </div>
  );
};
