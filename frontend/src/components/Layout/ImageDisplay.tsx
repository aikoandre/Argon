import React from 'react';

interface ImageDisplayProps {
  src: string;
  alt?: string;
  className?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ src, alt = "Character image", className = "" }) => {
  return (
    <div className={`w-full h-full flex items-end justify-center ${className}`}>
      <img 
        src={src} 
        alt={alt}
        className="max-w-full max-h-full object-contain"
        style={{ 
          objectPosition: 'bottom center',
          aspectRatio: 'auto',
          maxHeight: '100%',
          maxWidth: '100%'
        }}
      />
    </div>
  );
};

export default ImageDisplay;
