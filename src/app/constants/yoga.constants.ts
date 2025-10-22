// constants/yoga.constants.ts

// Paths
export const POSES_JSON_PATH = '/posesData.json';
export const MODEL_PATH = '/models/pose_landmarker_lite.task';
export const WASM_PATH = '/wasm';

// Camera settings
export const CAMERA_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 }
};

export const ZOOM_LIMITS = {
  min: 0.5,
  max: 2,
  step: 0.1
};

// Pose detection thresholds
export const DETECTION_THRESHOLDS = {
  minCriticalVisible: 3,
  minCriticalScore: 0.5,
  minLimbScore: 0.4,
  minAvgConfidence: 0.5,
  minPoseConfidence: 0.6,
  keypointVisibility: 0.2
};

// Skeleton drawing settings
export const SKELETON_SETTINGS = {
  detectedColor: '#00FF00',
  undetectedColor: '#FFA500',
  detectedLineWidth: 6,
  undetectedLineWidth: 4,
  detectedPointRadius: 8,
  undetectedPointRadius: 6,
  backgroundColor: 'rgba(0,255,0,0.04)'
};

// MediaPipe connections (body part connections for skeleton)
export const SKELETON_CONNECTIONS: [number, number][] = [
  [11, 13], [13, 15], [12, 14], [14, 16], // Arms
  [11, 12], // Shoulders
  [11, 23], [12, 24], [23, 24], // Torso
  [23, 25], [25, 27], [24, 26], [26, 28], // Legs
  [0, 1], [0, 2], [1, 3], [2, 4] // Face
];

// Sound settings
export const SOUND_SETTINGS = {
  frequency: 800,
  gain: 0.2,
  duration: 0.4
};

// Pose matching keywords for image detection
export const POSE_KEYWORDS = [
  'mountain', 'tree', 'warrior', 'chair', 'plank', 'downward',
  'child', 'bridge', 'cobra', 'triangle', 'forward', 'upward',
  'dancer', 'eagle', 'boat', 'camel', 'crow', 'pigeon'
];