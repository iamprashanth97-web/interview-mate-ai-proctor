import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { AlertType } from '../types';

interface ProctorEngineProps {
  onAlert: (type: AlertType, message: string, confidence: number) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onLoadingChange?: (loading: boolean) => void;
  isActive?: boolean;
}

export const ProctorEngine: React.FC<ProctorEngineProps> = ({ onAlert, videoRef, onLoadingChange, isActive = true }) => {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const requestRef = useRef<number>(0);
  const lastAlertTime = useRef<Record<string, number>>({});
  
  // Persistence counters to avoid flickers
  const multiPersonCount = useRef(0);
  const noPersonCount = useRef(0);
  const phoneCount = useRef(0);
  const gazeAwayCount = useRef(0);
  const focusLossCount = useRef(0);

  useEffect(() => {
    const handleBlur = () => {
      if (isActive) {
        focusLossCount.current++;
        let msg = 'Window lost focus - possible external AI tool usage';
        if (focusLossCount.current > 2) {
          msg = 'CRITICAL: Persistent window switching detected (AI Tool Risk)';
        }
        throttleAlert('WINDOW_LOST_FOCUS', msg, 1.0, 3000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        throttleAlert('WINDOW_LOST_FOCUS', 'Tab switched - this activity is recorded', 1.0, 3000);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);

  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
      } catch (err) {
        console.error("Failed to load TensorFlow model", err);
      } finally {
        setIsModelLoading(false);
        onLoadingChange?.(false);
      }
    };
    loadModel();
  }, [onLoadingChange]);

  const throttleAlert = (type: AlertType, message: string, confidence: number, cooldown = 8000) => {
    const now = Date.now();
    if (!lastAlertTime.current[type] || now - lastAlertTime.current[type] > cooldown) {
      onAlert(type, message, confidence);
      lastAlertTime.current[type] = now;
    }
  };

  const detect = async () => {
    if (isActive && model && videoRef.current && videoRef.current.readyState >= 2) {
      try {
        // We set a higher threshold (0.6) for the initial detection pass
        const predictions = await model.detect(videoRef.current, 10, 0.6);
        
        // Filter for valid 'person' detections:
        // 1. High score (>0.75 for multiple people detection to be safe)
        // 2. Reasonable size (ignore tiny background figures)
        const persons = predictions.filter(p => {
          if (p.class !== 'person') return false;
          
          const area = p.bbox[2] * p.bbox[3];
          const frameArea = videoRef.current!.videoWidth * videoRef.current!.videoHeight;
          const occupancy = area / frameArea;
          
          // Ignore small background detections (less than 5% of frame)
          // unless it's very high confidence
          if (occupancy < 0.05 && p.score < 0.85) return false;
          
          return p.score > 0.7;
        });

        // 1. NO PERSON DETECTION
        if (persons.length === 0) {
          noPersonCount.current++;
          if (noPersonCount.current > 30) { // ~1 second of no person
            throttleAlert('NO_FACE_DETECTED', 'Face not detected - please stay in frame', 1.0);
            noPersonCount.current = 0;
          }
        } else {
          noPersonCount.current = 0;
          
          // GAZE / READING DETECTION (Heuristic)
          // Check if person's face is centered or looking away
          const person = persons[0]; // Primary person
          const [x, y, width, height] = person.bbox;
          const videoWidth = videoRef.current!.videoWidth;
          const centerX = x + width / 2;
          
          // If head/person is consistently at the extreme edges, they might be reading a side monitor/overlay
          const relativeX = centerX / videoWidth;
          if (relativeX < 0.25 || relativeX > 0.75) {
            gazeAwayCount.current++;
            if (gazeAwayCount.current > 45) { // ~1.5 seconds of persistent side-looking
              throttleAlert('LOOKING_AWAY', 'Potential reading behavior (gaze redirected to external screen/script)', 0.9);
              gazeAwayCount.current = 0;
            }
          } else {
            gazeAwayCount.current = Math.max(0, gazeAwayCount.current - 1);
          }
        }

        // 2. MULTIPLE PEOPLE DETECTION
        if (persons.length > 1) {
          multiPersonCount.current++;
          if (multiPersonCount.current > 20) { // ~0.6 seconds of persistence
            throttleAlert('MULTIPLE_FACES', 'Multiple people detected in frame', 0.9);
            multiPersonCount.current = 0;
          }
        } else {
          // Slowly decay if not currently seeing multiple people
          multiPersonCount.current = Math.max(0, multiPersonCount.current - 2);
        }

        // 3. OBJECT DETECTION (Phone/Book)
        predictions.forEach(prediction => {
          if (prediction.class === 'cell phone' && prediction.score > 0.75) {
            phoneCount.current++;
            if (phoneCount.current > 15) {
              throttleAlert('PHONE_DETECTED', 'Mobile phone usage detected', prediction.score);
              phoneCount.current = 0;
            }
          }
          if (prediction.class === 'book' && prediction.score > 0.8) {
            throttleAlert('BOOK_DETECTED', 'Suspicious material detected', prediction.score);
          }
        });
        
        // Decay phone count
        if (!predictions.some(p => p.class === 'cell phone')) {
          phoneCount.current = Math.max(0, phoneCount.current - 1);
        }

      } catch (err) {
        console.warn("Detection cycle failed:", err);
      }
    }
    requestRef.current = requestAnimationFrame(detect);
  };

  useEffect(() => {
    if (model) {
      requestRef.current = requestAnimationFrame(detect);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [model, isActive]);

  return null;
};
