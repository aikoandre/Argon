import React, { useEffect, useState } from 'react';

interface CardImageProps {
  imageUrl: string | null;
  className?: string;
}

export const CardImage: React.FC<CardImageProps> = ({ imageUrl, className = '' }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setImageSrc(null);
      setError(null);
      return;
    }

    let mounted = true;
    setError(null);

    const loadImage = async () => {
      try {
        // Handle data URLs directly
        if (imageUrl.startsWith('data:')) {
          setImageSrc(imageUrl);
          return;
        }

        // Use the backend API URL
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        // Handle different URL formats
        let fullUrl = imageUrl;
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
            // If it's a relative path, prepend the API URL
            // Remove any duplicate /api/images/serve prefix from imageUrl
            const cleanImageUrl = imageUrl.replace(/^\/?(api\/images\/serve\/)?(images\/)?/, '');
            fullUrl = `${apiUrl}/static/images/${cleanImageUrl}`;
        }

        // Check if the image URL is empty or invalid
        if (!fullUrl || fullUrl.trim() === '') {
          throw new Error('Invalid image URL');
        }

        const response = await fetch(fullUrl, {
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
      <div className={`${className} flex flex-col items-center justify-center bg-gray-800 text-gray-500 p-4`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {error && (
          <p className="mt-2 text-sm text-center max-w-full break-words">
            {error}: {imageUrl}
          </p>
        )}
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
