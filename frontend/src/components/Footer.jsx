import React from 'react';

export function Footer() {
  return (
    <footer className="w-full py-6 text-center text-gray-500 text-sm">
      <div className="flex items-center justify-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <span>Desenvolvido por</span>
        <a href="https://github.com/ranieryfialho" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">
          Raniery Fialho
        </a>
      </div>
    </footer>
  );
}