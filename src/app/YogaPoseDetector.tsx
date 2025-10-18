'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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

  const startCamera = async () => {
    try {
      setIsCameraLoading(true);
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setIsCameraOn(true);
            setIsCameraLoading(false);
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
      }, 2000);

      return () => {
        clearInterval(intervalId);
      };
    }, 1000);

    return () => {
      clearTimeout(startDelay);
    };
  }, [isCameraOn, detector]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">Yoga Pose Detector</h1>
          <p className="text-gray-600 text-base md:text-lg">Real-time pose detection using AI</p>
        </div>

        {isLoading && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg mb-4 flex items-center justify-center">
            <Loader2 className="animate-spin mr-2" size={20} />
            <span>Loading AI model...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
            <AlertCircle className="mr-2 flex-shrink-0" size={20} />
            <span className="text-sm md:text-base">{error}</span>
          </div>
        )}

        {isModelLoaded && !isCameraOn && !error && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center justify-center">
            <CheckCircle2 className="mr-2 flex-shrink-0" size={20} />
            <span className="text-sm md:text-base">Model loaded successfully! Click Start Camera to begin.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
              <div
                ref={containerRef}
                className="relative bg-gray-900 rounded-xl overflow-hidden"
                style={{ aspectRatio: '4/3' }}
              >
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 50
                  }}
                />

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
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={startCamera}
                  disabled={!isModelLoaded || isCameraOn || isCameraLoading}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Camera size={20} />
                  {isCameraLoading ? 'Starting...' : 'Start Camera'}
                </button>
                <button
                  onClick={stopCamera}
                  disabled={!isCameraOn}
                  className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Stop Camera
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Current Pose</h2>

              <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl p-6 mb-6">
                <p className="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-2 break-words">
                  {currentPose}
                </p>
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
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

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Detectable Poses:</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Mountain Pose (Tadasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Tree Pose (Vrksasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Warrior I, II, III (Virabhadrasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Triangle Pose (Trikonasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Chair Pose (Utkatasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Plank & Side Plank</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Downward & Upward Dog</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Cobra Pose (Bhujangasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Child's Pose (Balasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Bridge Pose (Setu Bandhasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Forward Bends (Uttanasana)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                    <span>Camel Pose (Ustrasana)</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>Note:</strong> Ensure good lighting and stand within the camera frame with your full body visible.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-600">
          <p className="text-sm">
            Built with TensorFlow.js MoveNet • Real-time AI Pose Detection
          </p>
        </div>
      </div>
    </div>
  );
};

export default YogaPoseDetector;