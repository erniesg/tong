'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import Link from 'next/link';
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Pose presets — quaternion overrides per joint                      */
/*  Default = original arms-crossed rest pose from GLB                */
/* ------------------------------------------------------------------ */

type Pose = { label: string; joints: Record<string, [number, number, number, number]> };

/*
 * NOTE: This model was sculpted in arms-crossed pose. Arbitrary bone rotations
 * tear the mesh because the geometry wasn't weight-painted for other positions.
 * To add real poses, export animations from Blender/Mixamo as GLB clips.
 * For now, only subtle head/spine adjustments work safely.
 */
const POSES: Pose[] = [
  { label: 'Default', joints: {} },
  {
    label: 'Look Left',
    joints: {
      Head: [0.0, 0.15, 0.0, 0.99],
      Neck: [0.03, 0.1, 0.03, 0.99],
    },
  },
  {
    label: 'Look Right',
    joints: {
      Head: [0.0, -0.15, 0.0, 0.99],
      Neck: [0.03, -0.1, 0.03, 0.99],
    },
  },
  {
    label: 'Tilt',
    joints: {
      Head: [0.0, 0.0, 0.12, 0.99],
      Neck: [0.03, 0.0, 0.08, 0.99],
      Spine2: [-0.03, 0.0, 0.05, 1.0],
    },
  },
  {
    label: 'Look Down',
    joints: {
      Head: [0.12, 0.0, 0.0, 0.99],
      Neck: [0.1, 0.0, 0.0, 0.99],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  3D Model                                                          */
/* ------------------------------------------------------------------ */

const restQuats = new Map<string, THREE.Quaternion>();

function HauenModel({
  position,
  scale,
  rotation,
  poseIndex,
}: {
  position: [number, number, number];
  scale: number;
  rotation: [number, number, number];
  poseIndex: number;
}) {
  const { scene } = useGLTF('/models/hauen.glb');
  const ref = useRef<THREE.Group>(null!);
  const bonesReady = useRef(false);

  useEffect(() => {
    if (bonesReady.current) return;
    scene.traverse((obj) => {
      if ((obj as THREE.Bone).isBone) {
        restQuats.set(obj.name, obj.quaternion.clone());
      }
    });
    bonesReady.current = true;
  }, [scene]);

  useEffect(() => {
    const pose = POSES[poseIndex];
    if (!pose) return;
    scene.traverse((obj) => {
      if (!(obj as THREE.Bone).isBone) return;
      const override = pose.joints[obj.name];
      if (override) {
        obj.quaternion.set(...override).normalize();
      } else {
        const rest = restQuats.get(obj.name);
        if (rest) obj.quaternion.copy(rest);
      }
    });
  }, [poseIndex, scene]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(...position);
    ref.current.scale.setScalar(scale);
    ref.current.rotation.set(...rotation);
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Camera auto-resize                                                */
/* ------------------------------------------------------------------ */

function AutoResize() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const handle = () => {
      const { width, height } = gl.domElement.getBoundingClientRect();
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };
    window.addEventListener('resize', handle);
    handle();
    return () => window.removeEventListener('resize', handle);
  }, [camera, gl]);
  return null;
}

/* ------------------------------------------------------------------ */
/*  Selfie Page                                                       */
/* ------------------------------------------------------------------ */

const SEGMENTER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export default function SelfiePage() {
  /* camera */
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  /* 3D model transforms */
  const [modelPos, setModelPos] = useState<[number, number, number]>([0, -1, 0]);
  const [modelScale, setModelScale] = useState(1.4);
  const [modelRot, setModelRot] = useState<[number, number, number]>([0, 0, 0]);
  const [poseIndex, setPoseIndex] = useState(0);

  /* behind mode (body segmentation) */
  const [behindMode, setBehindMode] = useState(false);
  const [segReady, setSegReady] = useState(false);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const personCanvasRef = useRef<HTMLCanvasElement>(null);
  const segLoopRef = useRef<number>(0);

  /* capture */
  const [captures, setCaptures] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  /* gesture tracking */
  const dragging = useRef(false);
  const rotating = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const pinchDist = useRef<number | null>(null);
  const pinchAngle = useRef<number | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /* ---- start / stop camera ---- */
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
          setCameraError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof DOMException && err.name === 'NotAllowedError'
              ? 'Camera access denied. Please allow camera in your browser settings.'
              : 'Could not access camera.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  /* ---- init segmenter when behind mode toggled on ---- */
  useEffect(() => {
    if (!behindMode) {
      /* stop segmentation loop */
      if (segLoopRef.current) cancelAnimationFrame(segLoopRef.current);
      const pc = personCanvasRef.current;
      if (pc) {
        const ctx = pc.getContext('2d');
        ctx?.clearRect(0, 0, pc.width, pc.height);
      }
      return;
    }

    let cancelled = false;

    (async () => {
      /* create segmenter if needed */
      if (!segmenterRef.current) {
        try {
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
          );
          segmenterRef.current = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: { modelAssetPath: SEGMENTER_MODEL },
            runningMode: 'VIDEO',
            outputCategoryMask: true,
            outputConfidenceMasks: true,
          });
          if (!cancelled) setSegReady(true);
        } catch {
          if (!cancelled) setBehindMode(false);
          return;
        }
      }

      /* segmentation loop */
      const loop = () => {
        if (cancelled) return;
        const video = videoRef.current;
        const pc = personCanvasRef.current;
        const seg = segmenterRef.current;
        if (!video || !pc || !seg || video.readyState < 2) {
          segLoopRef.current = requestAnimationFrame(loop);
          return;
        }

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (pc.width !== vw) pc.width = vw;
        if (pc.height !== vh) pc.height = vh;

        const result = seg.segmentForVideo(video, performance.now());
        /* try confidence mask first (float 0-1), fall back to category mask */
        const confMask = result.confidenceMasks?.[0]?.getAsFloat32Array?.();
        const catMask = result.categoryMask?.getAsUint8Array?.();

        if (!confMask && !catMask) {
          segLoopRef.current = requestAnimationFrame(loop);
          return;
        }

        const ctx = pc.getContext('2d', { willReadFrequently: true })!;
        ctx.clearRect(0, 0, vw, vh);
        ctx.drawImage(video, 0, 0, vw, vh);

        const imgData = ctx.getImageData(0, 0, vw, vh);
        const px = imgData.data;

        if (confMask) {
          /* confidence mask: float 0..1, higher = more likely person */
          for (let i = 0; i < confMask.length; i++) {
            const confidence = confMask[i];
            if (confidence < 0.5) {
              px[i * 4 + 3] = 0; /* background → transparent */
            } else {
              /* soft edge: map 0.5-1.0 to alpha 0-255 */
              px[i * 4 + 3] = Math.min(255, Math.round((confidence - 0.3) / 0.7 * 255));
            }
          }
        } else if (catMask) {
          /* category mask: 0 = background, >0 = person */
          for (let i = 0; i < catMask.length; i++) {
            if (catMask[i] === 0) {
              px[i * 4 + 3] = 0;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        result.close?.();
        segLoopRef.current = requestAnimationFrame(loop);
      };
      segLoopRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      if (segLoopRef.current) cancelAnimationFrame(segLoopRef.current);
    };
  }, [behindMode]);

  /* ---- gestures ---- */
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.shiftKey || e.button === 2) {
      rotating.current = true;
    } else {
      dragging.current = true;
    }
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!lastPointer.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    if (rotating.current) {
      setModelRot((r) => [r[0] - dy * 0.008, r[1] + dx * 0.008, r[2]]);
    } else if (dragging.current) {
      setModelPos((p) => [p[0] + dx * 0.01, p[1] - dy * 0.01, p[2]]);
    }
    lastPointer.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    rotating.current = false;
    lastPointer.current = null;
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchDist.current = null;
      pinchAngle.current = null;
      return;
    }
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const d = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    if (pinchDist.current !== null) {
      const delta = (d - pinchDist.current) * 0.005;
      setModelScale((s) => Math.max(0.3, Math.min(5, s + delta)));
    }
    pinchDist.current = d;
    const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);
    if (pinchAngle.current !== null) {
      const dAngle = angle - pinchAngle.current;
      setModelRot((r) => [r[0], r[1] + dAngle, r[2]]);
    }
    pinchAngle.current = angle;
  }, []);

  const onTouchEnd = useCallback(() => {
    pinchDist.current = null;
    pinchAngle.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    setModelScale((s) => Math.max(0.3, Math.min(5, s - e.deltaY * 0.002)));
  }, []);

  /* ---- capture ---- */
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const glCanvas = glCanvasRef.current;
    const personCanvas = personCanvasRef.current;
    if (!video || !glCanvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 1920;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d')!;

    /* video background (mirrored if front camera) */
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (behindMode && personCanvas) {
      /* behind mode: 3D first, then person cutout on top */
      ctx.drawImage(glCanvas, 0, 0, w, h);
      if (facingMode === 'user') {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(personCanvas, 0, 0, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      /* normal: 3D on top */
      ctx.drawImage(glCanvas, 0, 0, w, h);
    }

    const dataUrl = offscreen.toDataURL('image/png');
    setCaptures((prev) => [dataUrl, ...prev]);
    setPreview(dataUrl);
  }, [facingMode, behindMode]);

  const handleDownload = useCallback((dataUrl: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `selfie-with-hauen-${Date.now()}.png`;
    a.click();
  }, []);

  /* ---- render ---- */
  return (
    <div className="selfie-container">
      {/* Layer 0: camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="selfie-video"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }}
      />

      {cameraError && (
        <div className="selfie-error">
          <p>{cameraError}</p>
          <Link className="button" href="/">Back to Home</Link>
        </div>
      )}

      {/* Layer 1: 3D overlay */}
      <div
        className="selfie-canvas-wrap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={onContextMenu}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        <Canvas
          gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => { glCanvasRef.current = gl.domElement; }}
        >
          <AutoResize />
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 4]} intensity={1.2} />
          <directionalLight position={[-2, 3, -3]} intensity={0.4} />
          <Suspense fallback={null}>
            <HauenModel
              position={modelPos}
              scale={modelScale}
              rotation={modelRot}
              poseIndex={poseIndex}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Layer 2: person cutout (only when behind mode active) */}
      {behindMode && (
        <canvas
          ref={personCanvasRef}
          className="selfie-person-layer"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }}
        />
      )}

      {/* loading */}
      {!cameraReady && !cameraError && (
        <div className="selfie-loading">Starting camera...</div>
      )}

      {/* top controls */}
      <div className="selfie-controls">
        <div className="selfie-controls-row">
          <button className="selfie-ctrl-btn" onClick={() => setModelScale((s) => Math.min(5, s + 0.3))}>+</button>
          <button className="selfie-ctrl-btn" onClick={() => setModelScale((s) => Math.max(0.3, s - 0.3))}>&minus;</button>
          <span className="selfie-scale-label">{Math.round(modelScale * 100)}%</span>
        </div>
        <div className="selfie-controls-hint">
          Drag: move &middot; Shift+drag: rotate &middot; Scroll: zoom
        </div>
      </div>

      {/* pose picker (left side) */}
      <div className="selfie-pose-picker">
        {POSES.map((p, i) => (
          <button
            key={p.label}
            className={`selfie-pose-btn${i === poseIndex ? ' active' : ''}`}
            onClick={() => setPoseIndex(i)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* bottom toolbar */}
      <div className="selfie-toolbar">
        <button className="selfie-btn" onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}>
          Flip
        </button>

        <button
          className={`selfie-btn${behindMode ? ' active' : ''}`}
          onClick={() => setBehindMode((b) => !b)}
          title="Toggle: Hauen behind you"
        >
          {behindMode ? 'Behind: ON' : 'Behind'}
        </button>

        <button className="selfie-capture-btn" onClick={handleCapture} disabled={!cameraReady} />

        <button
          className="selfie-btn"
          onClick={() => { setModelPos([0, -1, 0]); setModelScale(1.4); setModelRot([0, 0, 0]); setPoseIndex(0); }}
        >
          Reset
        </button>

        <button className="selfie-btn" onClick={() => setShowGallery((g) => !g)}>
          {captures.length > 0 ? `${captures.length}` : 'Gallery'}
        </button>
      </div>

      {/* gallery */}
      {showGallery && captures.length > 0 && (
        <div className="selfie-gallery">
          {captures.map((src, i) => (
            <button key={i} className="selfie-thumb" onClick={() => setPreview(src)}>
              <img src={src} alt={`Capture ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      {/* preview */}
      {preview && (
        <div className="selfie-preview" onClick={() => setPreview(null)}>
          <img src={preview} alt="Captured selfie" />
          <div className="selfie-preview-actions">
            <button onClick={() => handleDownload(preview)}>Download</button>
            <button className="secondary" onClick={() => setPreview(null)}>Close</button>
          </div>
        </div>
      )}

      <Link href="/" className="selfie-back">&larr;</Link>
    </div>
  );
}
