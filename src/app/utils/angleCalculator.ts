// utils/angleCalculator.ts
import { Keypoint } from '../types/yoga.types';

export const calculateAngle = (a: Keypoint, b: Keypoint, c: Keypoint): number => {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
};