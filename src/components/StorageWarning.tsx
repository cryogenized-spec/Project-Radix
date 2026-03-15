import React, { useState, useEffect } from 'react';
import { AlertTriangle, HardDrive } from 'lucide-react';
import { checkQuota } from '../lib/db';

export default function StorageWarning() {
  const [quotaInfo, setQuotaInfo] = useState<{ usage: number, quota: number, isFull: boolean } | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const check = async () => {
      const info = await checkQuota();
      setQuotaInfo(info);
      if (info.isFull || (info.usage / (500 * 1024 * 1024)) > 0.9) {
        setShowWarning(true);
      }
    };
    check();
    // Check periodically
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!showWarning || !quotaInfo) return null;

  const usageMB = (quotaInfo.usage / (1024 * 1024)).toFixed(1);
  const percent = Math.min(100, (quotaInfo.usage / (500 * 1024 * 1024)) * 100).toFixed(1);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-red-900/90 text-white p-4 rounded-xl shadow-lg border border-red-500 max-w-xs backdrop-blur-md">
      <div className="flex items-start space-x-3">
        <HardDrive className="text-red-400 shrink-0 mt-1" size={20} />
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wider mb-1 flex items-center">
            Storage Critical
            <span className="ml-2 text-[10px] bg-red-500 px-1.5 py-0.5 rounded-full">{percent}%</span>
          </h3>
          <p className="text-xs text-red-200 mb-2">
            Local vault usage: {usageMB}MB / 500MB. 
            Old media will be pruned automatically to free up space.
          </p>
          <div className="w-full bg-red-950 h-1.5 rounded-full overflow-hidden">
            <div 
                className="bg-red-500 h-full transition-all duration-500" 
                style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <button 
            onClick={() => setShowWarning(false)}
            className="text-red-300 hover:text-white"
        >
            <AlertTriangle size={16} />
        </button>
      </div>
    </div>
  );
}
