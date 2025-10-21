import React, { useRef, useState, useEffect } from 'react';
import { Camera, AlertCircle, CheckCircle2, Loader2, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';
import { normalizeKeypoints, calculatePoseSimilarity, Keypoint, extractAngles, PoseDetectionSmoother, ANGLE_PAIRS} from './poseHelpers';

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
  const detectedImageDivRef = useRef<HTMLDivElement | null>(null);

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
  const poseSmootherRef = useRef<PoseDetectionSmoother>(new PoseDetectionSmoother());
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

  // Load poses JSON and filter out unknown pose
  useEffect(() => {
    const loadPoses = async () => {
      try {
        const res = await fetch(POSES_JSON_PATH);
        if (!res.ok) throw new Error('Failed to fetch poses JSON');
        const data = await res.json();
        // Filter out any pose that contains "unknown" in the name (case insensitive)
        const filteredData = data.filter((pose: PoseDataItem) =>
          !pose.name.toLowerCase().includes('unknown')
        );
        setPosesData(filteredData);
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
    poseSmootherRef.current.reset();
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

 const classifyPose = (keypoints: Keypoint[]): PoseClassification => {
   if (!keypoints || keypoints.length < 17 || posesData.length === 0) {
     return { pose: 'Unknown', confidence: 0 };
   }

   const normalizedUserPose = normalizeKeypoints(keypoints);

   let bestMatch = { pose: 'Unknown', confidence: 0 };
   let bestScore = 0;

   for (const pose of posesData) {
     if (!pose.keypoints || pose.keypoints.length < 17) continue;

     const normalizedReference = normalizeKeypoints(pose.keypoints);
     const similarity = calculatePoseSimilarity(normalizedUserPose, normalizedReference);

     if (similarity > bestScore) {
       bestScore = similarity;
       bestMatch = {
         pose: pose.name,
         confidence: similarity
       };
     }
   }

   // Optional: apply a confidence threshold
   if (bestScore < 0.55) {
     return { pose: 'Unknown', confidence: bestScore };
   }

   const scaledConfidence = Math.min(1, (bestScore - 0.55 ) *2 +0.55);

   return {
    pose: bestMatch.pose,
    confidence: scaledConfidence
   };
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

    if (isPoseDetected) {
      const angles = extractAngles(keypoints);

      for (const [name, [i1, i2, i3]] of Object.entries(ANGLE_PAIRS)) {
        const kpA = keypoints[i1];
        const kpB = keypoints[i2]; // The vertex of the angle
        const kpC = keypoints[i3];

        if (kpA && kpB && kpC &&
            (kpA.score ?? 0) > 0.3 &&
            (kpB.score ?? 0) > 0.3 &&
            (kpC.score ?? 0) > 0.3) {

          const angle = angles[name];

          // Draw a circle at the joint vertex
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(kpB.x, kpB.y, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Display angle value for major joints
          if (angle !== undefined && ['leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'].includes(name)) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(angle)}°`, kpB.x, kpB.y + 25);
          }
        }
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
            name: `kp${i}`,
            index: i
          }));
          lastKeypointsRef.current = keypoints;

          const postAngles = extractAngles(keypoints);
          const rawPoseReult = classifyPose(keypoints);
          poseSmootherRef.current.addPoseDetection(rawPoseReult);
          const smoothedResult = poseSmootherRef.current.getSmoothedPose();


          const { pose, confidence: conf } = smoothedResult;


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

  // Target pose image (selected by user)
  useEffect(() => {
    if( poseSmootherRef.current){
        poseSmootherRef.current.reset();
    }
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

    // Find matching pose in posesData based on detected pose name
    if (currentPose && currentPose !== 'Unknown' && currentPose !== 'Unknown Pose' && currentPose !== 'No pose detected') {
      // Extract the main pose name (before parentheses)
      const detectedPoseName = currentPose.split('(')[0].trim().toLowerCase();

      // Try to find a match in posesData
      const matchedPose = posesData.find(p => {
        const poseName = p.name.toLowerCase();
        // Check if pose name contains the detected pose or vice versa
        return poseName.includes(detectedPoseName) ||
               detectedPoseName.includes(poseName.split('(')[0].trim().toLowerCase());
      });

      if (matchedPose) {
        imageUrl = matchedPose.image;
        altText = matchedPose.name;
      } else {
        // If no match found, try partial matching with key words
        const keywords = ['mountain', 'tree', 'warrior', 'chair', 'plank', 'downward', 'child', 'bridge', 'cobra', 'triangle', 'forward', 'upward'];
        for (const keyword of keywords) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-2 sm:p-3 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-3 sm:mb-4 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-1 md:mb-2">
            Yoga Pose Trainer
          </h1>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 px-2">
            Join <b>Nannu</b> and pick a pose below to match!
          </p>
        </div>

        {isLoading && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-2 py-2 sm:px-3 sm:py-2 md:px-4 md:py-3 rounded-lg mb-2 sm:mb-3 md:mb-4 flex items-center justify-center">
            <Loader2 className="animate-spin mr-2 flex-shrink-0" size={16} />
            <span className="text-xs sm:text-sm md:text-base">Loading model...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-2 sm:px-3 sm:py-2 md:px-4 md:py-3 rounded-lg mb-2 sm:mb-3 md:mb-4 flex items-center">
            <AlertCircle className="mr-2 flex-shrink-0" size={16} />
            <span className="text-xs sm:text-sm md:text-base">{error}</span>
          </div>
        )}

        {isModelLoaded && !isCameraOn && !error && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-2 py-2 sm:px-3 sm:py-2 md:px-4 md:py-3 rounded-lg mb-2 sm:mb-3 md:mb-4 flex items-center justify-center">
            <CheckCircle2 className="mr-2 flex-shrink-0" size={16} />
            <span className="text-xs sm:text-sm md:text-base">Model ready – Nannu is waiting! Start Camera! 🎉</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl p-2 sm:p-3 md:p-6">
              <div ref={containerRef} className="relative bg-gray-900 rounded-md sm:rounded-lg md:rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
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

              <div className="mt-3 md:mt-4 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 justify-center">
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
                <div className="flex gap-2 justify-center items-center">
                  <button onClick={handleZoomOut} disabled={!isCameraOn || zoom <= 0.5} className="px-3 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm">
                    <ZoomOut size={16} />
                    Zoom Out
                  </button>
                  <button onClick={resetZoom} disabled={!isCameraOn || zoom === 1} className="px-3 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm">
                    Reset ({zoom.toFixed(1)}x)
                  </button>
                  <button onClick={handleZoomIn} disabled={!isCameraOn || zoom >= 2} className="px-3 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm">
                    <ZoomIn size={16} />
                    Zoom In
                  </button>
                </div>
              </div>
            </div>
          </div>

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
                      {currentPose.toLowerCase().includes(posesData[selectedPoseIndex].name.toLowerCase().split('(')[0].trim().toLowerCase()) ? (
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
                      <li key={`{p.name}-${idx}`} className="cursor-pointer" onClick={() => setSelectedPoseIndex(idx)}>
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
        </div>

        <div className="mt-3 sm:mt-4 md:mt-8 text-center text-gray-600">
          <p className="text-xs md:text-sm">
            Built with MediaPipe Pose Landmarker • Real-time tracking • Made for Nannu 🎈
          </p>
        </div>
      </div>
    </div>
  );
};

export default YogaPoseDetector;