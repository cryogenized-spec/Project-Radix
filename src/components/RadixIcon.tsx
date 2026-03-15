import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { getCachedIcon } from '../lib/db';

interface RadixIconProps {
  icon: string;
  style?: React.CSSProperties;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function RadixIcon({ icon, style, width, height, className }: RadixIconProps) {
  const [iconData, setIconData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        // 1. Check local cache first
        const cached = await getCachedIcon(icon);
        if (cached && isMounted) {
          console.log('Using cached icon:', icon);
          setIconData(cached.data);
          return;
        }
      } catch (e) {
        console.error('Error loading cached icon:', e);
      }

      // 2. Fallback to live API (string identifier)
      if (isMounted) {
        setIconData(icon);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [icon]);

  if (!iconData) {
    return null;
  }

  return (
    <Icon
      icon={iconData}
      style={style}
      width={width}
      height={height}
      className={className}
    />
  );
}
