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
  const imageDivRef = useRef<HTMLDivElement>(null);
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [poseCount, setPoseCount] = useState(0);
  const [lastDetectedPose, setLastDetectedPose] = useState('');
  const [zoom, setZoom] = useState(1);

  // Play success sound
  const playSuccessSound = () => {
    if (!soundEnabled) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

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

        const detectorConfig = {
          modelType: poseDetectionModule.movenet.modelType.SINGLEPOSE_LIGHTNING
        };

        const poseDetector = await poseDetectionModule.createDetector(
          poseDetectionModule.SupportedModels.MoveNet,
          detectorConfig
        );

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

  // Update image when pose changes
  useEffect(() => {
    if (!imageDivRef.current) return;

    const isUnknown = currentPose === 'Unknown Pose' || currentPose === 'Standing Position' ||
                     currentPose === 'No pose detected' || currentPose === 'Unknown';

    const imageSrc = isUnknown
      ? '/poses/unknown-pose.jpg'
      : `/poses/${currentPose.toLowerCase().split('(')[0].trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.jpg`;

    imageDivRef.current.innerHTML = `
      <img
        src="${imageSrc}"
        alt="${currentPose}"
        class="w-full h-full object-cover"
        onerror="this.style.display='none';"
      />
    `;
  }, [currentPose]);

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

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }

    const newMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newMode);
  };

  const handleZoomIn = async () => {
    const newZoom = Math.min(zoom + 0.1, 2);
    setZoom(newZoom);
    if (isCameraOn) await applyZoomToCamera(newZoom);
  };

  const handleZoomOut = async () => {
    const newZoom = Math.max(zoom - 0.1, 0.5);
    setZoom(newZoom);
    if (isCameraOn) await applyZoomToCamera(newZoom);
  };

  const resetZoom = async () => {
    setZoom(1);
    if (isCameraOn) await applyZoomToCamera(1);
  };

  const applyZoomToCamera = async (zoomLevel: number) => {
    if (!videoRef.current?.srcObject) return;

    const stream = videoRef.current.srcObject as MediaStream;
    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack) return;

    try {
      const capabilities = videoTrack.getCapabilities() as any;
      if (capabilities && 'zoom' in capabilities) {
        const constraints = { advanced: [{ zoom: zoomLevel } as any] };
        await videoTrack.applyConstraints(constraints);
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
    setLastDetectedPose('');

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
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

    // Filter out low-confidence keypoints
    const filteredKeypoints = keypoints.map(kp => ({
      ...kp,
      score: kp.score || 0
    }));

    // Check overall confidence - if too many keypoints are low confidence, return unknown
    const avgConfidence = filteredKeypoints.reduce((sum, kp) => sum + kp.score, 0) / filteredKeypoints.length;
    if (avgConfidence < 0.4) return { pose: 'Unknown', confidence: 0 };

    const nose = keypoints[0];
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

    // Helper to check if keypoints are visible enough
    const isVisible = (kp: Keypoint, threshold = 0.3) => (kp.score || 0) > threshold;
    const countVisible = (kps: Keypoint[], threshold = 0.3) => kps.filter(kp => isVisible(kp, threshold)).length;

    const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const leftLegAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightLegAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
    const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);

    const hipCenterY = (leftHip.y + rightHip.y) / 2;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipCenterX = (leftHip.x + rightHip.x) / 2;
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;

    // Calculate torso vertical distance
    const torsoVerticalDistance = Math.abs(shoulderCenterY - hipCenterY);

    // Tree Pose - one leg lifted, other straight
    if (countVisible([leftKnee, rightKnee, leftHip, rightHip]) >= 4) {
      const leftLegLifted = leftKnee.y < leftHip.y - 50 && leftLegAngle > 150;
      const rightLegLifted = rightKnee.y < rightHip.y - 50 && rightLegAngle > 150;

      if ((leftLegLifted && rightLegAngle > 160) || (rightLegLifted && leftLegAngle > 160)) {
        if (isVisible(leftWrist) && isVisible(rightWrist)) {
          if (leftWrist.y < leftShoulder.y - 20 && rightWrist.y < rightShoulder.y - 20) {
            return { pose: 'Tree Pose - Arms Up (Vrksasana)', confidence: avgConfidence };
          }
        }
        return { pose: 'Tree Pose (Vrksasana)', confidence: avgConfidence };
      }
    }

    // Mountain Pose with arms up
    if (leftLegAngle > 170 && rightLegAngle > 170 &&
        isVisible(leftWrist) && isVisible(rightWrist) &&
        leftWrist.y < leftShoulder.y - 60 && rightWrist.y < rightShoulder.y - 60) {
      return { pose: 'Mountain Pose - Arms Up (Tadasana)', confidence: avgConfidence };
    }

    // Warrior I - deep lunge, arms raised
    if (countVisible([leftKnee, rightKnee, leftWrist, rightWrist]) >= 4) {
      const leftLegBent = leftLegAngle < 120 && leftLegAngle > 60;
      const rightLegBent = rightLegAngle < 120 && rightLegAngle > 60;
      const leftLegStraight = leftLegAngle > 160;
      const rightLegStraight = rightLegAngle > 160;

      if ((leftLegBent && rightLegStraight) || (rightLegBent && leftLegStraight)) {
        if (leftWrist.y < leftShoulder.y - 80 && rightWrist.y < rightShoulder.y - 80) {
          return { pose: 'Warrior I (Virabhadrasana I)', confidence: avgConfidence };
        }
      }
    }

    // Warrior II - lunge with horizontal arms
    if (countVisible([leftKnee, rightKnee, leftWrist, rightWrist]) >= 4) {
      const leftLegBent = leftLegAngle < 120 && leftLegAngle > 60;
      const rightLegBent = rightLegAngle < 120 && rightLegAngle > 60;
      const leftLegStraight = leftLegAngle > 160;
      const rightLegStraight = rightLegAngle > 160;

      if ((leftLegBent && rightLegStraight) || (rightLegBent && leftLegStraight)) {
        const leftArmHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 40;
        const rightArmHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 40;

        if (leftArmHorizontal && rightArmHorizontal &&
            Math.abs(leftWrist.x - leftShoulder.x) > 80 && Math.abs(rightWrist.x - rightShoulder.x) > 80) {
          return { pose: 'Warrior II (Virabhadrasana II)', confidence: avgConfidence };
        }
      }
    }

    // Downward Dog - inverted V shape
    if (countVisible([leftElbow, rightElbow, leftHip, rightHip, leftWrist, rightWrist]) >= 5) {
      const armsExtended = leftElbow.y > leftShoulder.y + 20 && rightElbow.y > rightShoulder.y + 20;
      const hipsUp = leftHip.y < leftShoulder.y - 30 && rightHip.y < rightShoulder.y - 30;
      const hipAngleGood = leftHipAngle < 130 && rightHipAngle < 130;

      if (armsExtended && hipsUp && hipAngleGood) {
        return { pose: 'Downward Dog (Adho Mukha Svanasana)', confidence: avgConfidence };
      }
    }

    // Plank Pose - horizontal body
    if (countVisible([leftElbow, rightElbow, leftHip, rightHip]) >= 4) {
      const armsExtended = leftArmAngle > 160 && rightArmAngle > 160;
      const bodyHorizontal = Math.abs(shoulderCenterY - hipCenterY) < 40;
      const legsExtended = leftLegAngle > 165 && rightLegAngle > 165;

      if (armsExtended && bodyHorizontal && legsExtended) {
        return { pose: 'Plank Pose (Phalakasana)', confidence: avgConfidence };
      }
    }

    // Child's Pose - forehead to ground, back rounded
    if (countVisible([nose, leftKnee, rightKnee, leftShoulder, rightShoulder]) >= 5) {
      const kneesDown = leftKnee.y > leftHip.y + 40 && rightKnee.y > rightHip.y + 40;
      const headDown = nose.y > shoulderCenterY + 100;
      const backRounded = shoulderCenterY > hipCenterY - 20;

      if (kneesDown && headDown && backRounded) {
        return { pose: 'Child\'s Pose (Balasana)', confidence: avgConfidence };
      }
    }

    // Bridge Pose - lying back, hips raised
    if (countVisible([leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee]) >= 6) {
      const shouldersDown = shoulderCenterY > hipCenterY + 60;
      const hipsRaised = leftHipAngle > 130 && rightHipAngle > 130;
      const kneesFlexed = leftLegAngle > 80 && leftLegAngle < 140 && rightLegAngle > 80 && rightLegAngle < 140;

      if (shouldersDown && hipsRaised && kneesFlexed) {
        return { pose: 'Bridge Pose (Setu Bandhasana)', confidence: avgConfidence };
      }
    }

    // Standing Forward Bend - head down, legs straight
    if (countVisible([nose, leftAnkle, rightAnkle, leftHip, rightHip]) >= 5) {
      const legsExtended = leftLegAngle > 170 && rightLegAngle > 170;
      const torsoDown = shoulderCenterY > hipCenterY + 120;
      const headDown = nose.y > hipCenterY + 80;

      if (legsExtended && torsoDown && headDown) {
        return { pose: 'Standing Forward Bend (Uttanasana)', confidence: avgConfidence };
      }
    }

    // Triangle Pose - wide legs, torso twisted
    if (countVisible([leftAnkle, rightAnkle, leftWrist, rightWrist, leftShoulder]) >= 5) {
      const legsWide = Math.abs(leftAnkle.x - rightAnkle.x) > 200;
      const legsExtended = leftLegAngle > 170 && rightLegAngle > 170;
      const torsoTwisted = Math.abs(leftWrist.y - rightWrist.y) > 100;

      if (legsWide && legsExtended && torsoTwisted) {
        return { pose: 'Triangle Pose (Trikonasana)', confidence: avgConfidence };
      }
    }

    // Chair Pose - knees bent deeply, arms raised
    if (countVisible([leftKnee, rightKnee, leftWrist, rightWrist]) >= 4) {
      const kneesBent = leftLegAngle < 110 && rightLegAngle < 110 && leftLegAngle > 70 && rightLegAngle > 70;
      const armsUp = leftWrist.y < leftShoulder.y - 60 && rightWrist.y < rightShoulder.y - 60;

      if (kneesBent && armsUp) {
        return { pose: 'Chair Pose (Utkatasana)', confidence: avgConfidence };
      }
    }

    // Cobra Pose - chest up, arms bent
    if (countVisible([leftWrist, rightWrist, leftShoulder, nose]) >= 4) {
      const chestUp = shoulderCenterY < hipCenterY - 50;
      const armsBent = leftArmAngle < 140 && rightArmAngle < 140;
      const handsLow = leftWrist.y > leftShoulder.y && rightWrist.y > rightShoulder.y;

      if (chestUp && armsBent && handsLow) {
        return { pose: 'Cobra Pose (Bhujangasana)', confidence: avgConfidence };
      }
    }

    // Upward Dog - chest up, arms straight
    if (countVisible([leftWrist, rightWrist, leftShoulder, leftHip]) >= 4) {
      const chestUp = shoulderCenterY < hipCenterY - 60;
      const armsExtended = leftArmAngle > 160 && rightArmAngle > 160;
      const handsSupport = leftWrist.y > leftShoulder.y + 40 && rightWrist.y > rightShoulder.y + 40;

      if (chestUp && armsExtended && handsSupport) {
        return { pose: 'Upward Dog (Urdhva Mukha Svanasana)', confidence: avgConfidence };
      }
    }

    // Default standing
    if (leftLegAngle > 170 && rightLegAngle > 170) {
      return { pose: 'Mountain Pose (Tadasana)', confidence: avgConfidence };
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

    const isPoseDetected = detectedPose !== 'Unknown Pose' &&
                           detectedPose !== 'Standing Position' &&
                           detectedPose !== 'Unknown' &&
                           detectedPose !== 'No pose detected';

    // Enhanced colors for better visibility
    const skeletonColor = isPoseDetected ? '#00FF00' : '#FFA500';
    const lineWidth = isPoseDetected ? 8 : 5;
    const pointRadius = isPoseDetected ? 10 : 7;

    const connections: [number, number][] = [
      [5, 7], [7, 9], [6, 8], [8, 10], [5, 6], [5, 11], [6, 12], [11, 12],
      [11, 13], [13, 15], [12, 14], [14, 16], [0, 1], [0, 2], [1, 3], [2, 4],
    ];

    // Draw glowing background effect when pose is detected
    if (isPoseDetected) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw connection lines with enhanced styling
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isPoseDetected) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = skeletonColor;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    for (const [idx1, idx2] of connections) {
      const kp1 = keypoints[idx1];
      const kp2 = keypoints[idx2];

      if (kp1 && kp2 && (kp1.score || 0) > 0.3 && (kp2.score || 0) > 0.3) {
        ctx.strokeStyle = skeletonColor;
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;

    // Draw keypoints with enhanced styling
    for (const kp of keypoints) {
      if (kp && (kp.score || 0) > 0.3) {
        // Outer glow for detected poses
        if (isPoseDetected) {
          ctx.fillStyle = skeletonColor + '30';
          ctx.beginPath();
          ctx.arc(kp.x, kp.y, pointRadius + 8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Main point
        ctx.fillStyle = skeletonColor;
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, pointRadius, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, pointRadius / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Enhanced pose name display with background
    if (isPoseDetected) {
      const text = detectedPose.split('(')[0].trim();

      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const x = canvas.width / 2;
      const y = 50;

      // Background box for text
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
      ctx.fillRect(x - textWidth / 2 - 15, y - 30, textWidth + 30, 40);

      // Border
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - textWidth / 2 - 15, y - 30, textWidth + 30, 40);

      // Text with outline
      ctx.fillStyle = '#00FF00';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);

      // Add "Great!" text at bottom
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#00FF00';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText('✓ Great!', canvas.width / 2, canvas.height - 30);
      ctx.fillText('✓ Great!', canvas.width / 2, canvas.height - 30);
    } else {
      // Guidance text when no pose detected
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#FFA500';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText('Move into a pose', canvas.width / 2, canvas.height - 30);
      ctx.fillText('Move into a pose', canvas.width / 2, canvas.height - 30);
    }
  };

  const detectPose = async () => {
    if (!videoRef.current || !detector) return;

    const video = videoRef.current;

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      const poses = await detector.estimatePoses(video);

      if (poses && poses.length > 0 && poses[0].keypoints) {
        const rawKeypoints = poses[0].keypoints;
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

          // Check if this is a new pose detection for counting
          const isPoseDetected = pose !== 'Unknown Pose' &&
                                pose !== 'Standing Position' &&
                                pose !== 'Unknown' &&
                                pose !== 'No pose detected';

          if (isPoseDetected && pose !== lastDetectedPose) {
            setLastDetectedPose(pose);
            setPoseCount(prev => prev + 1);
            playSuccessSound();
          } else if (!isPoseDetected) {
            setLastDetectedPose('');
          }
        } else {
          setCurrentPose('No pose detected');
          setConfidence(0);
          setLastDetectedPose('');
        }
      } else {
        setCurrentPose('No pose detected');
        setConfidence(0);
        lastKeypointsRef.current = [];
        setLastDetectedPose('');
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
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [isCameraOn, currentPose]);

  useEffect(() => {
    if (!isCameraOn || !detector) return;

    const startDelay = setTimeout(() => {
      const intervalId = setInterval(detectPose, 500);
      return () => clearInterval(intervalId);
    }, 500);

    return () => clearTimeout(startDelay);
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
              <div ref={containerRef} className="relative bg-gray-900 rounded-lg md:rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}>
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline />
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

                {isCameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-20">
                    <div className="text-center text-white">
                      <Loader2 className="animate-spin mx-auto mb-2" size={48} />
                      <p>Starting camera...</p>
                    </div>
                  </div>
                )}

                {isCameraOn && (
                  <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-30">
                    <button onClick={handleZoomIn} disabled={zoom >= 2} className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all" title="Zoom In">
                      <ZoomIn size={20} className="text-gray-800" />
                    </button>
                    <button onClick={resetZoom} className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg transition-all text-xs font-bold text-gray-800" title="Reset Zoom">
                      {zoom.toFixed(1)}x
                    </button>
                    <button onClick={handleZoomOut} disabled={zoom <= 0.5} className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all" title="Zoom Out">
                      <ZoomOut size={20} className="text-gray-800" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 md:mt-4 flex flex-col sm:flex-row gap-2 md:gap-3 justify-center">
                <button onClick={() => startCamera()} disabled={!isModelLoaded || isCameraOn || isCameraLoading} className="px-4 md:px-6 py-2 md:py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm md:text-base">
                  <Camera size={18} />
                  {isCameraLoading ? 'Starting...' : 'Start Camera'}
                </button>
                <button onClick={switchCamera} disabled={!isCameraOn} className="px-4 md:px-6 py-2 md:py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm md:text-base">
                  <SwitchCamera size={18} />
                  Switch
                </button>
                <button onClick={() => setSoundEnabled(!soundEnabled)} className={`px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm md:text-base ${soundEnabled ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'bg-gray-400 hover:bg-gray-500 text-white'}`}>
                  {soundEnabled ? '🔊' : '🔇'}
                  {soundEnabled ? 'Sound ON' : 'Sound OFF'}
                </button>
                <button onClick={stopCamera} disabled={!isCameraOn} className="px-4 md:px-6 py-2 md:py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm md:text-base">
                  Stop Camera
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-xl p-4 md:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Current Pose</h2>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-purple-600">{poseCount}</div>
                  <div className="text-xs md:text-sm text-gray-600">Poses Found!</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg md:rounded-xl p-4 md:p-6 mb-4 md:mb-6">
                <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
                  <div ref={imageDivRef} className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0 bg-white rounded-lg overflow-hidden shadow-md" />

                  <div className="flex-1 min-w-0 text-center md:text-left w-full">
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-2 break-words">
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
                  <strong>Tip:</strong> Good lighting and full body visibility help with better pose detection!
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