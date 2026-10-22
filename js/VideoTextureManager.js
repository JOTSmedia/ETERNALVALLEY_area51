import * as THREE from 'three';

export class VideoTextureManager {
  constructor() {
    this.videos = new Map(); // id -> { video, texture, mesh, lastDistance }
    this.maxConcurrent = 3;
    this.camera = null;
    
    // Create a dummy video to unlock mobile autoplay on first touch
    this.dummyVideo = document.createElement('video');
    this.dummyVideo.setAttribute('playsinline', '');
    this.dummyVideo.setAttribute('muted', '');
    this.dummyVideo.muted = true;
    
    const unlock = () => {
      this.dummyVideo.play().catch(e => {});
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
  }
  
  setCamera(camera) {
    this.camera = camera;
  }
  
  // Create or get a video texture for a specific URL
  createVideoTexture(id, url, isSky = false) {
    if (this.videos.has(id)) return this.videos.get(id).texture;
    
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    this.videos.set(id, { video, texture, isSky, active: false });
    return texture;
  }
  
  // Register a mesh that uses this video so we can compute distance
  registerMesh(id, mesh) {
    if (this.videos.has(id)) {
      this.videos.get(id).mesh = mesh;
    }
  }
  
  update() {
    if (!this.camera) return;
    
    // Calculate distances
    const distances = [];
    for (const [id, data] of this.videos.entries()) {
      if (data.isSky) {
        distances.push({ id, dist: 0 }); // Sky always active
      } else if (data.mesh) {
        const dist = this.camera.position.distanceTo(data.mesh.position);
        distances.push({ id, dist });
      } else {
        distances.push({ id, dist: Infinity });
      }
    }
    
    // Sort by closest
    distances.sort((a, b) => a.dist - b.dist);
    
    // Keep maxConcurrent active, pause the rest
    let activeCount = 0;
    for (const { id } of distances) {
      const data = this.videos.get(id);
      if (activeCount < this.maxConcurrent) {
        if (!data.active) {
          data.video.play().catch(e => console.warn('Autoplay prevented:', e));
          data.active = true;
        }
        activeCount++;
      } else {
        if (data.active) {
          data.video.pause();
          data.active = false;
        }
      }
    }
  }
  
  disposeVideo(id) {
    const data = this.videos.get(id);
    if (!data) return;
    
    // 5-step annihilation protocol
    data.video.pause();
    data.video.removeAttribute('src');
    data.video.load();
    data.texture.dispose();
    
    this.videos.delete(id);
  }
}

export const videoManager = new VideoTextureManager();
