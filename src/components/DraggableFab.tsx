import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSetting, setSetting } from '../lib/db';

interface DraggableFabProps {
  icon: React.ReactNode;
  onClick: () => void;
  onDoubleClick?: () => void;
  storageKey: string;
  defaultPosition: { x: number, y: number };
  className?: string;
  style?: React.CSSProperties;
  resetTrigger?: number; // Prop to trigger reset
}

export default function DraggableFab({ icon, onClick, onDoubleClick, storageKey, defaultPosition, className, style, resetTrigger }: DraggableFabProps) {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const btnStartPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  useEffect(() => {
    const loadPos = async () => {
      const saved = await getSetting(storageKey);
      const screenWidth = window.innerWidth || document.documentElement.clientWidth || 500;
      if (saved) {
        setPosition(saved);
      } else {
        setPosition(defaultPosition);
      }
    };
    loadPos();
  }, [storageKey, resetTrigger]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only left click or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    btnStartPos.current = { ...position };
    hasMoved.current = false;
    
    longPressTimer.current = setTimeout(() => {
      setIsLongPressed(true);
      setIsDragging(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      e.preventDefault(); // Prevent scrolling while dragging
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      
      let newX = btnStartPos.current.x + dx;
      let newY = btnStartPos.current.y + dy;

      // Boundaries
      const padding = 8;
      const maxX = window.innerWidth - 60; 
      const maxY = window.innerHeight - 60;

      newX = Math.max(padding, Math.min(newX, maxX));
      newY = Math.max(padding, Math.min(newY, maxY));

      setPosition({ x: newX, y: newY });
    } else {
        const dx = Math.abs(e.clientX - dragStartPos.current.x);
        const dy = Math.abs(e.clientY - dragStartPos.current.y);
        if (dx > 10 || dy > 10) {
            hasMoved.current = true;
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
    }
  };

  const lastClickTime = useRef<number>(0);

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isDragging) {
      setIsDragging(false);
      setIsLongPressed(false);
      
      await setSetting(storageKey, position);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!hasMoved.current) {
        const now = Date.now();
        if (now - lastClickTime.current < 300) {
          if (onDoubleClick) onDoubleClick();
        } else {
          onClick();
        }
        lastClickTime.current = now;
      }
  };

  return (
    <>
      {isLongPressed && (
        <div className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-75 pointer-events-none animate-in fade-in" />
      )}
      <div 
        className={`fixed z-50 touch-none select-none ${className}`}
        style={{ left: position.x, top: position.y, ...style }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        {isLongPressed && (
            <div className="pointer-events-none">
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 text-[var(--accent)] animate-bounce"><ChevronUp size={32} /></div>
                <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 text-[var(--accent)] animate-bounce"><ChevronDown size={32} /></div>
                <div className="absolute -left-20 top-1/2 -translate-y-1/2 text-[var(--accent)] animate-bounce"><ChevronLeft size={32} /></div>
                <div className="absolute -right-20 top-1/2 -translate-y-1/2 text-[var(--accent)] animate-bounce"><ChevronRight size={32} /></div>
            </div>
        )}
        <div className={`transition-transform duration-200 ${isLongPressed ? 'scale-110' : ''}`}>
            {icon}
        </div>
      </div>
    </>
  );
}
