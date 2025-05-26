import React, { useEffect, useState } from 'react';

interface CardImageProps {
  imageUrl: string | null | undefined;
  className?: string;
}

export const CardImage: React.FC<CardImageProps> = ({ imageUrl, className = '' }) => {
  if (!imageUrl) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-gray-800 text-gray-500 p-4`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="mt-2 text-sm text-center max-w-full break-words">
          No image available
        </p>
      </div>
    );
  }

  return (
    <div className={`${className} overflow-hidden rounded-lg`}>
      <div
        className="w-full h-full transform transition-all duration-300 group-hover:scale-110"
        style={{
          backgroundImage: `url(${imageUrl})`,
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
