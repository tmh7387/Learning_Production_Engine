'use client';

import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    message?: string;
}

export function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-8 w-8',
        md: 'h-12 w-12',
        lg: 'h-16 w-16',
    };

    return (
        <div className= "flex flex-col items-center justify-center p-8" >
        <div
        className={ `${sizeClasses[size]} animate-spin rounded-full border-b-2 border-indigo-600` }
      />
    {
        message && (
            <p className="mt-4 text-sm text-gray-600" > { message } </p>
      )
    }
    </div>
  );
}