// components/CameraControls.tsx
import React from 'react';
import { Camera, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';

interface CameraControlsProps {
  isModelLoaded: boolean;
  isCameraOn: boolean;
  isCameraLoading: boolean;
  soundEnabled: boolean;
  zoom: number;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onSwitchCamera: () => void;
  onToggleSound: () => void;
  onZoom: (direction: 'in' | 'out' | 'reset') => void;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  isModelLoaded,
  isCameraOn,
  isCameraLoading,
  soundEnabled,
  zoom,
  onStartCamera,
  onStopCamera,
  onSwitchCamera,
  onToggleSound,
  onZoom
}) => {
  return (
    <div className="mt-3 md:mt-4 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2 md:gap-3 justify-center">
        <button
          onClick={onStartCamera}
          disabled={!isModelLoaded || isCameraOn || isCameraLoading}
          className="px-4 md:px-6 py-2 md:py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
        >
          <Camera size={18} />
          {isCameraLoading ? 'Starting...' : 'Start Camera'}
        </button>
        <button
          onClick={onSwitchCamera}
          disabled={!isCameraOn}
          className="px-4 md:px-6 py-2 md:py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
        >
          <SwitchCamera size={18} />
          Switch
        </button>
        <button
          onClick={onToggleSound}
          className={`px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm md:text-base ${
            soundEnabled
              ? 'bg-purple-500 hover:bg-purple-600 text-white'
              : 'bg-gray-400 hover:bg-gray-500 text-white'
          }`}
        >
          {soundEnabled ? '🔊' : '🔇'}
          {soundEnabled ? 'Sound ON' : 'Sound OFF'}
        </button>
        <button
          onClick={onStopCamera}
          disabled={!isCameraOn}
          className="px-4 md:px-6 py-2 md:py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm md:text-base"
        >
          Stop Camera
        </button>
      </div>
      <div className="flex gap-2 justify-center items-center">
        <button
          onClick={() => onZoom('out')}
          disabled={!isCameraOn || zoom <= 0.5}
          className="px-3 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm"
        >
          <ZoomOut size={16} />
          Zoom Out
        </button>
        <button
          onClick={() => onZoom('reset')}
          disabled={!isCameraOn || zoom === 1}
          className="px-3 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
        >
          Reset ({zoom.toFixed(1)}x)
        </button>
        <button
          onClick={() => onZoom('in')}
          disabled={!isCameraOn || zoom >= 2}
          className="px-3 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm"
        >
          <ZoomIn size={16} />
          Zoom In
        </button>
      </div>
    </div>
  );
};

export default CameraControls;