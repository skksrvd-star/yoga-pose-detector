// utils/skeletonDrawer.ts
import { Keypoint } from '../types/yoga.types';
import { SKELETON_CONNECTIONS, SKELETON_SETTINGS, DETECTION_THRESHOLDS } from '../constants/yoga.constants';

export const drawSkeleton = (
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  keypoints: Keypoint[],
  detectedPose: string,
  confidence: number
) => {
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

  const skeletonColor = isPoseDetected ? SKELETON_SETTINGS.detectedColor : SKELETON_SETTINGS.undetectedColor;
  const lineWidth = isPoseDetected ? SKELETON_SETTINGS.detectedLineWidth : SKELETON_SETTINGS.undetectedLineWidth;
  const pointRadius = isPoseDetected ? SKELETON_SETTINGS.detectedPointRadius : SKELETON_SETTINGS.undetectedPointRadius;

  if (isPoseDetected) {
    ctx.fillStyle = SKELETON_SETTINGS.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw connections
  for (const [a, b] of SKELETON_CONNECTIONS) {
    const kp1 = keypoints[a];
    const kp2 = keypoints[b];
    if (kp1 && kp2 && (kp1.score ?? 1) > DETECTION_THRESHOLDS.keypointVisibility && (kp2.score ?? 1) > DETECTION_THRESHOLDS.keypointVisibility) {
      ctx.strokeStyle = skeletonColor;
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  }

  // Draw keypoints
  for (const k of keypoints) {
    if (!k) continue;
    if ((k.score ?? 1) > DETECTION_THRESHOLDS.keypointVisibility) {
      ctx.fillStyle = skeletonColor;
      ctx.beginPath();
      ctx.arc(k.x, k.y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(k.x, k.y, Math.max(2, pointRadius / 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw pose name
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = isPoseDetected ? SKELETON_SETTINGS.detectedColor : SKELETON_SETTINGS.undetectedColor;
  ctx.fillText(detectedPose.split('(')[0].trim(), canvas.width / 2, 36);

  // Draw confidence
  ctx.font = '16px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText(`Confidence: ${Math.round(confidence)}%`, canvas.width / 2, canvas.height - 20);
};