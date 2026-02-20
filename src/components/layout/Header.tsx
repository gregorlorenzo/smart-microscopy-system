import { Microscope, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Microscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Smart Microscopy</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Digital Specimen Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <Wifi className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 hidden sm:inline">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full">
              <WifiOff className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-700">Offline</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
