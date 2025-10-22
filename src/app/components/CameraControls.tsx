// components/CameraControls.tsx
import React from 'react';
import { Camera, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';
import { CONFIDENCE_PRESETS, ConfidenceLevel } from '../constants/yoga.constants';

interface CameraControlsProps {
  isModelLoaded: boolean;
  isCameraOn: boolean;
  isCameraLoading: boolean;
  soundEnabled: boolean;
  zoom: number;
  confidenceLevel: ConfidenceLevel;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onSwitchCamera: () => void;
  onToggleSound: () => void;
  onZoom: (direction: 'in' | 'out' | 'reset') => void;
  onConfidenceLevelChange: (level: ConfidenceLevel) => void;
}

const CameraControls: React.FC<CameraControlsProps> = ({
  isModelLoaded,
  isCameraOn,
  isCameraLoading,
  soundEnabled,
  zoom,
  confidenceLevel,
  onStartCamera,
  onStopCamera,
  onSwitchCamera,
  onToggleSound,
  onZoom,
  onConfidenceLevelChange
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

      {/* Zoom Controls */}
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

      {/* Confidence Level Controls */}
      <div className="bg-gray-50 rounded-lg p-3 md:p-4">
        <div className="text-center mb-2">
          <h3 className="text-sm md:text-base font-semibold text-gray-700">
            Confidence Threshold: {CONFIDENCE_PRESETS[confidenceLevel].label} ({Math.round(CONFIDENCE_PRESETS[confidenceLevel].value * 100)}%)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Higher = Stricter pose matching
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          {(Object.keys(CONFIDENCE_PRESETS) as ConfidenceLevel[]).map((level) => {
            const preset = CONFIDENCE_PRESETS[level];
            const isActive = confidenceLevel === level;
            return (
              <button
                key={level}
                onClick={() => onConfidenceLevelChange(level)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm md:text-base ${
                  isActive
                    ? `${preset.color} text-white shadow-lg scale-105`
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {preset.label}
                <div className="text-xs mt-0.5 opacity-90">
                  {Math.round(preset.value * 100)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CameraControls;