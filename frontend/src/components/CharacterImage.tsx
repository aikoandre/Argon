import React, { useEffect, useState } from 'react';

interface CharacterImageProps {
  imageUrl: string | null;
  className?: string;
}

export const CharacterImage: React.FC<CharacterImageProps> = ({ imageUrl, className = '' }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) return;

    let mounted = true;
    setError(null);

    const loadImage = async () => {
      try {
        // Handle data URLs directly
        if (imageUrl.startsWith('data:')) {
          setImageSrc(imageUrl);
          return;
        }

        // Clean up the URL and ensure we're using the backend API URL
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        
        // Construct the URL correctly without duplicate segments
        const response = await fetch(`${apiUrl}${imageUrl}`, {
          headers: {
            'Accept': 'image/*'
          }
        });

        if (!response.ok) throw new Error('Failed to load image');

        const blob = await response.blob();
        if (!mounted) return;

        const objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      } catch (err) {
        if (mounted) {
          console.error('Error loading image:', err);
          setError('Failed to load image');
        }
      } finally {
        if (mounted) {
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
      // Cleanup object URL on unmount
      if (imageSrc && !imageSrc.startsWith('data:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageUrl]);

  if (error || !imageSrc) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-800 text-gray-500`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${className} overflow-hidden rounded-lg`}>
      <div 
        className="w-full h-full transform transition-all duration-300 group-hover:scale-110"
        style={{ 
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          WebkitBackfaceVisibility: 'hidden',
          MozBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden'
        }}
      >
        <div className="absolute inset-0 bg-black opacity-30 transition-opacity duration-300 group-hover:opacity-0"></div>
      </div>
    </div>
  );
};
