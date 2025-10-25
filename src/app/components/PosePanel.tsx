// components/PosePanel.tsx
import React, { useRef, useEffect } from 'react';
import { PoseDataItem } from '../types/yoga.types';
import { POSE_KEYWORDS } from '../constants/yoga.constants';

interface PosePanelProps {
  posesData: PoseDataItem[];
  selectedPoseIndex: number | null;
  currentPose: string;
  confidence: number;
  poseCount: number;
  onSelectPose: (index: number) => void;
}

const PosePanel: React.FC<PosePanelProps> = ({
  posesData,
  selectedPoseIndex,
  currentPose,
  confidence,
  poseCount,
  onSelectPose
}) => {
  const imageDivRef = useRef<HTMLDivElement | null>(null);
  const detectedImageDivRef = useRef<HTMLDivElement | null>(null);

  // Target pose image (selected by user)
  useEffect(() => {
    if (!imageDivRef.current) return;

    let imageUrl = '/poses/unknown-pose.jpg';
    let altText = 'Unknown Pose';

    if (selectedPoseIndex !== null && posesData[selectedPoseIndex]) {
      imageUrl = posesData[selectedPoseIndex].image;
      altText = posesData[selectedPoseIndex].name;
    }

    imageDivRef.current.innerHTML = `
      <img src="${imageUrl}" alt="${altText}" class="w-full h-full object-contain" />
    `;
  }, [selectedPoseIndex, posesData]);

  // Detected pose image (what camera sees)
  useEffect(() => {
    if (!detectedImageDivRef.current || !posesData.length) return;

    let imageUrl = '/poses/unknown-pose.jpg';
    let altText = 'No Pose Detected';

    if (currentPose && currentPose !== 'Unknown' && currentPose !== 'Unknown Pose' && currentPose !== 'No pose detected') {
      const detectedPoseName = currentPose.split('(')[0].trim().toLowerCase();

      // Try to find exact match
      const matchedPose = posesData.find(p => {
        const poseName = p.name.toLowerCase();
        return poseName.includes(detectedPoseName) ||
               detectedPoseName.includes(poseName.split('(')[0].trim().toLowerCase());
      });

      if (matchedPose) {
        imageUrl = matchedPose.image;
        altText = matchedPose.name;
      } else {
        // Partial keyword matching
        for (const keyword of POSE_KEYWORDS) {
          if (detectedPoseName.includes(keyword)) {
            const keywordMatch = posesData.find(p => p.name.toLowerCase().includes(keyword));
            if (keywordMatch) {
              imageUrl = keywordMatch.image;
              altText = keywordMatch.name;
              break;
            }
          }
        }
      }
    }

    detectedImageDivRef.current.innerHTML = `
      <img src="${imageUrl}" alt="${altText}" class="w-full h-full object-contain" />
    `;
  }, [currentPose, posesData, confidence]);

  const isMatch = selectedPoseIndex !== null &&
                  posesData[selectedPoseIndex] &&
                  currentPose !== 'Unknown' &&
                  currentPose.toLowerCase().includes(
                    posesData[selectedPoseIndex].name.toLowerCase().split('(')[0].trim().toLowerCase()
                  );

  return (
    <div className="lg:col-span-1">
      <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl p-3 sm:p-4 md:p-6">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">Target Pose</h2>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-600">{poseCount}</div>
            <div className="text-xs md:text-sm text-gray-600">Poses!</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg md:rounded-xl p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 md:mb-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-2 sm:mb-3">
            {/* Target Pose */}
            <div className="flex flex-col items-center">
              <div className="text-xs sm:text-sm font-semibold text-purple-700 mb-2">🎯 Target</div>
              <div ref={imageDivRef} className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 flex-shrink-0 bg-white rounded-lg overflow-hidden shadow-md flex items-center justify-center" />
              <p className="text-xs sm:text-sm font-semibold text-gray-800 mt-2 text-center leading-tight">
                {selectedPoseIndex !== null && posesData[selectedPoseIndex]
                  ? posesData[selectedPoseIndex].name
                  : 'Not Selected'}
              </p>
            </div>

            {/* Detected Pose */}
            <div className="flex flex-col items-center">
              <div className="text-xs sm:text-sm font-semibold text-green-700 mb-2">👁️ Detected</div>
              <div ref={detectedImageDivRef} className={`w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 flex-shrink-0 bg-white rounded-lg overflow-hidden shadow-md flex items-center justify-center transition-all ${
                currentPose !== 'Unknown' && currentPose !== 'Unknown Pose' && currentPose !== 'No pose detected'
                  ? 'ring-2 ring-green-400'
                  : ''
              }`} />
              <p className={`text-xs sm:text-sm font-semibold mt-2 text-center leading-tight ${
                currentPose !== 'Unknown' && currentPose !== 'Unknown Pose' && currentPose !== 'No pose detected'
                  ? 'text-green-600'
                  : 'text-gray-500'
              }`}>
                {currentPose === 'Unknown' || currentPose === 'Unknown Pose' || currentPose === 'No pose detected'
                  ? 'None'
                  : currentPose.split('(')[0].trim()}
              </p>
            </div>
          </div>

          {/* Confidence Bar */}
          <div className="mt-3 sm:mt-4">
            <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1">
              <span>Confidence</span>
              <span className="font-semibold">{confidence}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
              <div
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  confidence >= 70 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                  confidence >= 40 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                  'bg-gradient-to-r from-red-400 to-red-500'
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>

            {/* Match indicator */}
            {selectedPoseIndex !== null && posesData[selectedPoseIndex] && currentPose !== 'Unknown' && (
              <div className="mt-2 text-center">
                {isMatch ? (
                  <div className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-green-600">
                    ✓ Great job! Nannu is proud! 🌟
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-orange-600">
                    ⚠ Different pose – Keep trying!
                  </div>
                )}
              </div>
            )}

            <p className="mt-2 text-xs text-gray-600 leading-tight text-center">
              {selectedPoseIndex !== null && posesData[selectedPoseIndex]
                ? posesData[selectedPoseIndex].description
                : 'Select a pose below to practice with Nannu!'}
            </p>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-800">Pick a Pose 🎨</h3>
          <div className="max-h-48 sm:max-h-64 md:max-h-96 overflow-y-auto">
            <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {posesData.map((p, idx) => (
                <li key={p.name} className="cursor-pointer" onClick={() => onSelectPose(idx)}>
                  <div className={`p-0.5 sm:p-1 rounded-md border-2 ${selectedPoseIndex === idx ? 'border-purple-500' : 'border-transparent'} hover:shadow-lg transition-all`}>
                    <div className="w-full h-16 sm:h-20 bg-pink-50 rounded-md flex items-center justify-center overflow-hidden">
                      <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="text-xs text-center mt-0.5 sm:mt-1 line-clamp-2">{p.name}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-3 sm:mt-4 md:mt-6 p-2 sm:p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-gray-600 leading-tight">
            <strong>Nannu's Tip:</strong> Good lighting and full body visibility help with better pose detection! 💡
          </p>
        </div>
      </div>
    </div>
  );
};

export default PosePanel;