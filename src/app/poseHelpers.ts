// Helper type for a pose keypoint
export type Keypoint = {
  x: number;
  y: number;
  score?: number;
  name?: string;
  index?: number;
};

// Important keypoint pairs for angle calculations
// Format: [point1, vertex, point2] where vertex is the joint
export const ANGLE_PAIRS = {
  // Arms
  leftElbow: [11, 13, 15],    // Left shoulder-elbow-wrist
  rightElbow: [12, 14, 16],   // Right shoulder-elbow-wrist
  leftShoulder: [5, 11, 13],  // Left neck-shoulder-elbow
  rightShoulder: [6, 12, 14], // Right neck-shoulder-elbow

  // Legs
  leftKnee: [23, 25, 27],     // Left hip-knee-ankle
  rightKnee: [24, 26, 28],    // Right hip-knee-ankle
  leftHip: [11, 23, 25],      // Left shoulder-hip-knee
  rightHip: [12, 24, 26],     // Right shoulder-hip-knee

  // Torso
  leftTorso: [11, 23, 24],    // Left shoulder-left hip-right hip
  rightTorso: [12, 24, 23],   // Right shoulder-right hip-left hip
  torsoLeft: [11, 12, 24],    // Left shoulder-right shoulder-right hip
  torsoRight: [12, 11, 23]    // Right shoulder-left shoulder-left hip
};

// Core keypoints that are most important for pose recognition
export const CORE_KEYPOINTS = [
  5, 6, 7, 8, 9, 10,          // Face landmarks for orientation
  11, 12, 13, 14,             // Shoulders and arms
  23, 24, 25, 26, 27, 28      // Hips and legs
];

/**
 * Calculate the angle between three keypoints in degrees
 * @param a First point
 * @param b Vertex point (the joint)
 * @param c Third point
 * @returns Angle in degrees (0-180)
 */
export const calculateAngle = (a: Keypoint, b: Keypoint, c: Keypoint): number => {
  if (!a || !b || !c) return 0;

  // Calculate the angle of the vector BA (a - b)
  const angleBA = Math.atan2(a.y - b.y, a.x - b.x);

  // Calculate the angle of the vector BC (c - b)
  const angleBC = Math.atan2(c.y - b.y, c.x - b.x);

  // Calculate the difference between the two angles in radians
  let angleRadians = Math.abs(angleBC - angleBA);

  // Normalize the angle to be between 0 and PI radians (0 to 180 degrees)
  if (angleRadians > Math.PI) {
    angleRadians = 2 * Math.PI - angleRadians;
  }

  // Convert the angle from radians to degrees
  const angleDegrees = angleRadians * (180 / Math.PI);

  return angleDegrees;
};

/**
 * Extract all relevant angles from a pose
 * @param keypoints Array of keypoints
 * @returns Object mapping angle names to their values
 */
export const extractAngles = (keypoints: Keypoint[]): Record<string, number> => {
  const angles: Record<string, number> = {};

  for (const [name, [i1, i2, i3]] of Object.entries(ANGLE_PAIRS)) {
    const p1 = keypoints[i1];
    const p2 = keypoints[i2];
    const p3 = keypoints[i3];

    // Only calculate angle if all points exist with sufficient confidence
    if (
      p1 && p2 && p3 &&
      (p1.score ?? 0) > 0.3 &&
      (p2.score ?? 0) > 0.3 &&
      (p3.score ?? 0) > 0.3
    ) {
      angles[name] = calculateAngle(p1, p2, p3);
    }
  }

  return angles;
};

/**
 * Normalize keypoints using torso-based reference for better robustness
 * This approach is more robust to camera angles and body proportions
 * @param keypoints Array of keypoints to normalize
 * @returns Normalized keypoints
 */
export const normalizeKeypoints = (keypoints: Keypoint[]): Keypoint[] => {
  if (!keypoints || keypoints.length === 0) return [];

  // Try to use shoulder and hip points for torso-based normalization
  const leftShoulder = keypoints[11];
  const rightShoulder = keypoints[12];
  const leftHip = keypoints[23];
  const rightHip = keypoints[24];

  // Check if core torso points are available with good confidence
  const hasCorePoints =
    leftShoulder && rightShoulder && leftHip && rightHip &&
    (leftShoulder.score ?? 0) > 0.3 &&
    (rightShoulder.score ?? 0) > 0.3 &&
    (leftHip.score ?? 0) > 0.3 &&
    (rightHip.score ?? 0) > 0.3;

  if (hasCorePoints) {
    // Calculate center of torso
    const centerX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
    const centerY = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

    // Calculate torso dimensions for scaling
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
    const hipWidth = Math.abs(rightHip.x - leftHip.x);
    const torsoHeight = Math.abs(
      (leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2
    );

    // Use the larger dimension to ensure both x and y fit in normalized space
    const scale = Math.max(shoulderWidth, hipWidth, torsoHeight) * 2.5;

    if (scale > 0) {
      // Normalize relative to body center and scale
      return keypoints.map(kp => ({
        x: (kp.x - centerX) / scale + 0.5,
        y: (kp.y - centerY) / scale + 0.5,
        score: kp.score,
        name: kp.name,
        index: kp.index
      }));
    }
  }

  // Fallback to basic min-max normalization
  return basicNormalization(keypoints);
};

/**
 * Basic min-max normalization fallback
 * @param keypoints Array of keypoints
 * @returns Normalized keypoints
 */
const basicNormalization = (keypoints: Keypoint[]): Keypoint[] => {
  const xValues = keypoints.map(kp => kp.x);
  const yValues = keypoints.map(kp => kp.y);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  // Avoid division by zero
  if (rangeX === 0 || rangeY === 0) return keypoints;

  return keypoints.map(kp => ({
    x: (kp.x - minX) / rangeX,
    y: (kp.y - minY) / rangeY,
    score: kp.score,
    name: kp.name,
    index: kp.index
  }));
};

/**
 * Calculate similarity based on joint angles
 * Angles are more robust to camera position and body proportions
 * @param detectedAngles Angles from detected pose
 * @param referenceAngles Angles from reference pose
 * @returns Similarity score (0-1)
 */
export const calculateAngleSimilarity = (
  detectedAngles: Record<string, number>,
  referenceAngles: Record<string, number>
): number => {
  if (!detectedAngles || !referenceAngles) return 0;

  let totalDifference = 0;
  let anglesCompared = 0;

  for (const [name, refAngle] of Object.entries(referenceAngles)) {
    const detAngle = detectedAngles[name];
    if (detAngle === undefined) continue;

    // Calculate angular difference (normalized to 0-180 range)
    const diff = Math.abs(detAngle - refAngle);
    // Normalize to 0-1 range (180 degrees = max difference)
    totalDifference += diff / 180;
    anglesCompared++;
  }

  if (anglesCompared === 0) return 0;

  const avgDifference = totalDifference / anglesCompared;
  return Math.max(0, 1 - avgDifference);
};

/**
 * Calculate position-based similarity for core keypoints
 * @param detectedKeypoints Detected pose keypoints
 * @param referenceKeypoints Reference pose keypoints
 * @returns Position similarity score (0-1)
 */
const calculatePositionSimilarity = (
  detectedKeypoints: Keypoint[],
  referenceKeypoints: Keypoint[]
): number => {
  let totalDistance = 0;
  let keypointsUsed = 0;
  let totalConfidence = 0;

  // Focus on core keypoints for position comparison
  for (const index of CORE_KEYPOINTS) {
    const detectedKp = detectedKeypoints[index];
    const refKp = referenceKeypoints[index];

    if (!detectedKp || !refKp || (detectedKp.score ?? 0) < 0.3) continue;

    // Euclidean distance between normalized keypoints
    const distance = Math.sqrt(
      Math.pow(detectedKp.x - refKp.x, 2) + Math.pow(detectedKp.y - refKp.y, 2)
    );

    // Confidence-based weighting
    const weight = detectedKp.score ?? 0.5;
    totalDistance += distance * weight;
    totalConfidence += weight;
    keypointsUsed++;
  }

  // Require minimum keypoint matches
  if (keypointsUsed < Math.min(8, CORE_KEYPOINTS.length / 2)) {
    return 0;
  }

  const avgDistance = keypointsUsed > 0 ? totalDistance / totalConfidence : 1;
  return Math.max(0, 1 - avgDistance);
};

/**
 * Enhanced pose similarity calculation combining position and angles
 * @param detectedKeypoints Keypoints from detected pose
 * @param referenceKeypoints Keypoints from reference pose
 * @returns Combined similarity score (0-1)
 */
export const calculatePoseSimilarity = (
  detectedKeypoints: Keypoint[],
  referenceKeypoints: Keypoint[]
): number => {
  if (!detectedKeypoints || !referenceKeypoints || referenceKeypoints.length === 0)
    return 0;

  // Position-based similarity (40% weight)
  const positionSimilarity = calculatePositionSimilarity(
    detectedKeypoints,
    referenceKeypoints
  );

  // Angle-based similarity (60% weight)
  const detectedAngles = extractAngles(detectedKeypoints);
  const referenceAngles = extractAngles(referenceKeypoints);
  const angleSimilarity = calculateAngleSimilarity(detectedAngles, referenceAngles);

  // Combined weighted score
  // Angles are more important as they're invariant to scale and position
  const combinedScore = positionSimilarity * 0.4 + angleSimilarity * 0.6;

  return combinedScore;
};

/**
 * Smooth pose detection over time to reduce jitter and false detections
 * Tracks recent pose detections and returns the most consistent pose
 */
export class PoseDetectionSmoother {
  private recentPoses: { pose: string; confidence: number; timestamp: number }[] = [];
  private maxHistoryLength = 10;
  private consistencyThreshold = 0.4; // 40% of frames must match

   constructor(options: {
    maxHistoryLength?: number;
    consistencyThreshold?: number
   } = {}){
    this.maxHistoryLength = options.maxHistoryLength ?? 10;
    this.consistencyThreshold = options.consistencyThreshold ?? 0.4
   }

  /**
   * Add a new pose detection to the history
   * @param detection Object with pose name and confidence score
   */
  addPoseDetection(detection: { pose: string; confidence: number }): void {
    const now = Date.now();
    this.recentPoses.push({ ...detection, timestamp: now });

    // Keep only the most recent N detections
    if (this.recentPoses.length > this.maxHistoryLength) {
      this.recentPoses.shift(); // Remove oldest detection
    }

    // Remove detections older than 2 seconds
    this.recentPoses = this.recentPoses.filter(
      p => now - p.timestamp < 2000
    );
  }

  /**
   * Get the most consistent (smoothed) pose from recent history
   * Only returns a pose if it appears consistently across frames
   * @returns Object with pose name and confidence, or Unknown if no consistent pose
   */
  getSmoothedPose(): { pose: string; confidence: number } {
    if (this.recentPoses.length < 3) {
      // Need at least 3 frames for consistency check
      return { pose: 'Unknown', confidence: 0 };
    }

    // Count occurrences of each pose and accumulate confidence
    const poseCounts: Record<string, { count: number; totalConfidence: number }> = {};

    for (const detection of this.recentPoses) {
      if (!poseCounts[detection.pose]) {
        poseCounts[detection.pose] = { count: 0, totalConfidence: 0 };
      }
      poseCounts[detection.pose].count++;
      poseCounts[detection.pose].totalConfidence += detection.confidence;
    }

    // Find the most frequent pose with sufficient consistency
    let bestPose = 'Unknown';
    let bestScore = 0;

    for (const pose in poseCounts) {
      const { count, totalConfidence } = poseCounts[pose];
      const consistency = count / this.recentPoses.length;

      // Must appear in at least 40% of recent frames
      if (consistency >= this.consistencyThreshold) {
        const avgConfidence = totalConfidence / count;
        // Weighted score: consistency (70%) + confidence (30%)
        const score = consistency * 0.7 + avgConfidence * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestPose = pose;
        }
      }
    }

    // Calculate final confidence
    const finalConfidence = bestPose !== 'Unknown' ? bestScore : 0;

    return { pose: bestPose, confidence: finalConfidence };
  }

  /**
   * Reset the detection history
   */
  reset(): void {
    this.recentPoses = [];
  }

  /**
   * Get current history size for debugging
   * @returns Number of poses in history
   */
  getHistorySize(): number {
    return this.recentPoses.length;
  }

  /**
   * Get the full detection history for debugging
   * @returns Array of recent pose detections
   */
  getHistory(): { pose: string; confidence: number; timestamp: number }[] {
    return [...this.recentPoses];
  }
}