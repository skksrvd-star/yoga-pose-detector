import React, { useRef, useState, useEffect } from 'react';
import { Camera, AlertCircle, CheckCircle2, Loader2, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';

type Keypoint = {
  x: number;
  y: number;
  score?: number;
  name?: string;
};

interface PoseClassification {
  pose: string;
  confidence: number;
}

interface PoseDataItem {
  name: string;
  description: string;
  image: string;
  keypoints: any[];
}

const POSES_JSON_PATH = '/posesData.json';

const YogaPoseDetector: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageDivRef = useRef<HTMLDivElement | null>(null);

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

  const [currentPose, setCurrentPose] = useState('Unknown');
  const [confidence, setConfidence] = useState(0);
  const [poseCount, setPoseCount] = useState(0);
  const [lastDetectedPose, setLastDetectedPose] = useState('');

  const [posesData, setPosesData] = useState<PoseDataItem[]>([]);
  const [selectedPoseIndex, setSelectedPoseIndex] = useState<number | null>(null);

  // Load model
  useEffect(() => {
    let cancelled = false;
    const loadModel = async () => {
      try {
        setIsLoading(true);
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks('/wasm');

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
          },
          runningMode: 'VIDEO',
          numPoses: 1
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsModelLoaded(true);
        setError('');
      } catch (e) {
        console.error('Failed to load MediaPipe PoseLandmarker', e);
        setError('Failed to load pose model.');
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
    return () => { cancelled = true; };
  }, []);

  // Load poses JSON
  useEffect(() => {
    const loadPoses = async () => {
      try {
        const res = await fetch(POSES_JSON_PATH);
        if (!res.ok) throw new Error('Failed to fetch poses JSON');
        const data = await res.json();
        setPosesData(data);
      } catch (e) {
        console.error(e);
        setError(prev => prev ? prev : 'Failed to load poses data.');
      }
    };
    loadPoses();
  }, []);

  // Camera control
  const startCamera = async (requestedFacingMode?: 'user' | 'environment') => {
    try {
      setIsCameraLoading(true);
      setError('');
      const mode = requestedFacingMode ?? facingMode;
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: mode
        },
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

  // Sound
  const playSuccessSound = () => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.45);
    } catch (e) {
      // ignore
    }
  };

  // Angle calculation
  const calculateAngle = (a: Keypoint, b: Keypoint, c: Keypoint): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  const classifyPose = (kps: Keypoint[]): PoseClassification => {
    if (!kps || kps.length < 17) return { pose: 'Unknown', confidence: 0 };

    const kp = (idx: number) => kps[idx] ?? { x: 0, y: 0, score: 0 };

    const nose = kp(0);
    const leftShoulder = kp(11);
    const rightShoulder = kp(12);
    const leftElbow = kp(13);
    const rightElbow = kp(14);
    const leftWrist = kp(15);
    const rightWrist = kp(16);
    const leftHip = kp(23);
    const rightHip = kp(24);
    const leftKnee = kp(25);
    const rightKnee = kp(26);
    const leftAnkle = kp(27);
    const rightAnkle = kp(28);

    // STRICT validation for body parts
    const criticalBodyParts = [leftShoulder, rightShoulder, leftHip, rightHip];
    const limbParts = [leftElbow, rightElbow, leftWrist, rightWrist, 
                       leftKnee, rightKnee, leftAnkle, rightAnkle];
    
    const criticalScores = criticalBodyParts.map(k => k.score ?? 0);
    const criticalVisible = criticalScores.filter(s => s > 0.6).length;
    const avgCriticalScore = criticalScores.reduce((a, b) => a + b, 0) / 4;
    
    if (criticalVisible < 4 || avgCriticalScore < 0.6) {
      return { pose: 'Unknown', confidence: 0 };
    }
    
    // Sanity check: shoulders above hips
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    if (shoulderY >= hipY - 20) {
      return { pose: 'Unknown', confidence: 0 };
    }
    
    // Check body proportions
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    const hipWidth = Math.abs(leftHip.x - rightHip.x);
    if (shoulderWidth < 30 || hipWidth < 20 || shoulderWidth > 800) {
      return { pose: 'Unknown', confidence: 0 };
    }
    
    // Need limbs visible
    const limbScores = limbParts.map(k => k.score ?? 0);
    const visibleLimbs = limbScores.filter(s => s > 0.5).length;
    
    if (visibleLimbs < 4) {
      return { pose: 'Unknown', confidence: 0 };
    }
    
    const allScores = [...criticalScores, ...limbScores].filter(s => s > 0.4);
    const avgConfidence = allScores.length > 0 
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
      : 0;
    
    if (avgConfidence < 0.6) {
      return { pose: 'Unknown', confidence: 0 };
    }

    const isVisible = (k: Keypoint, t = 0.3) => (k.score ?? 0) > t;

    const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const leftLegAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightLegAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
    const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);

    const hipCenterY = (leftHip.y + rightHip.y) / 2;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;

    // Standing
    if (leftLegAngle > 150 && rightLegAngle > 150) {
      if (leftWrist.y < leftShoulder.y - 50 && rightWrist.y < rightShoulder.y - 50) {
        return { pose: 'Mountain Pose - Arms Up (Tadasana)', confidence: avgConfidence };
      }
      if (Math.abs(leftWrist.y - leftShoulder.y) < 40 && Math.abs(rightWrist.y - rightShoulder.y) < 40) {
        return { pose: 'T-Pose / Extended Mountain', confidence: avgConfidence };
      }
      return { pose: 'Mountain Pose (Tadasana)', confidence: avgConfidence };
    }

    // Tree Pose
    if ((leftLegAngle > 140 && rightKnee.y < rightHip.y - 40) ||
        (rightLegAngle > 140 && leftKnee.y < leftHip.y - 40)) {
      return { pose: 'Tree Pose (Vrksasana)', confidence: avgConfidence };
    }

    // Chair Pose
    if (leftLegAngle < 120 && rightLegAngle < 120 && leftLegAngle > 60 && rightLegAngle > 60) {
      if (leftWrist.y < leftShoulder.y - 40 && rightWrist.y < rightShoulder.y - 40) {
        return { pose: 'Chair Pose (Utkatasana)', confidence: avgConfidence };
      }
    }

    // Warrior poses
    if ((leftLegAngle < 130 && rightLegAngle > 140) || (rightLegAngle < 130 && leftLegAngle > 140)) {
      if (leftWrist.y < leftShoulder.y - 60 && rightWrist.y < rightShoulder.y - 60) {
        return { pose: 'Warrior I (Virabhadrasana I)', confidence: avgConfidence };
      }
      const leftArmHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 50;
      const rightArmHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 50;
      if (leftArmHorizontal && rightArmHorizontal) {
        return { pose: 'Warrior II (Virabhadrasana II)', confidence: avgConfidence };
      }
      return { pose: 'Warrior I (Virabhadrasana I)', confidence: avgConfidence };
    }

    // Plank
    const torsoAngle = Math.abs(
      Math.atan2(leftHip.y - leftShoulder.y, leftHip.x - leftShoulder.x) * 180 / Math.PI
    );
    if (torsoAngle < 40 && leftArmAngle > 140 && rightArmAngle > 140 &&
        leftLegAngle > 140 && Math.abs(shoulderCenterY - hipCenterY) < 60) {
      return { pose: 'Plank Pose (Phalakasana)', confidence: avgConfidence };
    }

    // Downward Dog
    if (isVisible(leftElbow) && isVisible(rightElbow) && isVisible(leftHip)) {
      const armsExtended = leftElbow.y > leftShoulder.y && rightElbow.y > rightShoulder.y;
      const hipsUp = leftHip.y < leftShoulder.y - 20 && rightHip.y < rightShoulder.y - 20;
      if (armsExtended && hipsUp && leftHipAngle < 140 && rightHipAngle < 140) {
        return { pose: 'Downward Dog (Adho Mukha Svanasana)', confidence: avgConfidence };
      }
    }

    // Child's Pose
    if (leftKnee.y > leftHip.y + 20 && rightKnee.y > rightHip.y + 20 &&
        shoulderCenterY > hipCenterY && nose.y > shoulderCenterY + 50) {
      return { pose: "Child's Pose (Balasana)", confidence: avgConfidence };
    }

    // Bridge Pose
    if (shoulderCenterY > hipCenterY + 50 && leftKnee.y > leftHip.y && rightKnee.y > rightHip.y &&
        leftHipAngle > 120 && rightHipAngle > 120) {
      return { pose: 'Bridge Pose (Setu Bandhasana)', confidence: avgConfidence };
    }

    // Standing Forward Bend
    if (leftLegAngle > 150 && rightLegAngle > 150 &&
        shoulderCenterY > hipCenterY + 80 && nose.y > hipCenterY) {
      return { pose: 'Standing Forward Bend (Uttanasana)', confidence: avgConfidence };
    }

    // Triangle Pose
    if (Math.abs(leftAnkle.x - rightAnkle.x) > 150 && leftLegAngle > 150 && rightLegAngle > 150) {
      if (Math.abs(leftWrist.y - rightWrist.y) > 80) {
        return { pose: 'Triangle Pose (Trikonasana)', confidence: avgConfidence };
      }
    }

    // Cobra / Upward Dog
    if (shoulderCenterY < hipCenterY - 30 && leftArmAngle < 150 && rightArmAngle < 150) {
      return { pose: 'Cobra Pose (Bhujangasana)', confidence: avgConfidence };
    }
    if (shoulderCenterY < hipCenterY - 40 && leftArmAngle > 140 && rightArmAngle > 140) {
      return { pose: 'Upward Dog (Urdhva Mukha Svanasana)', confidence: avgConfidence };
    }

    return { pose: 'Unknown Pose', confidence: avgConfidence };
  };

  // Drawing skeleton
  const drawSkeleton = (keypoints: Keypoint[], detectedPose: string) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!keypoints || keypoints.length === 0) return;

    const isPoseDetected = detectedPose !== 'Unknown Pose' &&
                           detectedPose !== 'Unknown' &&
                           detectedPose !== 'No pose detected';

    const skeletonColor = isPoseDetected ? '#00FF00' : '#FFA500';
    const lineWidth = isPoseDetected ? 6 : 4;
    const pointRadius = isPoseDetected ? 8 : 6;

    const connections: [number, number][] = [
      [11,13],[13,15],[12,14],[14,16],[11,12],[11,23],[12,24],[23,24],
      [23,25],[25,27],[24,26],[26,28],[0,1],[0,2],[1,3],[2,4]
    ];

    if (isPoseDetected) {
      ctx.fillStyle = 'rgba(0,255,0,0.04)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [a,b] of connections) {
      const kp1 = keypoints[a];
      const kp2 = keypoints[b];
      if (kp1 && kp2 && (kp1.score ?? 1) > 0.2 && (kp2.score ?? 1) > 0.2) {
        ctx.strokeStyle = skeletonColor;
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    }

    for (const k of keypoints) {
      if (!k) continue;
      if ((k.score ?? 1) > 0.2) {
        ctx.fillStyle = skeletonColor;
        ctx.beginPath();
        ctx.arc(k.x, k.y, pointRadius, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(k.x, k.y, Math.max(2, pointRadius/3), 0, Math.PI*2);
        ctx.fill();
      }
    }

    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = isPoseDetected ? '#00FF00' : '#FFA500';
    ctx.fillText(detectedPose.split('(')[0].trim(), canvas.width/2, 36);

    ctx.font = '16px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Confidence: ${Math.round(confidence)}%`, canvas.width/2, canvas.height - 20);
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

          const isPoseDetected = pose !== 'Unknown Pose' &&
                                pose !== 'Unknown' &&
                                pose !== 'No pose detected' &&
                                conf >= 0.6;

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
          lastKeypointsRef.current = [];
          setLastDetectedPose('');
        }
      } catch (e) {
        console.error('Detection error', e);
      }

      drawSkeleton(lastKeypointsRef.current, currentPose);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isCameraOn, isModelLoaded, currentPose, confidence]);

  useEffect(() => {
    if (!isCameraOn) return;
    drawSkeleton(lastKeypointsRef.current, currentPose);
  }, [currentPose, confidence]);

  useEffect(() => {
    if (!imageDivRef.current) return;

    let imageUrl = '/poses/unknown-pose.jpg';
    let altText = 'Unknown Pose';

    if (selectedPoseIndex !== null && posesData[selectedPoseIndex]) {
      imageUrl = posesData[selectedPoseIndex].image;
      altText = posesData[selectedPoseIndex].name;
    }

    imageDivRef.current.innerHTML = `
      <img src="${imageUrl}" alt="${altText}" class="w-full h-full object-cover" />
    `;
  }, [selectedPoseIndex, posesData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 mb-1 md:mb-2">Yoga Pose Trainer</h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">Pick a pose below and match it – MediaPipe powers live tracking.</p>
        </div>

        {isLoading && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-3 py-2 md:px-4 md:py-3 rounded-lg mb-3 md:mb-4 flex items-center justify-center">
            <Loader2 className="animate-spin mr-2" size={18} />
            <span className="text-sm md:text-base">Loading model & assets...</span>
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
            <span className="text-xs sm:text-sm md:text-base">Model ready – pick a pose and Start Camera.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-xl p-3 md:p-6">
              <div ref={containerRef} className="relative bg-gray-900 rounded-lg md:rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}>
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
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Target Pose</h2>
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
                      {selectedPoseIndex !== null && posesData[selectedPoseIndex]
                        ? posesData[selectedPoseIndex].name
                        : currentPose}
                    </p>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs md:text-sm text-gray-600 mb-1">
                        <span>Confidence</span>
                        <span className="font-semibold">{confidence}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            confidence >= 70 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                            confidence >= 40 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' :
                            'bg-gradient-to-r from-red-400 to-red-500'
                          }`}
                          style={{ width: `${confidence}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-600">
                        {selectedPoseIndex !== null && posesData[selectedPoseIndex]
                          ? posesData[selectedPoseIndex].description
                          : 'Select a pose below to practice.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <h3 className="text-base md:text-lg font-semibold text-gray-800">Pick a Pose to Practice</h3>
                <div className="max-h-64 md:max-h-96 overflow-y-auto mt-2">
                  <ul className="grid grid-cols-3 gap-2">
                    {posesData.map((p, idx) => (
                      <li key={p.name} className="cursor-pointer" onClick={() => setSelectedPoseIndex(idx)}>
                        <div className={`p-1 rounded-md border ${selectedPoseIndex === idx ? 'border-purple-500' : 'border-transparent'} hover:shadow-lg`}>
                          <img src={p.image} alt={p.name} className="w-full h-20 object-cover rounded-md" />
                          <div className="text-xs text-center mt-1">{p.name}</div>
                        </div>
                      </li>
                    ))}
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
            Built with MediaPipe Pose Landmarker • Real-time pose tracking
          </p>
        </div>
      </div>
    </div>
  );
};

export default YogaPoseDetector;

