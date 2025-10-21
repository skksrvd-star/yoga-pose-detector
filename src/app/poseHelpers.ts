// Helper type for a pose keypoint
export type Keypoint = {
  x: number;
  y: number;
  score?: number;
  name?: string;
  index?:number;
};

// Normalize keypoints to 0–1 range for comparison
export const normalizeKeypoints = (keypoints: Keypoint[]): Keypoint[] => {
  if (!keypoints || keypoints.length === 0) return [];

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
    name: kp.name
  }));
};

export const calculatePoseSimilarity = (
  detectedKeypoints: Keypoint[],
  referenceKeypoints: Keypoint[]
): number => {
  if (!detectedKeypoints || !referenceKeypoints || referenceKeypoints.length === 0)
    return 0;

  let totalDistance = 0;
  let keypointsUsed = 0;
  let totalConfidence = 0;

  // Compare each reference keypoint to detected keypoint
  referenceKeypoints.forEach(refKp => {
    const index = refKp.index !== undefined ? refKp.index : Number(refKp.name?.replace('kp','') ?? 0);
    const detectedKp = detectedKeypoints[index];
    if (!detectedKp || (detectedKp.score ?? 0) < 0.3) return;

    // Euclidean distance between normalized keypoints
    const distance = Math.sqrt(
      Math.pow(detectedKp.x - refKp.x, 2) + Math.pow(detectedKp.y - refKp.y, 2)
    );

    // Confidence-based weighting
    const weight = detectedKp.score ?? 0.5;
    totalDistance += distance * weight;
    totalConfidence += weight;
    keypointsUsed++;
  });

  // Penalize if too few keypoints were matched
  if (keypointsUsed < Math.min(8, referenceKeypoints.length / 2)) {
    return 0;
  }

  const avgDistance = keypointsUsed >0 ? totalDistance/totalConfidence : Number.MAX_VALUE;
  const similiarity = Math.max(0, 1 - avgDistance);

  return similiarity ;
};
