"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { MediaAsset, PlaybackState } from "@/lib/preview-types";
import { effectivePlaybackTime } from "@/lib/preview-utils";

export function useMediaTexture(media: MediaAsset | null, playback: PlaybackState | null) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!media) {
      textureRef.current?.dispose();
      textureRef.current = null;
      videoRef.current = null;
      setTexture(null);
      return;
    }

    if (media.type === "image") {
      const loader = new THREE.TextureLoader();
      loader.load(
        media.url,
        (loaded) => {
          if (cancelled) {
            loaded.dispose();
            return;
          }
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.wrapS = THREE.ClampToEdgeWrapping;
          loaded.wrapT = THREE.ClampToEdgeWrapping;
          textureRef.current?.dispose();
          textureRef.current = loaded;
          setTexture(loaded);
        },
        undefined,
        () => {
          if (!cancelled) {
            setTexture(null);
          }
        }
      );

      return () => {
        cancelled = true;
      };
    }

    const video = document.createElement("video");
    video.src = media.url;
    video.loop = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.muted = playback?.muted ?? true;

    const textureVideo = new THREE.VideoTexture(video);
    textureVideo.colorSpace = THREE.SRGBColorSpace;
    textureVideo.generateMipmaps = false;
    textureVideo.minFilter = THREE.LinearFilter;
    textureVideo.magFilter = THREE.LinearFilter;
    textureVideo.wrapS = THREE.ClampToEdgeWrapping;
    textureVideo.wrapT = THREE.ClampToEdgeWrapping;

    textureRef.current?.dispose();
    textureRef.current = textureVideo;
    videoRef.current = video;

    const onLoadedMetadata = () => {
      const expected = playback ? effectivePlaybackTime(playback) : 0;
      if (Number.isFinite(expected)) {
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
        video.currentTime = duration ? expected % duration : expected;
      }

      if (playback?.isPlaying ?? true) {
        void video.play().catch(() => undefined);
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    setTexture(textureVideo);

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.pause();
      video.src = "";
      video.load();
      videoRef.current = null;
      textureVideo.dispose();
      if (textureRef.current === textureVideo) {
        textureRef.current = null;
      }
    };
  }, [media]);

  useEffect(() => {
    if (!media || media.type !== "video" || !videoRef.current || !playback) {
      return;
    }

    const video = videoRef.current;
    video.muted = playback.muted;

    if (video.readyState >= 1) {
      const expected = effectivePlaybackTime(playback);
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
      const normalizedExpected = duration ? expected % duration : expected;
      if (Math.abs(video.currentTime - normalizedExpected) > 0.28) {
        video.currentTime = normalizedExpected;
      }
    }

    if (playback.isPlaying) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [media, playback]);

  const mediaAspect = useMemo(() => {
    if (!media || media.height === 0) {
      return 16 / 9;
    }

    return media.width / media.height;
  }, [media]);

  return {
    texture,
    mediaAspect
  };
}
