// utils/dataLoader.ts
import { PoseDataItem } from '../types/yoga.types';
import { MODEL_PATH, WASM_PATH } from '../constants/yoga.constants';

export const loadPoseModel = async (
  setIsLoading: (loading: boolean) => void,
  setIsModelLoaded: (loaded: boolean) => void,
  setError: (error: string) => void,
  landmarkerRef: React.MutableRefObject<any>,
  cancelled: boolean
) => {
  try {
    setIsLoading(true);
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
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

export const loadPosesData = async (
  posesJsonPath: string,
  setPosesData: (data: PoseDataItem[]) => void,
  setError: (error: string | ((prev: string) => string)) => void
) => {
  try {
    const res = await fetch(posesJsonPath);
    if (!res.ok) throw new Error('Failed to fetch poses JSON');
    const data = await res.json();

    const filteredData = data.filter((pose: PoseDataItem) =>
      !pose.name.toLowerCase().includes('unknown')
    );
    setPosesData(filteredData);
  } catch (e) {
    console.error(e);
    setError(prev => prev ? prev : 'Failed to load poses data.');
  }
};