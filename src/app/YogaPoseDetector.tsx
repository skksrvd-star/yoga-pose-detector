'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, AlertCircle, CheckCircle2, Loader2, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';

type Keypoint = {
  x: number;
  y: number;
  score?: number;
  name?: string;
};

type PoseDetector = {
  estimatePoses: (video: HTMLVideoElement) => Promise<any[]>;
};

interface PoseClassification {
  pose: string;
  confidence: number;
}

const YogaPoseDetector: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastKeypointsRef = useRef<Keypoint[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [currentPose, setCurrentPose] = useState('Unknown');
  const [confidence, setConfidence] = useState(0);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [error, setError] = useState('');
  const [detector, setDetector] = useState<PoseDetector | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [zoom, setZoom] = useState(1);

  // Load model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        const [tf, poseDetectionModule] = await Promise.all([
          import('@tensorflow/tfjs'),
          import('@tensorflow-models/pose-detection')
        ]);

        await tf.ready();
        await tf.setBackend('webgl');

        // Use MoveNet instead - more reliable than BlazePose
        const detectorConfig = {
          modelType: poseDetectionModule.movenet.modelType.SINGLEPOSE_LIGHTNING
        };

        const poseDetector = await poseDetectionModule.createDetector(
          poseDetectionModule.SupportedModels.MoveNet,
          detectorConfig
        );

        console.log('MoveNet model loaded successfully');
        setDetector(poseDetector);
        setIsModelLoaded(true);
        setError('');
      } catch (err) {
        console.error('Error loading model:', err);
        setError('Failed to load pose detection model. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, []);

  const startCamera = async (requestedFacingMode?: 'user' | 'environment') => {
    try {
      setIsCameraLoading(true);
      setError('');

      const mode = requestedFacingMode || facingMode;

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: mode
        }
      };

      // Try to apply zoom if supported (mainly for mobile)
      if ('mediaDevices' in navigator && 'getSupportedConstraints' in navigator.mediaDevices) {
        const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
        if (supportedConstraints.zoom && constraints.video && typeof constraints.video === 'object') {
          (constraints.video as any).zoom = zoom;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setIsCameraOn(true);
            setIsCameraLoading(false);
            setFacingMode(mode);
          } catch (playError) {
            console.error('Error playing video:', playError);
            setError('Failed to start video playback');
            setIsCameraLoading(false);
          }
        };
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Failed to access camera. Please grant camera permissions.');
      setIsCameraLoading(false);
    }
  };

  const switchCamera = async () => {
    if (!isCameraOn) return;

    // Stop current camera
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }

    // Start with opposite facing mode
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newMode);
  };

  const handleZoomIn = async () => {
    const newZoom = Math.min(zoom + 0.1, 2);
    console.log('Zoom in:', zoom, '->', newZoom);
    setZoom(newZoom);

    // Restart camera with new zoom if supported
    if (isCameraOn) {
      await applyZoomToCamera(newZoom);
    }
  };

  const handleZoomOut = async () => {
    const newZoom = Math.max(zoom - 0.1, 0.5);
    console.log('Zoom out:', zoom, '->', newZoom);
    setZoom(newZoom);

    // Restart camera with new zoom if supported
    if (isCameraOn) {
      await applyZoomToCamera(newZoom);
    }
  };

  const resetZoom = async () => {
    console.log('Reset zoom to 1.0');
    setZoom(1);

    if (isCameraOn) {
      await applyZoomToCamera(1);
    }
  };

  const applyZoomToCamera = async (zoomLevel: number) => {
    if (!videoRef.current?.srcObject) return;

    const stream = videoRef.current.srcObject as MediaStream;
    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack) return;

    try {
      const capabilities = videoTrack.getCapabilities();
      console.log('Camera capabilities:', capabilities);

      if ('zoom' in capabilities) {
        const constraints = {
          advanced: [{ zoom: zoomLevel } as any]
        };
        await videoTrack.applyConstraints(constraints);
        console.log('Hardware zoom applied:', zoomLevel);
      } else {
        console.log('Hardware zoom not supported, using CSS zoom');
      }
    } catch (err) {
      console.log('Could not apply zoom constraint:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setCurrentPose('Unknown');
    setConfidence(0);
    lastKeypointsRef.current = [];

    // Clear the canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const calculateAngle = (a: Keypoint, b: Keypoint, c: Keypoint): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  const classifyPose = (keypoints: Keypoint[]): PoseClassification => {
    if (!keypoints || keypoints.length < 17) return { pose: 'Unknown', confidence: 0 };

    // MoveNet uses COCO format with 17 keypoints
    const nose = keypoints[0];
    const leftEye = keypoints[1];
    const rightEye = keypoints[2];
    const leftEar = keypoints[3];
    const rightEar = keypoints[4];
    const leftShoulder = keypoints[5];
    const rightShoulder = keypoints[6];
    const leftElbow = keypoints[7];
    const rightElbow = keypoints[8];
    const leftWrist = keypoints[9];
    const rightWrist = keypoints[10];
    const leftHip = keypoints[11];
    const rightHip = keypoints[12];
    const leftKnee = keypoints[13];
    const rightKnee = keypoints[14];
    const leftAnkle = keypoints[15];
    const rightAnkle = keypoints[16];

    const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const leftLegAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightLegAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const leftShoulderAngle = calculateAngle(leftElbow, leftShoulder, leftHip);
    const rightShoulderAngle = calculateAngle(rightElbow, rightShoulder, rightHip);
    const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
    const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);

    const avgConfidence = keypoints.reduce((sum, kp) => sum + (kp.score || 0), 0) / keypoints.length;

    // Calculate body orientation
    const hipCenterY = (leftHip.y + rightHip.y) / 2;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    const torsoVertical = Math.abs(shoulderCenterY - hipCenterY);

    // Tree Pose - one leg bent, other straight, arms up or at chest
    if ((leftLegAngle > 160 && rightKnee.y < rightHip.y - 30) ||
        (rightLegAngle > 160 && leftKnee.y < leftHip.y - 30)) {
      if (leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y) {
        return { pose: 'Tree Pose - Arms Up (Vrksasana)', confidence: avgConfidence };
      }
      return { pose: 'Tree Pose (Vrksasana)', confidence: avgConfidence };
    }

    // Warrior I - lunge position with arms raised
    if ((leftLegAngle < 130 && rightLegAngle > 150) || (rightLegAngle < 130 && leftLegAngle > 150)) {
      if (leftWrist.y < leftShoulder.y - 50 && rightWrist.y < rightShoulder.y - 50) {
        return { pose: 'Warrior I (Virabhadrasana I)', confidence: avgConfidence };
      }
    }

    // Warrior II - lunge with arms extended horizontally
    if ((leftLegAngle < 130 && rightLegAngle > 150) || (rightLegAngle < 130 && leftLegAngle > 150)) {
      const armsHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 50 &&
                             Math.abs(rightWrist.y - rightShoulder.y) < 50;
      if (armsHorizontal) {
        return { pose: 'Warrior II (Virabhadrasana II)', confidence: avgConfidence };
      }
    }

    // Warrior III - standing on one leg, body horizontal
    const bodyHorizontal = shoulderCenterY > hipCenterY - 50;
    if ((leftLegAngle > 160 && rightHip.y < rightShoulder.y) ||
        (rightLegAngle > 160 && leftHip.y < leftShoulder.y)) {
      if (bodyHorizontal && (leftWrist.y < leftShoulder.y || rightWrist.y < rightShoulder.y)) {
        return { pose: 'Warrior III (Virabhadrasana III)', confidence: avgConfidence };
      }
    }

    // Triangle Pose - legs wide, one arm up, one arm down
    const legsWide = Math.abs(leftAnkle.x - rightAnkle.x) > 150;
    if (legsWide && leftLegAngle > 160 && rightLegAngle > 160) {
      if ((leftWrist.y < leftShoulder.y - 50 && rightWrist.y > rightHip.y) ||
          (rightWrist.y < rightShoulder.y - 50 && leftWrist.y > leftHip.y)) {
        return { pose: 'Triangle Pose (Trikonasana)', confidence: avgConfidence };
      }
    }

    // Chair Pose - knees bent, arms raised
    if (leftLegAngle < 140 && rightLegAngle < 140 && leftLegAngle > 70 && rightLegAngle > 70) {
      if (leftWrist.y < leftShoulder.y - 50 && rightWrist.y < rightShoulder.y - 50) {
        return { pose: 'Chair Pose (Utkatasana)', confidence: avgConfidence };
      }
    }

    // Plank Pose
    const torsoAngle = Math.abs(
      Math.atan2(leftHip.y - leftShoulder.y, leftHip.x - leftShoulder.x) * 180 / Math.PI
    );
    if (torsoAngle < 30 && leftArmAngle > 150 && rightArmAngle > 150 &&
        leftLegAngle > 150 && shoulderCenterY < hipCenterY + 50) {
      return { pose: 'Plank Pose (Phalakasana)', confidence: avgConfidence };
    }

    // Side Plank - body sideways, one arm supporting
    const armSupporting = (leftWrist.y > leftShoulder.y + 50 && leftElbow.y > leftShoulder.y) ||
                          (rightWrist.y > rightShoulder.y + 50 && rightElbow.y > rightShoulder.y);
    if (armSupporting && Math.abs(leftHip.x - rightHip.x) < 80) {
      return { pose: 'Side Plank (Vasisthasana)', confidence: avgConfidence };
    }

    // Downward Dog
    if (leftElbow.y > leftShoulder.y && rightElbow.y > rightShoulder.y &&
        leftHip.y < leftShoulder.y && rightHip.y < rightShoulder.y &&
        leftHipAngle < 120 && rightHipAngle < 120) {
      return { pose: 'Downward Dog (Adho Mukha Svanasana)', confidence: avgConfidence };
    }

    // Upward Dog - chest up, arms straight, legs on ground
    if (shoulderCenterY < hipCenterY - 50 && leftArmAngle > 150 && rightArmAngle > 150 &&
        leftWrist.y > leftShoulder.y + 50) {
      return { pose: 'Upward Dog (Urdhva Mukha Svanasana)', confidence: avgConfidence };
    }

    // Cobra Pose - similar to upward dog but more bent arms
    if (shoulderCenterY < hipCenterY - 30 && leftArmAngle < 150 && rightArmAngle < 150 &&
        leftWrist.y > leftShoulder.y) {
      return { pose: 'Cobra Pose (Bhujangasana)', confidence: avgConfidence };
    }

    // Child's Pose
    if (leftKnee.y > leftHip.y && rightKnee.y > rightHip.y &&
        leftShoulder.y > leftHip.y && rightShoulder.y > rightHip.y &&
        nose.y > shoulderCenterY) {
      return { pose: 'Child\'s Pose (Balasana)', confidence: avgConfidence };
    }

    // Bridge Pose - lying on back, hips raised
    if (shoulderCenterY > hipCenterY + 50 && leftKnee.y > leftHip.y && rightKnee.y > rightHip.y &&
        leftHipAngle > 140 && rightHipAngle > 140) {
      return { pose: 'Bridge Pose (Setu Bandhasana)', confidence: avgConfidence };
    }

    // Seated Forward Bend
    if (leftLegAngle > 160 && rightLegAngle > 160 &&
        leftHip.y < leftKnee.y && rightHip.y < rightKnee.y &&
        shoulderCenterY > hipCenterY && nose.y > leftKnee.y) {
      return { pose: 'Seated Forward Bend (Paschimottanasana)', confidence: avgConfidence };
    }

    // Camel Pose - kneeling, back arched, hands reaching back
    if (leftKnee.y > leftHip.y - 50 && rightKnee.y > rightHip.y - 50 &&
        shoulderCenterY < hipCenterY - 50 &&
        leftWrist.y > leftHip.y && rightWrist.y > rightHip.y) {
      return { pose: 'Camel Pose (Ustrasana)', confidence: avgConfidence };
    }

    // T-Pose / Extended Mountain with arms out
    if (leftArmAngle > 160 && rightArmAngle > 160 && leftLegAngle > 160 && rightLegAngle > 160) {
      if (Math.abs(leftWrist.y - leftShoulder.y) < 30 && Math.abs(rightWrist.y - rightShoulder.y) < 30) {
        return { pose: 'T-Pose / Extended Mountain', confidence: avgConfidence };
      }

      // Mountain Pose with arms up
      if (leftWrist.y < leftShoulder.y - 50 && rightWrist.y < rightShoulder.y - 50) {
        return { pose: 'Mountain Pose - Arms Up (Tadasana)', confidence: avgConfidence };
      }

      return { pose: 'Mountain Pose (Tadasana)', confidence: avgConfidence };
    }

    // Standing Forward Bend
    if (leftLegAngle > 160 && rightLegAngle > 160 &&
        shoulderCenterY > hipCenterY + 100 && nose.y > hipCenterY) {
      return { pose: 'Standing Forward Bend (Uttanasana)', confidence: avgConfidence };
    }

    // Default standing
    if (leftLegAngle > 160 && rightLegAngle > 160) {
      return { pose: 'Standing Position', confidence: avgConfidence };
    }

    return { pose: 'Unknown Pose', confidence: avgConfidence };
  };

  const drawSkeleton = (keypoints: Keypoint[], detectedPose: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!keypoints || keypoints.length === 0) return;

    // Determine color based on detected pose
    const isPoseDetected = detectedPose !== 'Unknown Pose' &&
                           detectedPose !== 'Standing Position' &&
                           detectedPose !== 'Unknown';

    const skeletonColor = isPoseDetected ? '#00FF00' : '#FFAA00'; // Green if pose detected, orange otherwise
    const lineWidth = isPoseDetected ? 6 : 4; // Thicker lines when pose is detected

    const connections: [number, number][] = [
      [5, 7], [7, 9],    // Left arm
      [6, 8], [8, 10],   // Right arm
      [5, 6],            // Shoulders
      [5, 11], [6, 12],  // Torso
      [11, 12],          // Hips
      [11, 13], [13, 15], // Left leg
      [12, 14], [14, 16], // Right leg
      [0, 1], [0, 2],    // Face
      [1, 3], [2, 4],    // Ears
    ];

    // Draw connection lines with glow effect
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Add glow effect for detected poses
    if (isPoseDetected) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = skeletonColor;
    }

    for (const [idx1, idx2] of connections) {
      const kp1 = keypoints[idx1];
      const kp2 = keypoints[idx2];

      if (kp1 && kp2 && (kp1.score || 0) > 0.3 && (kp2.score || 0) > 0.3) {
        // Draw outer glow
        ctx.strokeStyle = skeletonColor;
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw keypoints with enhanced visibility
    for (const kp of keypoints) {
      if (kp && (kp.score || 0) > 0.3) {
        // Outer glow circle
        if (isPoseDetected) {
          ctx.fillStyle = skeletonColor + '40'; // Semi-transparent
          ctx.beginPath();
          ctx.arc(kp.x, kp.y, 12, 0, Math.PI * 2);
          ctx.fill();
        }

        // Main circle
        ctx.fillStyle = skeletonColor;
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw pose name on canvas when detected
    if (isPoseDetected) {
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#00FF00';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      // Draw text with outline for better visibility
      const text = detectedPose.split('(')[0].trim();
      const textWidth = ctx.measureText(text).width;
      const x = (canvas.width - textWidth) / 2;
      const y = 40;

      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    }
  };

  const detectPose = async () => {
    if (!videoRef.current || !detector) {
      return;
    }

    const video = videoRef.current;

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    try {
      const poses = await detector.estimatePoses(video);

      if (poses && poses.length > 0 && poses[0].keypoints) {
        const rawKeypoints = poses[0].keypoints;

        // MoveNet already returns pixel coordinates, not normalized!
        const keypoints = rawKeypoints.map((kp: any) => ({
          x: kp.x,
          y: kp.y,
          score: kp.score || 0,
          name: kp.name
        }));

        if (!isNaN(keypoints[0].x) && !isNaN(keypoints[0].y)) {
          lastKeypointsRef.current = keypoints;

          const { pose, confidence } = classifyPose(keypoints);
          setCurrentPose(pose);
          setConfidence(Math.round(confidence * 100));
        } else {
          console.error('Invalid coordinates after scaling:', keypoints[0]);
          setCurrentPose('No pose detected');
          setConfidence(0);
        }
      } else {
        setCurrentPose('No pose detected');
        setConfidence(0);
      }
    } catch (err) {
      console.error('Detection error:', err);
    }
  };

  useEffect(() => {
    if (!isCameraOn) return;

    let frameId: number | null = null;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video && video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        drawSkeleton(lastKeypointsRef.current, currentPose);
      }

      frameId = requestAnimationFrame(renderLoop);
    };

    frameId = requestAnimationFrame(renderLoop);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isCameraOn]);

  useEffect(() => {
    if (!isCameraOn || !detector) return;

    const startDelay = setTimeout(() => {
      const intervalId = setInterval(() => {
        detectPose();
      }, 500); // Faster detection - every 500ms

      return () => {
        clearInterval(intervalId);
      };
    }, 500); // Shorter initial delay

    return () => {
      clearTimeout(startDelay);
    };
  }, [isCameraOn, detector]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 mb-1 md:mb-2">Yoga Pose Detector</h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">Real-time pose detection using AI</p>
        </div>

        {isLoading && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-3 py-2 md:px-4 md:py-3 rounded-lg mb-3 md:mb-4 flex items-center justify-center">
            <Loader2 className="animate-spin mr-2" size={18} />
            <span className="text-sm md:text-base">Loading AI model...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 md:px-4 md:py-3 rounded-lg mb-3 md:mb-4 flex items-center">
            <AlertCircle className="mr-2 flex-shrink-0" size={18} />
            <span className="text-xs sm:text-sm md:text-base">{error}</span>
          </div>
        )}

        {isModelLoaded && !isCameraOn && !error && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 md:px-4 md:py-3 rounded-lg mb-3 md:mb-4 flex items-center justify-center">
            <CheckCircle2 className="mr-2 flex-shrink-0" size={18} />
            <span className="text-xs sm:text-sm md:text-base">Model loaded successfully! Click Start Camera to begin.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-xl p-3 md:p-6">
              <div
                ref={containerRef}
                className="relative bg-gray-900 rounded-lg md:rounded-xl overflow-hidden"
                style={{ aspectRatio: '4/3' }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-out'
                  }}
                >
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      zIndex: 50
                    }}
                  />
                </div>

                {!isCameraOn && !isCameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <Camera size={64} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Camera is off</p>
                    </div>
                  </div>
                )}

                {isCameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-20">
                    <div className="text-center text-white">
                      <Loader2 className="animate-spin mx-auto mb-2" size={48} />
                      <p>Starting camera...</p>
                    </div>
                  </div>
                )}

                {/* Zoom Controls Overlay */}
                {isCameraOn && (
                  <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-30">
                    <button
                      onClick={handleZoomIn}
                      disabled={zoom >= 2}
                      className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title="Zoom In"
                    >
                      <ZoomIn size={20} className="text-gray-800" />
                    </button>
                    <button
                      onClick={resetZoom}
                      className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg transition-all text-xs font-bold text-gray-800"
                      title="Reset Zoom"
                    >
                      {zoom.toFixed(1)}x
                    </button>
                    <button
                      onClick={handleZoomOut}
                      disabled={zoom <= 0.5}
                      className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title="Zoom Out"
                    >
                      <ZoomOut size={20} className="text-gray-800" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 md:mt-4 flex flex-col sm:flex-row gap-2 md:gap-3 justify-center">
                <button
                  onClick={() => startCamera()}
                  disabled={!isModelLoaded || isCameraOn || isCameraLoading}
                  className="px-4 md:px-6 py-2 md:py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <Camera size={18} />
                  {isCameraLoading ? 'Starting...' : 'Start Camera'}
                </button>
                <button
                  onClick={switchCamera}
                  disabled={!isCameraOn}
                  className="px-4 md:px-6 py-2 md:py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <SwitchCamera size={18} />
                  Switch
                </button>
                <button
                  onClick={stopCamera}
                  disabled={!isCameraOn}
                  className="px-4 md:px-6 py-2 md:py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm md:text-base"
                >
                  Stop Camera
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-xl p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 md:mb-4">Current Pose</h2>

              <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg md:rounded-xl p-4 md:p-6 mb-4 md:mb-6">
                <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
                  {/* Pose Image */}
                  <div className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0 bg-white rounded-lg overflow-hidden shadow-md">
                    <img
                      src={`/poses/${currentPose.toLowerCase().split('(')[0].trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.jpg`}
                      alt={currentPose}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to emoji if image not found
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.emoji-fallback')) {
                          const fallback = document.createElement('div');
                          fallback.className = 'emoji-fallback w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-purple-50 to-blue-50';
                          fallback.textContent =
                            currentPose.includes('Tree') ? '🌳' :
                            currentPose.includes('Mountain') ? '⛰️' :
                            currentPose.includes('Warrior I') ? '🗡️' :
                            currentPose.includes('Warrior II') ? '⚔️' :
                            currentPose.includes('Warrior III') ? '🏹' :
                            currentPose.includes('Triangle') ? '🔺' :
                            currentPose.includes('Chair') ? '🪑' :
                            currentPose.includes('Side Plank') ? '📐' :
                            currentPose.includes('Plank') ? '🏋️' :
                            currentPose.includes('Downward Dog') ? '🐕' :
                            currentPose.includes('Upward Dog') ? '🐕‍🦺' :
                            currentPose.includes('Cobra') ? '🐍' :
                            currentPose.includes('Child') ? '👶' :
                            currentPose.includes('Bridge') ? '🌉' :
                            currentPose.includes('Forward Bend') ? '🤸' :
                            currentPose.includes('Camel') ? '🐪' :
                            currentPose.includes('T-Pose') ? '✝️' :
                            currentPose.includes('Standing') ? '🧍' : '❓';
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  </div>

                  {/* Pose Name and Confidence */}
                  <div className="flex-1 min-w-0 text-center md:text-left w-full">
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-2 break-words overflow-wrap-anywhere">
                      {currentPose}
                    </p>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs md:text-sm text-gray-600 mb-1">
                        <span>Confidence</span>
                        <span className="font-semibold">{confidence}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${confidence}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <h3 className="text-base md:text-lg font-semibold text-gray-800">Detectable Poses:</h3>
                <div className="max-h-64 md:max-h-96 overflow-y-auto">
                  <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-gray-600 pr-2">
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">⛰️</span>
                      <span>Mountain Pose (Tadasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🌳</span>
                      <span>Tree Pose (Vrksasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">⚔️</span>
                      <span>Warrior I, II, III (Virabhadrasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🔺</span>
                      <span>Triangle Pose (Trikonasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🪑</span>
                      <span>Chair Pose (Utkatasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🏋️</span>
                      <span>Plank & Side Plank</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🐕</span>
                      <span>Downward & Upward Dog</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🐍</span>
                      <span>Cobra Pose (Bhujangasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">👶</span>
                      <span>Child's Pose (Balasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🌉</span>
                      <span>Bridge Pose (Setu Bandhasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🤸</span>
                      <span>Forward Bends (Uttanasana)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 flex-shrink-0 text-lg">🐪</span>
                      <span>Camel Pose (Ustrasana)</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 md:mt-6 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>Note:</strong> Ensure good lighting and stand within the camera frame with your full body visible.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 md:mt-8 text-center text-gray-600">
          <p className="text-xs md:text-sm">
            Built with TensorFlow.js MoveNet • Real-time AI Pose Detection
          </p>
        </div>
      </div>
    </div>
  );
};

export default YogaPoseDetector;