import React from 'react';

interface LeftPanelImageProps {
  src: string;
  alt?: string;
  className?: string;
}

const LeftPanelImage: React.FC<LeftPanelImageProps> = ({ 
  src, 
  alt = "Character image", 
  className = "" 
}) => {
  return (
    <div className={`w-full h-full flex items-end justify-center ${className}`}>
      <div 
        className="w-full max-w-full"
        style={{ 
          aspectRatio: '3/4.5',
          maxHeight: '100%'
        }}
      >
        <img 
          src={src} 
          alt={alt}
          className="w-full h-full object-cover"
          style={{ 
            aspectRatio: '3/4.5'
          }}
        />
      </div>
    </div>
  );
};

export default LeftPanelImage;
