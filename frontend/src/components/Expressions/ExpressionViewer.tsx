import React, { useState, useEffect } from 'react';
import type { ExpressionType, CharacterExpressions } from '../../types/expressions';
import { getExpressionUrl } from '../../types/expressions';

interface ExpressionViewerProps {
  characterId: string;
  currentExpression: ExpressionType;
  expressions: CharacterExpressions | null;
  onExpressionChange?: (expression: ExpressionType) => void;
  showControls?: boolean;
  autoDetectEmotion?: boolean;
  className?: string;
}

const ExpressionViewer: React.FC<ExpressionViewerProps> = ({
  characterId,
  currentExpression,
  expressions,
  onExpressionChange,
  showControls = false,
  autoDetectEmotion = false, // TODO: Implement auto-detection
  className = ""
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // TODO: Use autoDetectEmotion for future emotion detection feature
  console.debug('Expression viewer initialized', { autoDetectEmotion });

  useEffect(() => {
    setIsLoading(true);
    setImageError(false);
    
    const url = getExpressionUrl(expressions, currentExpression);
    setImageUrl(url);
    setIsLoading(false);
  }, [expressions, currentExpression]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  const availableExpressions = expressions 
    ? Object.keys(expressions.expressions).filter(exp => expressions.expressions[exp as ExpressionType])
    : [];

  const handlePrevExpression = () => {
    if (!onExpressionChange || availableExpressions.length === 0) return;
    
    const currentIndex = availableExpressions.indexOf(currentExpression);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : availableExpressions.length - 1;
    onExpressionChange(availableExpressions[prevIndex] as ExpressionType);
  };

  const handleNextExpression = () => {
    if (!onExpressionChange || availableExpressions.length === 0) return;
    
    const currentIndex = availableExpressions.indexOf(currentExpression);
    const nextIndex = currentIndex < availableExpressions.length - 1 ? currentIndex + 1 : 0;
    onExpressionChange(availableExpressions[nextIndex] as ExpressionType);
  };

  if (!imageUrl && !isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 text-gray-500 ${className}`}>
        <span className="text-sm">No expression available</span>
      </div>
    );
  }

  return (
    <div className={`relative group ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}
      
      {imageUrl && (
        <img
          src={imageUrl}
          alt={`${characterId} - ${currentExpression}`}
          className="w-full h-full object-cover rounded-lg transition-opacity duration-200"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ aspectRatio: '3/4.5' }}
        />
      )}

      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500">
          <span className="text-sm">Failed to load expression</span>
        </div>
      )}

      {showControls && availableExpressions.length > 1 && (
        <>
          <button
            onClick={handlePrevExpression}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
            aria-label="Previous expression"
          >
            <span className="material-icons-outlined">chevron_left</span>
          </button>
          
          <button
            onClick={handleNextExpression}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
            aria-label="Next expression"
          >
            <span className="material-icons-outlined">chevron_right</span>
          </button>

          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-2 py-1 rounded text-xs">
            {currentExpression} ({availableExpressions.indexOf(currentExpression) + 1}/{availableExpressions.length})
          </div>
        </>
      )}
    </div>
  );
};

export default ExpressionViewer;
