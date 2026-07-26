import React, { useState, useEffect, useRef } from 'react';
import { Play, X } from 'lucide-react';

interface BypassVideoFrameProps {
  videoId: string;
  title: string;
  thumbnail: string;
  isActive?: boolean;
}

export function BypassVideoFrame({ videoId, title, thumbnail, isActive = false }: BypassVideoFrameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const hasBeenActivated = useRef(false);

  // Once activated (hover or click), keep the iframe mounted
  // but hide it visually when not active to save resources
  useEffect(() => {
    if (isActive && !hasBeenActivated.current) {
      hasBeenActivated.current = true;
      setIsPlaying(true);
    }
  }, [isActive]);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const iframeSrcDoc = `
    <!doctype html>
    <html lang="ko">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src https://www.youtube.com https://www.youtube-nocookie.com; img-src data: https://i.ytimg.com https://*.ytimg.com;">
    <base href="about:blank">
    <style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}
    iframe{display:block;width:100%;height:100%;border:0;background:#000}
    </style>
    </head>
    <body>
    <iframe
      id="youtube-player"
      src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&modestbranding=1&disablekb=1&controls=1&cc_load_policy=1&cc_lang_pref=ko&origin=${encodeURIComponent(originUrl)}"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      title="${title.replace(/"/g, '&quot;')}"
    ></iframe>
    </body>
    </html>
  `;

  if (!isPlaying) {
    return (
      <div 
        className="relative w-full h-full bg-zinc-900 group cursor-pointer"
        onClick={(e) => { e.stopPropagation(); hasBeenActivated.current = true; setIsPlaying(true); }}
      >
        <img 
          src={thumbnail} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100" 
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-xl transition-transform group-hover:scale-110">
            <Play className="w-5 h-5 ml-1" fill="currentColor" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-black transition-opacity duration-300 relative group ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <button 
        className="absolute top-2 right-2 z-20 p-2 bg-black/60 hover:bg-red-600/90 rounded-full text-white backdrop-blur-md transition-all shadow-xl opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); setIsPlaying(false); }}
        title="닫기"
      >
        <X className="w-4 h-4" />
      </button>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=0&playsinline=1&rel=0&modestbranding=1&disablekb=1&controls=1&cc_load_policy=1&cc_lang_pref=ko&origin=${encodeURIComponent(originUrl)}`}
        className="w-full h-full border-0 relative z-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        title={title}
      />
    </div>
  );
}
