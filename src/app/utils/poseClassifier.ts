// utils/poseClassifier.ts
import { Keypoint, PoseClassification } from '../types/yoga.types';
import { calculateAngle } from './angleCalculator';
import { DETECTION_THRESHOLDS } from '../constants/yoga.constants';

export const classifyPose = (kps: Keypoint[]): PoseClassification => {
  if (!kps || kps.length < 17) return { pose: 'Unknown', confidence: 0 };

  const kp = (idx: number) => kps[idx] ?? { x: 0, y: 0, score: 0 };

  // Extract all keypoints
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

  // CRITICAL: Check if full body is actually visible
  // Require BOTH hips AND at least 3 out of 4 leg points with HIGH confidence
  const hipScore = Math.min(leftHip.score ?? 0, rightHip.score ?? 0);
  const legKeypoints = [leftKnee, rightKnee, leftAnkle, rightAnkle];
  const visibleLegKeypoints = legKeypoints.filter(k => (k.score ?? 0) > 0.5).length;

  // If we don't have both hips clearly visible OR less than 3 leg keypoints, abort
  if (hipScore < 0.4 || visibleLegKeypoints < 3) {
    return { pose: 'Unknown', confidence: 0 };
  }

  // Validate critical body parts
  const criticalBodyParts = [leftShoulder, rightShoulder, leftHip, rightHip];
  const limbParts = [leftElbow, rightElbow, leftWrist, rightWrist, leftKnee, rightKnee, leftAnkle, rightAnkle];

  const criticalScores = criticalBodyParts.map(k => k.score ?? 0);
  const criticalVisible = criticalScores.filter(s => s > DETECTION_THRESHOLDS.minCriticalScore).length;
  const avgCriticalScore = criticalScores.reduce((a, b) => a + b, 0) / 4;

  if (criticalVisible < DETECTION_THRESHOLDS.minCriticalVisible || avgCriticalScore < DETECTION_THRESHOLDS.minCriticalScore) {
    return { pose: 'Unknown', confidence: 0 };
  }

  const limbScores = limbParts.map(k => k.score ?? 0);
  const allScores = [...criticalScores, ...limbScores].filter(s => s > 0.3);
  const avgConfidence = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

  if (avgConfidence < DETECTION_THRESHOLDS.minAvgConfidence) return { pose: 'Unknown', confidence: 0 };

  // Calculate all angles
  const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  const rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
  const leftLegAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightLegAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
  const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
  const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  // Calculate center points
  const hipCenterY = (leftHip.y + rightHip.y) / 2;
  const hipCenterX = (leftHip.x + rightHip.x) / 2;
  const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const ankleCenterY = (leftAnkle.y + rightAnkle.y) / 2;
  const wristCenterY = (leftWrist.y + rightWrist.y) / 2;

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const ankleWidth = Math.abs(leftAnkle.x - rightAnkle.x);
  const torsoAngle = Math.abs(Math.atan2(hipCenterY - shoulderCenterY, hipCenterX - shoulderCenterX) * 180 / Math.PI);

  // INVERSIONS & ARM BALANCES
  if (nose.y > shoulderCenterY + 50 && ankleCenterY < shoulderCenterY - 80 && Math.abs(leftAnkle.x - rightAnkle.x) < 100) {
    return { pose: 'Headstand', confidence: avgConfidence };
  }
  if (wristCenterY > shoulderCenterY + 20 && ankleCenterY < shoulderCenterY - 100 && leftLegAngle > 150 && rightLegAngle > 150) {
    return { pose: 'Handstand', confidence: avgConfidence };
  }
  if (leftElbow.y > leftShoulder.y + 30 && rightElbow.y > rightShoulder.y + 30 && ankleCenterY < shoulderCenterY - 80) {
    return { pose: 'Forearm Stand', confidence: avgConfidence };
  }
  if (shoulderCenterY > hipCenterY + 80 && ankleCenterY < shoulderCenterY - 50 && leftLegAngle > 150 && rightLegAngle > 150) {
    return { pose: 'Shoulder Stand', confidence: avgConfidence };
  }
  if (shoulderCenterY > hipCenterY + 60 && leftKnee.y < shoulderCenterY && rightKnee.y < shoulderCenterY) {
    return { pose: 'Plow Pose', confidence: avgConfidence };
  }
  if (leftElbow.y > leftShoulder.y && rightElbow.y > rightShoulder.y && leftKnee.y < leftHip.y && rightKnee.y < rightHip.y && Math.abs(leftAnkle.y - rightAnkle.y) < 100 && leftAnkle.y < leftHip.y) {
    return { pose: 'Crow Pose', confidence: avgConfidence };
  }
  if (leftElbow.y > leftShoulder.y && Math.abs(leftKnee.x - leftElbow.x) < 80 && leftAnkle.y < leftHip.y) {
    return { pose: 'Side Crow Pose', confidence: avgConfidence };
  }
  if (Math.abs(shoulderCenterY - hipCenterY) < 40 && wristCenterY > shoulderCenterY && leftArmAngle < 100 && rightArmAngle < 100) {
    return { pose: 'Peacock Pose', confidence: avgConfidence };
  }
  if (leftWrist.y > leftShoulder.y && leftKnee.y < leftHip.y && leftAnkle.x > leftKnee.x + 80) {
    return { pose: 'Firefly Pose', confidence: avgConfidence };
  }

  // STANDING BALANCE POSES
  if ((leftLegAngle > 150 && rightKnee.y < rightHip.y - 30 && Math.abs(rightKnee.x - leftHip.x) < 50) ||
      (rightLegAngle > 150 && leftKnee.y < leftHip.y - 30 && Math.abs(leftKnee.x - rightHip.x) < 50)) {
    return { pose: 'Tree Pose', confidence: avgConfidence };
  }
  if (((leftKnee.x < rightKnee.x - 20 && leftAnkle.x > rightAnkle.x + 20) || (rightKnee.x < leftKnee.x - 20 && rightAnkle.x > leftAnkle.x + 20)) &&
      ((leftElbow.x > rightElbow.x && leftWrist.x < rightWrist.x) || (rightElbow.x > leftElbow.x && rightWrist.x < leftWrist.x))) {
    return { pose: 'Eagle Pose', confidence: avgConfidence };
  }
  if ((leftLegAngle > 150 && rightAnkle.y < rightHip.y - 40 && rightKnee.y < rightHip.y) ||
      (rightLegAngle > 150 && leftAnkle.y < leftHip.y - 40 && leftKnee.y < leftHip.y)) {
    if ((leftWrist.y < leftHip.y && rightWrist.y > rightHip.y + 50) || (rightWrist.y < rightHip.y && leftWrist.y > leftHip.y + 50)) {
      return { pose: 'King Dancer Pose', confidence: avgConfidence };
    }
    return { pose: 'Dancer Pose', confidence: avgConfidence };
  }
  if ((leftLegAngle > 150 && rightLegAngle > 150 && Math.abs(rightAnkle.x - leftAnkle.x) > 100 && torsoAngle > 60) ||
      (torsoAngle > 60 && Math.abs(leftWrist.y - rightWrist.y) > 120)) {
    return { pose: 'Half Moon Pose', confidence: avgConfidence };
  }
  if ((leftLegAngle > 150 && rightAnkle.y < shoulderCenterY - 80) || (rightLegAngle > 150 && leftAnkle.y < shoulderCenterY - 80)) {
    return { pose: 'Standing Split', confidence: avgConfidence };
  }
  if ((leftLegAngle > 150 && rightLegAngle > 150 && Math.abs(rightAnkle.y - shoulderCenterY) < 80 && rightAnkle.x > rightHip.x + 50) ||
      (rightLegAngle > 150 && leftLegAngle > 150 && Math.abs(leftAnkle.y - shoulderCenterY) < 80 && leftAnkle.x > leftHip.x + 50)) {
    return { pose: 'Warrior III', confidence: avgConfidence };
  }

  // STANDING POSES
  if (leftKneeAngle < 120 && rightKneeAngle < 120 && leftKneeAngle > 60 && rightKneeAngle > 60 && ankleWidth < 80) {
    if (wristCenterY < shoulderCenterY - 40) {
      return { pose: 'Chair Pose', confidence: avgConfidence };
    }
  }
  if ((leftKneeAngle < 130 && rightLegAngle > 150 && ankleWidth > 100) || (rightKneeAngle < 130 && leftLegAngle > 150 && ankleWidth > 100)) {
    if (wristCenterY < shoulderCenterY - 50) {
      return { pose: 'Warrior I', confidence: avgConfidence };
    }
  }
  if ((leftKneeAngle < 130 && rightLegAngle > 150) || (rightKneeAngle < 130 && leftLegAngle > 150)) {
    if (Math.abs(leftWrist.y - leftShoulder.y) < 50 && Math.abs(rightWrist.y - rightShoulder.y) < 50 && Math.abs(leftWrist.x - rightWrist.x) > 150) {
      return { pose: 'Warrior II', confidence: avgConfidence };
    }
  }
  if (ankleWidth > 150 && leftLegAngle > 150 && rightLegAngle > 150 && Math.abs(leftWrist.y - rightWrist.y) > 100) {
    if (torsoAngle > 50) {
      return { pose: 'Revolved Triangle Pose', confidence: avgConfidence };
    }
    return { pose: 'Triangle Pose', confidence: avgConfidence };
  }
  if (ankleWidth > 150 && shoulderCenterY > hipCenterY + 60 && nose.y > hipCenterY) {
    return { pose: 'Wide-Legged Forward Bend', confidence: avgConfidence };
  }
  if (leftLegAngle > 150 && rightLegAngle > 150 && shoulderCenterY > hipCenterY + 80 && nose.y > hipCenterY + 40) {
    return { pose: 'Standing Forward Bend', confidence: avgConfidence };
  }
  if (leftLegAngle > 150 && rightLegAngle > 150 && ankleWidth > 60 && shoulderCenterY > hipCenterY + 50) {
    return { pose: 'Intense Side Stretch', confidence: avgConfidence };
  }
  if (leftKneeAngle < 80 && rightKneeAngle < 80 && hipCenterY > ankleCenterY - 80 && Math.abs(leftWrist.x - rightWrist.x) < 60 && wristCenterY > shoulderCenterY) {
    return { pose: 'Garland Pose', confidence: avgConfidence };
  }
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
  if ((leftKneeAngle < 120 && rightLegAngle > 150) || (rightKneeAngle < 120 && leftLegAngle > 150)) {
    if (wristCenterY < shoulderCenterY - 40) {
      return { pose: 'High Lunge', confidence: avgConfidence };
    }
  }
  if ((leftKnee.y > leftHip.y + 30 && rightKneeAngle < 120) || (rightKnee.y > rightHip.y + 30 && leftKneeAngle < 120)) {
    return { pose: 'Low Lunge', confidence: avgConfidence };
  }

  // FLOOR POSES - PRONE
  if (shoulderCenterY < hipCenterY - 20 && leftArmAngle < 150 && rightArmAngle < 150 && nose.y < shoulderCenterY) {
    return { pose: 'Cobra Pose', confidence: avgConfidence };
  }
  if (shoulderCenterY < hipCenterY - 30 && leftArmAngle > 150 && rightArmAngle > 150 && nose.y < shoulderCenterY) {
    return { pose: 'Upward Dog', confidence: avgConfidence };
  }
  if (shoulderCenterY < hipCenterY && leftKneeAngle < 100 && rightKneeAngle < 100 && leftAnkle.y < leftHip.y && rightAnkle.y < rightHip.y && leftWrist.y < leftShoulder.y) {
    return { pose: 'Bow Pose', confidence: avgConfidence };
  }
  if (shoulderCenterY < hipCenterY && leftLegAngle > 160 && rightLegAngle > 160 && ankleCenterY < hipCenterY - 20) {
    return { pose: 'Locust Pose', confidence: avgConfidence };
  }
  if (shoulderCenterY < hipCenterY && (leftKneeAngle < 90 || rightKneeAngle < 90) && (leftAnkle.y < leftHip.y - 20 || rightAnkle.y < rightHip.y - 20)) {
    if (leftKneeAngle < 90 && rightKneeAngle < 90) {
      return { pose: 'Full Frog Pose', confidence: avgConfidence };
    }
    return { pose: 'Half Frog Pose', confidence: avgConfidence };
  }

  // FLOOR POSES - SUPINE
  if (shoulderCenterY > hipCenterY + 40 && leftKnee.y > leftHip.y && rightKnee.y > rightHip.y && leftKneeAngle < 120 && rightKneeAngle < 120) {
    return { pose: 'Bridge Pose', confidence: avgConfidence };
  }
  if (shoulderCenterY > hipCenterY + 20 && nose.y > shoulderCenterY + 40 && leftLegAngle > 160 && rightLegAngle > 160) {
    return { pose: 'Fish Pose', confidence: avgConfidence };
  }
  if (shoulderCenterY > hipCenterY - 20 && leftKnee.y < leftHip.y && rightKnee.y < rightHip.y && leftKneeAngle < 90 && rightKneeAngle < 90 && leftAnkle.y < leftKnee.y && rightAnkle.y < rightKnee.y) {
    return { pose: 'Happy Baby Pose', confidence: avgConfidence };
  }
  if (Math.abs(shoulderCenterY - hipCenterY) < 50 && leftLegAngle > 160 && rightLegAngle > 160 && leftArmAngle > 160 && rightArmAngle > 160) {
    return { pose: 'Corpse Pose', confidence: avgConfidence };
  }
  if (shoulderCenterY > hipCenterY - 40 && ((leftAnkle.x > rightKnee.x - 30 && leftAnkle.y < rightKnee.y + 30) || (rightAnkle.x > leftKnee.x - 30 && rightAnkle.y < leftKnee.y + 30))) {
    return { pose: 'Reclined Pigeon Pose', confidence: avgConfidence };
  }

  // KNEELING & ALL-FOURS
  if (leftKnee.y > leftHip.y + 20 && rightKnee.y > rightHip.y + 20 && shoulderCenterY > hipCenterY - 30 && hipCenterY < shoulderCenterY + 30) {
    if (shoulderCenterY < hipCenterY - 10) {
      return { pose: 'Cat Pose', confidence: avgConfidence };
    }
    return { pose: 'Cow Pose', confidence: avgConfidence };
  }
  if (leftKnee.y > leftHip.y + 30 && rightKnee.y > rightHip.y + 30 && shoulderCenterY > hipCenterY + 20 && nose.y > shoulderCenterY + 30) {
    return { pose: "Child's Pose", confidence: avgConfidence };
  }
  if (leftKnee.y > leftHip.y + 20 && rightKnee.y > rightHip.y + 20 && shoulderCenterY < hipCenterY - 20 && wristCenterY > hipCenterY + 20) {
    return { pose: 'Camel Pose', confidence: avgConfidence };
  }
  if ((leftKnee.y > leftHip.y && rightLegAngle > 150 && Math.abs(leftKnee.x - leftHip.x) < 80) ||
      (rightKnee.y > rightHip.y && leftLegAngle > 150 && Math.abs(rightKnee.x - rightHip.x) < 80)) {
    return { pose: 'Pigeon Pose', confidence: avgConfidence };
  }

  // PLANK VARIATIONS
  if (Math.abs(torsoAngle - 90) < 30 && (leftArmAngle > 150 || rightArmAngle > 150) && Math.abs(leftAnkle.x - rightAnkle.x) < 60) {
    return { pose: 'Side Plank', confidence: avgConfidence };
  }
  if (torsoAngle < 30 && leftArmAngle > 150 && rightArmAngle > 150 && leftLegAngle > 150 && rightLegAngle > 150 && Math.abs(shoulderCenterY - hipCenterY) < 50) {
    return { pose: 'Plank Pose', confidence: avgConfidence };
  }
  if (leftElbow.y > leftShoulder.y + 30 && rightElbow.y > rightShoulder.y + 30 && hipCenterY < shoulderCenterY - 40 && leftHipAngle < 140 && rightHipAngle < 140) {
    return { pose: 'Downward Dog', confidence: avgConfidence };
  }

  // SEATED POSES
  if (hipCenterY < ankleCenterY && hipCenterY < shoulderCenterY && leftLegAngle > 140 && rightLegAngle > 140 && leftKnee.y < leftHip.y) {
    return { pose: 'Boat Pose', confidence: avgConfidence };
  }
  if (leftLegAngle > 160 && rightLegAngle > 160 && Math.abs(shoulderCenterY - hipCenterY) < 40 && ankleCenterY > hipCenterY + 80) {
    return { pose: 'Staff Pose', confidence: avgConfidence };
  }
  if (leftLegAngle > 150 && rightLegAngle > 150 && shoulderCenterY > hipCenterY + 30 && nose.y > hipCenterY + 40) {
    return { pose: 'Seated Forward Bend', confidence: avgConfidence };
  }
  if ((leftLegAngle > 150 && rightKneeAngle < 100) || (rightLegAngle > 150 && leftKneeAngle < 100)) {
    if (shoulderCenterY > hipCenterY + 30) {
      return { pose: 'Head to Knee Pose', confidence: avgConfidence };
    }
  }
  if (((leftKnee.y > leftHip.y && rightKnee.x < leftKnee.x - 40) || (rightKnee.y > rightHip.y && leftKnee.x < rightKnee.x - 40)) &&
      Math.abs(shoulderCenterY - hipCenterY) < 60) {
    return { pose: 'Half Lord of the Fishes', confidence: avgConfidence };
  }
  if (leftKnee.y < leftHip.y + 40 && rightKnee.y < rightHip.y + 40 && Math.abs(leftAnkle.x - rightAnkle.x) < 60 && Math.abs(leftKnee.x - rightKnee.x) > 80) {
    return { pose: 'Bound Angle Pose', confidence: avgConfidence };
  }
  if (leftKnee.y > leftHip.y - 20 && rightKnee.y > rightHip.y - 20 && Math.abs(shoulderCenterY - hipCenterY) < 50 && Math.abs(leftKnee.x - rightKnee.x) > 60) {
    return { pose: 'Easy Pose', confidence: avgConfidence };
  }
  if (leftKnee.y > leftHip.y - 30 && rightKnee.y > rightHip.y - 30 && Math.abs(leftAnkle.x - rightAnkle.x) < 80 && leftAnkle.y < leftKnee.y) {
    return { pose: 'Lotus Pose', confidence: avgConfidence };
  }
  if (leftKnee.y > leftHip.y + 40 && rightKnee.y > rightHip.y + 40 && Math.abs(leftAnkle.x - rightAnkle.x) < 40 && Math.abs(shoulderCenterY - hipCenterY) < 40) {
    if (shoulderCenterY > hipCenterY + 40) {
      return { pose: 'Reclined Hero Pose', confidence: avgConfidence };
    }
    return { pose: 'Hero Pose', confidence: avgConfidence };
  }
  if (((leftElbow.y < leftShoulder.y && rightElbow.y > rightShoulder.y) || (rightElbow.y < rightShoulder.y && leftElbow.y > leftShoulder.y)) &&
      leftKnee.y > leftHip.y && rightKnee.y > rightHip.y) {
    return { pose: 'Cow Face Pose', confidence: avgConfidence };
  }

  // OTHER POSES
  if (leftLegAngle > 150 && rightLegAngle > 150 && wristCenterY > hipCenterY && Math.abs(leftWrist.x - rightWrist.x) < 60) {
    return { pose: 'Shoulder Opener Pose', confidence: avgConfidence };
  }
  if (leftWrist.y > leftShoulder.y && Math.abs(leftKnee.y - leftElbow.y) < 60 && leftAnkle.x > leftKnee.x + 60) {
    return { pose: 'Eight-Angle Pose', confidence: avgConfidence };
  }
  if (leftElbow.y > leftShoulder.y + 40 && hipCenterY < shoulderCenterY - 60 && ankleCenterY < shoulderCenterY - 40 && ankleCenterY > hipCenterY - 60) {
    return { pose: 'Scorpion Pose', confidence: avgConfidence };
  }

  return { pose: 'Unknown Pose', confidence: avgConfidence };
};