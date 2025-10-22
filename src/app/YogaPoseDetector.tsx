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
      const leftEye = kp(1);
      const rightEye = kp(2);
      const leftEar = kp(3);
      const rightEar = kp(4);
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

      const criticalBodyParts = [leftShoulder, rightShoulder, leftHip, rightHip];
      const limbParts = [leftElbow, rightElbow, leftWrist, rightWrist, leftKnee, rightKnee, leftAnkle, rightAnkle];

      const criticalScores = criticalBodyParts.map(k => k.score ?? 0);
      const criticalVisible = criticalScores.filter(s => s > 0.5).length;
      const avgCriticalScore = criticalScores.reduce((a, b) => a + b, 0) / 4;

      if (criticalVisible < 3 || avgCriticalScore < 0.5) {
        return { pose: 'Unknown', confidence: 0 };
      }

      const limbScores = limbParts.map(k => k.score ?? 0);
      const visibleLimbs = limbScores.filter(s => s > 0.4).length;
      const allScores = [...criticalScores, ...limbScores].filter(s => s > 0.3);
      const avgConfidence = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

      if (avgConfidence < 0.5) return { pose: 'Unknown', confidence: 0 };

      const isVisible = (k: Keypoint, t = 0.3) => (k.score ?? 0) > t;

      // Calculate all angles
      const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
      const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
      const leftLegAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightLegAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
      const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
      const leftShoulderAngle = calculateAngle(leftElbow, leftShoulder, leftHip);
      const rightShoulderAngle = calculateAngle(rightElbow, rightShoulder, rightHip);
      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

      const hipCenterY = (leftHip.y + rightHip.y) / 2;
      const hipCenterX = (leftHip.x + rightHip.x) / 2;
      const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
      const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
      const ankleCenterY = (leftAnkle.y + rightAnkle.y) / 2;
      const wristCenterY = (leftWrist.y + rightWrist.y) / 2;

      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const hipWidth = Math.abs(leftHip.x - rightHip.x);
      const ankleWidth = Math.abs(leftAnkle.x - rightAnkle.x);

      const torsoAngle = Math.abs(Math.atan2(hipCenterY - shoulderCenterY, hipCenterX - shoulderCenterX) * 180 / Math.PI);

      // INVERSIONS & ARM BALANCES
      // Headstand - head at bottom, feet at top
      if (nose.y > shoulderCenterY + 50 && ankleCenterY < shoulderCenterY - 80 && Math.abs(leftAnkle.x - rightAnkle.x) < 100) {
        return { pose: 'Headstand', confidence: avgConfidence };
      }

      // Handstand - hands at bottom, body vertical
      if (wristCenterY > shoulderCenterY + 20 && ankleCenterY < shoulderCenterY - 100 && leftLegAngle > 150 && rightLegAngle > 150) {
        return { pose: 'Handstand', confidence: avgConfidence };
      }

      // Forearm Stand
      if (leftElbow.y > leftShoulder.y + 30 && rightElbow.y > rightShoulder.y + 30 && ankleCenterY < shoulderCenterY - 80) {
        return { pose: 'Forearm Stand', confidence: avgConfidence };
      }

      // Shoulder Stand
      if (shoulderCenterY > hipCenterY + 80 && ankleCenterY < shoulderCenterY - 50 && leftLegAngle > 150 && rightLegAngle > 150) {
        return { pose: 'Shoulder Stand', confidence: avgConfidence };
      }

      // Plow Pose
      if (shoulderCenterY > hipCenterY + 60 && leftKnee.y < shoulderCenterY && rightKnee.y < shoulderCenterY) {
        return { pose: 'Plow Pose', confidence: avgConfidence };
      }

      // Crow Pose - arms supporting body
      if (leftElbow.y > leftShoulder.y && rightElbow.y > rightShoulder.y && leftKnee.y < leftHip.y && rightKnee.y < rightHip.y && Math.abs(leftAnkle.y - rightAnkle.y) < 100 && leftAnkle.y < leftHip.y) {
        return { pose: 'Crow Pose', confidence: avgConfidence };
      }

      // Side Crow Pose
      if (leftElbow.y > leftShoulder.y && Math.abs(leftKnee.x - leftElbow.x) < 80 && leftAnkle.y < leftHip.y) {
        return { pose: 'Side Crow Pose', confidence: avgConfidence };
      }

      // Peacock Pose - body parallel to ground, on hands
      if (Math.abs(shoulderCenterY - hipCenterY) < 40 && wristCenterY > shoulderCenterY && leftArmAngle < 100 && rightArmAngle < 100) {
        return { pose: 'Peacock Pose', confidence: avgConfidence };
      }

      // Firefly Pose
      if (leftWrist.y > leftShoulder.y && leftKnee.y < leftHip.y && leftAnkle.x > leftKnee.x + 80) {
        return { pose: 'Firefly Pose', confidence: avgConfidence };
      }

      // STANDING BALANCE POSES
      // Tree Pose
      if ((leftLegAngle > 150 && rightKnee.y < rightHip.y - 30 && Math.abs(rightKnee.x - leftHip.x) < 50) ||
          (rightLegAngle > 150 && leftKnee.y < leftHip.y - 30 && Math.abs(leftKnee.x - rightHip.x) < 50)) {
        return { pose: 'Tree Pose', confidence: avgConfidence };
      }

      // Eagle Pose - legs and arms wrapped
      if (((leftKnee.x < rightKnee.x - 20 && leftAnkle.x > rightAnkle.x + 20) || (rightKnee.x < leftKnee.x - 20 && rightAnkle.x > leftAnkle.x + 20)) &&
          ((leftElbow.x > rightElbow.x && leftWrist.x < rightWrist.x) || (rightElbow.x > leftElbow.x && rightWrist.x < leftWrist.x))) {
        return { pose: 'Eagle Pose', confidence: avgConfidence };
      }

      // Dancer Pose - one leg lifted back
      if ((leftLegAngle > 150 && rightAnkle.y < rightHip.y - 40 && rightKnee.y < rightHip.y) ||
          (rightLegAngle > 150 && leftAnkle.y < leftHip.y - 40 && leftKnee.y < leftHip.y)) {
        if ((leftWrist.y < leftHip.y && rightWrist.y > rightHip.y + 50) || (rightWrist.y < rightHip.y && leftWrist.y > leftHip.y + 50)) {
          return { pose: 'King Dancer Pose', confidence: avgConfidence };
        }
        return { pose: 'Dancer Pose', confidence: avgConfidence };
      }

      // Half Moon Pose
      if ((leftLegAngle > 150 && rightLegAngle > 150 && Math.abs(rightAnkle.x - leftAnkle.x) > 100 && torsoAngle > 60) ||
          (torsoAngle > 60 && Math.abs(leftWrist.y - rightWrist.y) > 120)) {
        return { pose: 'Half Moon Pose', confidence: avgConfidence };
      }

      // Standing Split
      if ((leftLegAngle > 150 && rightAnkle.y < shoulderCenterY - 80) || (rightLegAngle > 150 && leftAnkle.y < shoulderCenterY - 80)) {
        return { pose: 'Standing Split', confidence: avgConfidence };
      }

      // Warrior III
      if ((leftLegAngle > 150 && rightLegAngle > 150 && Math.abs(rightAnkle.y - shoulderCenterY) < 80 && rightAnkle.x > rightHip.x + 50) ||
          (rightLegAngle > 150 && leftLegAngle > 150 && Math.abs(leftAnkle.y - shoulderCenterY) < 80 && leftAnkle.x > leftHip.x + 50)) {
        return { pose: 'Warrior III', confidence: avgConfidence };
      }

      // STANDING POSES
      // Chair Pose
      if (leftKneeAngle < 120 && rightKneeAngle < 120 && leftKneeAngle > 60 && rightKneeAngle > 60 && ankleWidth < 80) {
        if (wristCenterY < shoulderCenterY - 40) {
          return { pose: 'Chair Pose', confidence: avgConfidence };
        }
      }

      // Warrior I
      if ((leftKneeAngle < 130 && rightLegAngle > 150 && ankleWidth > 100) || (rightKneeAngle < 130 && leftLegAngle > 150 && ankleWidth > 100)) {
        if (wristCenterY < shoulderCenterY - 50) {
          return { pose: 'Warrior I', confidence: avgConfidence };
        }
      }

      // Warrior II
      if ((leftKneeAngle < 130 && rightLegAngle > 150) || (rightKneeAngle < 130 && leftLegAngle > 150)) {
        if (Math.abs(leftWrist.y - leftShoulder.y) < 50 && Math.abs(rightWrist.y - rightShoulder.y) < 50 && Math.abs(leftWrist.x - rightWrist.x) > 150) {
          return { pose: 'Warrior II', confidence: avgConfidence };
        }
      }

      // Triangle Pose
      if (ankleWidth > 150 && leftLegAngle > 150 && rightLegAngle > 150 && Math.abs(leftWrist.y - rightWrist.y) > 100) {
        if (torsoAngle > 50) {
          return { pose: 'Revolved Triangle Pose', confidence: avgConfidence };
        }
        return { pose: 'Triangle Pose', confidence: avgConfidence };
      }

      // Wide-Legged Forward Bend
      if (ankleWidth > 150 && shoulderCenterY > hipCenterY + 60 && nose.y > hipCenterY) {
        return { pose: 'Wide-Legged Forward Bend', confidence: avgConfidence };
      }

      // Standing Forward Bend
      if (leftLegAngle > 150 && rightLegAngle > 150 && shoulderCenterY > hipCenterY + 80 && nose.y > hipCenterY + 40) {
        return { pose: 'Standing Forward Bend', confidence: avgConfidence };
      }

      // Intense Side Stretch
      if (leftLegAngle > 150 && rightLegAngle > 150 && ankleWidth > 60 && shoulderCenterY > hipCenterY + 50) {
        return { pose: 'Intense Side Stretch', confidence: avgConfidence };
      }

      // Garland Pose (deep squat)
      if (leftKneeAngle < 80 && rightKneeAngle < 80 && hipCenterY > ankleCenterY - 80 && Math.abs(leftWrist.x - rightWrist.x) < 60 && wristCenterY > shoulderCenterY) {
        return { pose: 'Garland Pose', confidence: avgConfidence };
      }

      // Mountain Pose
      if (leftLegAngle > 150 && rightLegAngle > 150 && ankleWidth < 80) {
        if (wristCenterY < shoulderCenterY - 50) {
          return { pose: 'Mountain Pose', confidence: avgConfidence };
        }
        if (Math.abs(leftWrist.y - leftShoulder.y) < 40 && Math.abs(rightWrist.y - rightShoulder.y) < 40 && Math.abs(leftWrist.x - rightWrist.x) > 120) {
          return { pose: 'Mountain Pose', confidence: avgConfidence };
        }
        return { pose: 'Mountain Pose', confidence: avgConfidence };
      }

      // LUNGES
      // High Lunge
      if ((leftKneeAngle < 120 && rightLegAngle > 150) || (rightKneeAngle < 120 && leftLegAngle > 150)) {
        if (wristCenterY < shoulderCenterY - 40) {
          return { pose: 'High Lunge', confidence: avgConfidence };
        }
      }

      // Low Lunge
      if ((leftKnee.y > leftHip.y + 30 && rightKneeAngle < 120) || (rightKnee.y > rightHip.y + 30 && leftKneeAngle < 120)) {
        return { pose: 'Low Lunge', confidence: avgConfidence };
      }

      // FLOOR POSES - PRONE (face down)
      // Cobra Pose
      if (shoulderCenterY < hipCenterY - 20 && leftArmAngle < 150 && rightArmAngle < 150 && nose.y < shoulderCenterY) {
        return { pose: 'Cobra Pose', confidence: avgConfidence };
      }

      // Upward Dog
      if (shoulderCenterY < hipCenterY - 30 && leftArmAngle > 150 && rightArmAngle > 150 && nose.y < shoulderCenterY) {
        return { pose: 'Upward Dog', confidence: avgConfidence };
      }

      // Bow Pose
      if (shoulderCenterY < hipCenterY && leftKneeAngle < 100 && rightKneeAngle < 100 && leftAnkle.y < leftHip.y && rightAnkle.y < rightHip.y && leftWrist.y < leftShoulder.y) {
        return { pose: 'Bow Pose', confidence: avgConfidence };
      }

      // Locust Pose
      if (shoulderCenterY < hipCenterY && leftLegAngle > 160 && rightLegAngle > 160 && ankleCenterY < hipCenterY - 20) {
        return { pose: 'Locust Pose', confidence: avgConfidence };
      }

      // Half Frog Pose
      if (shoulderCenterY < hipCenterY && (leftKneeAngle < 90 || rightKneeAngle < 90) && (leftAnkle.y < leftHip.y - 20 || rightAnkle.y < rightHip.y - 20)) {
        if (leftKneeAngle < 90 && rightKneeAngle < 90) {
          return { pose: 'Full Frog Pose', confidence: avgConfidence };
        }
        return { pose: 'Half Frog Pose', confidence: avgConfidence };
      }

      // FLOOR POSES - SUPINE (face up)
      // Bridge Pose
      if (shoulderCenterY > hipCenterY + 40 && leftKnee.y > leftHip.y && rightKnee.y > rightHip.y && leftKneeAngle < 120 && rightKneeAngle < 120) {
        return { pose: 'Bridge Pose', confidence: avgConfidence };
      }

      // Fish Pose
      if (shoulderCenterY > hipCenterY + 20 && nose.y > shoulderCenterY + 40 && leftLegAngle > 160 && rightLegAngle > 160) {
        return { pose: 'Fish Pose', confidence: avgConfidence };
      }

      // Happy Baby Pose
      if (shoulderCenterY > hipCenterY - 20 && leftKnee.y < leftHip.y && rightKnee.y < rightHip.y && leftKneeAngle < 90 && rightKneeAngle < 90 && leftAnkle.y < leftKnee.y && rightAnkle.y < rightKnee.y) {
        return { pose: 'Happy Baby Pose', confidence: avgConfidence };
      }

      // Corpse Pose
      if (Math.abs(shoulderCenterY - hipCenterY) < 50 && leftLegAngle > 160 && rightLegAngle > 160 && leftArmAngle > 160 && rightArmAngle > 160) {
        return { pose: 'Corpse Pose', confidence: avgConfidence };
      }

      // Reclined Pigeon Pose
      if (shoulderCenterY > hipCenterY - 40 && ((leftAnkle.x > rightKnee.x - 30 && leftAnkle.y < rightKnee.y + 30) || (rightAnkle.x > leftKnee.x - 30 && rightAnkle.y < leftKnee.y + 30))) {
        return { pose: 'Reclined Pigeon Pose', confidence: avgConfidence };
      }

      // KNEELING & ALL-FOURS
      // Cat Pose
      if (leftKnee.y > leftHip.y + 20 && rightKnee.y > rightHip.y + 20 && shoulderCenterY > hipCenterY - 30 && hipCenterY < shoulderCenterY + 30) {
        if (shoulderCenterY < hipCenterY - 10) {
          return { pose: 'Cat Pose', confidence: avgConfidence };
        }
        return { pose: 'Cow Pose', confidence: avgConfidence };
      }

      // Child's Pose
      if (leftKnee.y > leftHip.y + 30 && rightKnee.y > rightHip.y + 30 && shoulderCenterY > hipCenterY + 20 && nose.y > shoulderCenterY + 30) {
        return { pose: "Child's Pose", confidence: avgConfidence };
      }

      // Camel Pose - kneeling backbend
      if (leftKnee.y > leftHip.y + 20 && rightKnee.y > rightHip.y + 20 && shoulderCenterY < hipCenterY - 20 && wristCenterY > hipCenterY + 20) {
        return { pose: 'Camel Pose', confidence: avgConfidence };
      }

      // Pigeon Pose
      if ((leftKnee.y > leftHip.y && rightLegAngle > 150 && Math.abs(leftKnee.x - leftHip.x) < 80) ||
          (rightKnee.y > rightHip.y && leftLegAngle > 150 && Math.abs(rightKnee.x - rightHip.x) < 80)) {
        return { pose: 'Pigeon Pose', confidence: avgConfidence };
      }

      // PLANK VARIATIONS
      // Side Plank
      if (Math.abs(torsoAngle - 90) < 30 && (leftArmAngle > 150 || rightArmAngle > 150) && Math.abs(leftAnkle.x - rightAnkle.x) < 60) {
        return { pose: 'Side Plank', confidence: avgConfidence };
      }

      // Plank Pose
      if (torsoAngle < 30 && leftArmAngle > 150 && rightArmAngle > 150 && leftLegAngle > 150 && rightLegAngle > 150 && Math.abs(shoulderCenterY - hipCenterY) < 50) {
        return { pose: 'Plank Pose', confidence: avgConfidence };
      }

      // Downward Dog
      if (leftElbow.y > leftShoulder.y + 30 && rightElbow.y > rightShoulder.y + 30 && hipCenterY < shoulderCenterY - 40 && leftHipAngle < 140 && rightHipAngle < 140) {
        return { pose: 'Downward Dog', confidence: avgConfidence };
      }

      // SEATED POSES
      // Boat Pose
      if (hipCenterY < ankleCenterY && hipCenterY < shoulderCenterY && leftLegAngle > 140 && rightLegAngle > 140 && leftKnee.y < leftHip.y) {
        return { pose: 'Boat Pose', confidence: avgConfidence };
      }

      // Staff Pose
      if (leftLegAngle > 160 && rightLegAngle > 160 && Math.abs(shoulderCenterY - hipCenterY) < 40 && ankleCenterY > hipCenterY + 80) {
        return { pose: 'Staff Pose', confidence: avgConfidence };
      }

      // Seated Forward Bend
      if (leftLegAngle > 150 && rightLegAngle > 150 && shoulderCenterY > hipCenterY + 30 && nose.y > hipCenterY + 40) {
        return { pose: 'Seated Forward Bend', confidence: avgConfidence };
      }

      // Head to Knee Pose
      if ((leftLegAngle > 150 && rightKneeAngle < 100) || (rightLegAngle > 150 && leftKneeAngle < 100)) {
        if (shoulderCenterY > hipCenterY + 30) {
          return { pose: 'Head to Knee Pose', confidence: avgConfidence };
        }
      }

      // Half Lord of the Fishes (seated twist)
      if (((leftKnee.y > leftHip.y && rightKnee.x < leftKnee.x - 40) || (rightKnee.y > rightHip.y && leftKnee.x < rightKnee.x - 40)) &&
          Math.abs(shoulderCenterY - hipCenterY) < 60) {
        return { pose: 'Half Lord of the Fishes', confidence: avgConfidence };
      }

      // Bound Angle Pose
      if (leftKnee.y < leftHip.y + 40 && rightKnee.y < rightHip.y + 40 && Math.abs(leftAnkle.x - rightAnkle.x) < 60 && Math.abs(leftKnee.x - rightKnee.x) > 80) {
        return { pose: 'Bound Angle Pose', confidence: avgConfidence };
      }

      // Easy Pose (cross-legged)
      if (leftKnee.y > leftHip.y - 20 && rightKnee.y > rightHip.y - 20 && Math.abs(shoulderCenterY - hipCenterY) < 50 && Math.abs(leftKnee.x - rightKnee.x) > 60) {
        return { pose: 'Easy Pose', confidence: avgConfidence };
      }

      // Lotus Pose (similar to Easy but more compact)
      if (leftKnee.y > leftHip.y - 30 && rightKnee.y > rightHip.y - 30 && Math.abs(leftAnkle.x - rightAnkle.x) < 80 && leftAnkle.y < leftKnee.y) {
        return { pose: 'Lotus Pose', confidence: avgConfidence };
      }

      // Hero Pose
      if (leftKnee.y > leftHip.y + 40 && rightKnee.y > rightHip.y + 40 && Math.abs(leftAnkle.x - rightAnkle.x) < 40 && Math.abs(shoulderCenterY - hipCenterY) < 40) {
        if (shoulderCenterY > hipCenterY + 40) {
          return { pose: 'Reclined Hero Pose', confidence: avgConfidence };
        }
        return { pose: 'Hero Pose', confidence: avgConfidence };
      }

      // Cow Face Pose
      if (((leftElbow.y < leftShoulder.y && rightElbow.y > rightShoulder.y) || (rightElbow.y < rightShoulder.y && leftElbow.y > leftShoulder.y)) &&
          leftKnee.y > leftHip.y && rightKnee.y > rightHip.y) {
        return { pose: 'Cow Face Pose', confidence: avgConfidence };
      }

      // STANDING STRETCHES
      // Shoulder Opener Pose
      if (leftLegAngle > 150 && rightLegAngle > 150 && wristCenterY > hipCenterY && Math.abs(leftWrist.x - rightWrist.x) < 60) {
        return { pose: 'Shoulder Opener Pose', confidence: avgConfidence };
      }

      // Eight-Angle Pose
      if (leftWrist.y > leftShoulder.y && Math.abs(leftKnee.y - leftElbow.y) < 60 && leftAnkle.x > leftKnee.x + 60) {
        return { pose: 'Eight-Angle Pose', confidence: avgConfidence };
      }

      // Scorpion Pose (forearm balance with backbend)
      if (leftElbow.y > leftShoulder.y + 40 && hipCenterY < shoulderCenterY - 60 && ankleCenterY < shoulderCenterY - 40 && ankleCenterY > hipCenterY - 60) {
        return { pose: 'Scorpion Pose', confidence: avgConfidence };
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
            Join <b>Nannu</b> and pick a pose below to match – MediaPipe powers live tracking!
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
                      <li key={p.name} className="cursor-pointer" onClick={() => setSelectedPoseIndex(idx)}>
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