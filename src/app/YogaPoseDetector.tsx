'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keypoint, PoseDataItem } from './types/yoga.types';
import { POSES_JSON_PATH, CONFIDENCE_PRESETS, ConfidenceLevel } from './constants/yoga.constants';
import { loadPoseModel, loadPosesData } from './utils/dataLoader';
import { classifyPose } from './utils/poseClassifier';
import { drawSkeleton } from './utils/skeletonDrawer';
import { playSuccessSound } from './utils/soundUtils';
import CameraControls from './components/CameraControls';
import PosePanel from './components/PosePanel';

const YogaPoseDetector: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastKeypointsRef = useRef<Keypoint[]>([]);
  const landmarkerRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState('');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [zoom, setZoom] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>('medium');
  const [currentPose, setCurrentPose] = useState('Unknown');
  const [confidence, setConfidence] = useState(0);
  const [poseCount, setPoseCount] = useState(0);
  const [lastDetectedPose, setLastDetectedPose] = useState('');
  const [posesData, setPosesData] = useState<PoseDataItem[]>([]);
  const [selectedPoseIndex, setSelectedPoseIndex] = useState<number | null>(null);
  const [matchedPose, setMatchedPose] = useState<PoseDataItem | null>(null);

  // Load model
  useEffect(() => {
    let cancelled = false;
    loadPoseModel(setIsLoading, setIsModelLoaded, setError, landmarkerRef, cancelled);
    return () => { cancelled = true; };
  }, []);

  // Load poses JSON
  useEffect(() => {
    loadPosesData(POSES_JSON_PATH, setPosesData, setError);
  }, []);

  // Reset pose count when confidence level changes
  const handleConfidenceLevelChange = (level: ConfidenceLevel) => {
    setConfidenceLevel(level);
    setPoseCount(0); // reset count
    setLastDetectedPose('');
    setMatchedPose(null);
    setCurrentPose('Unknown');
  };

  // Camera control functions
  const startCamera = async (requestedFacingMode?: 'user' | 'environment') => {
    try {
      setIsCameraLoading(true);
      setError('');
      const mode = requestedFacingMode ?? facingMode;
      const constraints: MediaStreamConstraints = {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: mode },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setIsCameraOn(true);
            setIsCameraLoading(false);
            setFacingMode(mode);
          } catch (playErr) {
            console.error('Video play error', playErr);
            setError('Failed to play camera stream.');
            setIsCameraLoading(false);
          }
        };
      }
    } catch (err) {
      console.error('Camera start error', err);
      setError('Failed to access camera (permission denied or no camera).');
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setCurrentPose('Unknown');
    setConfidence(0);
    setLastDetectedPose('');
    lastKeypointsRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const switchCamera = async () => {
    if (!isCameraOn) return;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newMode);
  };

  const applyZoomToCamera = async (zoomLevel: number) => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = (track as any).getCapabilities?.();
      if (caps && 'zoom' in caps) {
        await track.applyConstraints({ advanced: [{ zoom: zoomLevel } as any] });
      }
    } catch (err) {
      console.warn('Zoom not supported on this device', err);
    }
  };

  const handleZoom = async (direction: 'in' | 'out' | 'reset') => {
    let newZoom = zoom;
    if (direction === 'in') newZoom = Math.min(zoom + 0.1, 2);
    else if (direction === 'out') newZoom = Math.max(zoom - 0.1, 0.5);
    else newZoom = 1;

    setZoom(newZoom);
    if (isCameraOn) await applyZoomToCamera(newZoom);
  };

  // Detection loop
  useEffect(() => {
    if (!isCameraOn || !landmarkerRef.current || !videoRef.current) return;

    let raf = 0;
    let lastVideoTime = -1;
    const landmarker = landmarkerRef.current;

    const loop = async () => {
      const video = videoRef.current!;
      if (!video || video.readyState < 2) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (video.currentTime === lastVideoTime) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastVideoTime = video.currentTime;

      try {
        const result = landmarker.detectForVideo(video, performance.now());
        const lm = result.landmarks?.[0] ?? null;

        if (lm && video) {
          const keypoints: Keypoint[] = lm.map((p: any, i: number) => ({
            x: (p.x ?? 0) * video.videoWidth,
            y: (p.y ?? 0) * video.videoHeight,
            score: p.visibility ?? 0.5,
            name: `kp${i}`
          }));
          lastKeypointsRef.current = keypoints;

          const { pose, confidence: conf } = classifyPose(keypoints);
          setCurrentPose(pose);
          setConfidence(Math.round(conf * 100));

          // --- MATCH WITH JSON POSES ---
          const foundPose = posesData.find(p => p.name === pose) || null;
          setMatchedPose(foundPose);

          if (foundPose) {
            const index = posesData.indexOf(foundPose);
            if (index !== selectedPoseIndex) setSelectedPoseIndex(index);
          } else {
            setSelectedPoseIndex(null);
          }

          // --- CONFIDENCE CHECK ---
          const minConfidence = CONFIDENCE_PRESETS[confidenceLevel].value;
          const isPoseDetected =
            pose !== 'Unknown Pose' &&
            pose !== 'Unknown' &&
            pose !== 'No pose detected' &&
            conf >= minConfidence;

          // --- COUNT DETECTIONS ---
          if (isPoseDetected && pose !== lastDetectedPose) {
            setLastDetectedPose(pose);
            setPoseCount(prev => prev + 1);
            playSuccessSound(soundEnabled);
          } else if (!isPoseDetected) {
            setLastDetectedPose('');
          }
        } else {
          setCurrentPose('No pose detected');
          setConfidence(0);
          setMatchedPose(null);
          lastKeypointsRef.current = [];
          setLastDetectedPose('');
        }
      } catch (e) {
        console.error('Detection error', e);
      }

      drawSkeleton(canvasRef.current, videoRef.current, lastKeypointsRef.current, currentPose, confidence);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    isCameraOn,
    isModelLoaded,
    posesData,
    confidenceLevel,
    selectedPoseIndex,
    currentPose,
    confidence,
    soundEnabled,
    lastDetectedPose
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-2 sm:p-3 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-3 sm:mb-4 md:mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-2">
            Yoga Pose Trainer
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Join <b>Nannu</b> and match the pose — MediaPipe powers live tracking!
          </p>
        </div>

        {/* Status Messages */}
        {isLoading && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-3 py-2 rounded-lg mb-3 flex items-center justify-center">
            <Loader2 className="animate-spin mr-2 flex-shrink-0" size={16} />
            <span>Loading model...</span>
          </div>
        )}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg mb-3 flex items-center">
            <AlertCircle className="mr-2 flex-shrink-0" size={16} />
            <span>{error}</span>
          </div>
        )}
        {isModelLoaded && !isCameraOn && !error && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg mb-3 flex items-center justify-center">
            <CheckCircle2 className="mr-2 flex-shrink-0" size={16} />
            <span>Model ready – Nannu is waiting! Start Camera 🎉</span>
          </div>
        )}

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-3 md:p-6">
              <div className="relative bg-gray-900 rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
                >
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                </div>

                {!isCameraOn && !isCameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <Camera size={64} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Camera is off</p>
                    </div>
                  </div>
                )}
              </div>

              {/* --- Animated Pose Info Section --- */}
              <AnimatePresence>
                {matchedPose && (
                  <motion.div
                    key={matchedPose.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.4 }}
                    className="mt-4 flex flex-col sm:flex-row items-center sm:items-start gap-4"
                  >
                    <img
                      src={matchedPose.image}
                      alt={matchedPose.name}
                      className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-xl shadow-md border border-gray-200"
                    />
                    <div className="text-center sm:text-left">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{matchedPose.name}</h3>
                      <p className="text-sm sm:text-base text-gray-600 mt-1">{matchedPose.description}</p>
                      <p className="mt-2 text-sm text-blue-600 font-medium">Confidence: {confidence}%</p>
                      <p className="mt-1 text-sm text-green-600 font-semibold">Pose Count: {poseCount}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Camera Controls */}
              <CameraControls
                isModelLoaded={isModelLoaded}
                isCameraOn={isCameraOn}
                isCameraLoading={isCameraLoading}
                soundEnabled={soundEnabled}
                zoom={zoom}
                confidenceLevel={confidenceLevel}
                onStartCamera={startCamera}
                onStopCamera={stopCamera}
                onSwitchCamera={switchCamera}
                onToggleSound={() => setSoundEnabled(!soundEnabled)}
                onZoom={handleZoom}
                onConfidenceLevelChange={handleConfidenceLevelChange}
              />
            </div>
          </div>

          <PosePanel
            posesData={posesData}
            selectedPoseIndex={selectedPoseIndex}
            currentPose={currentPose}
            confidence={confidence}
            poseCount={poseCount}
            onSelectPose={setSelectedPoseIndex}
          />
        </div>

        <div className="mt-6 text-center text-gray-600 text-sm">
          Built with MediaPipe Pose Landmarker • Real-time Yoga Tracking 🧘‍♂️
        </div>
      </div>
    </div>
  );
};

export default YogaPoseDetector;
