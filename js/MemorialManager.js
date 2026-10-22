import * as THREE from "three";
import { videoManager } from './VideoTextureManager.js?v=73';

export class MemorialManager {
  constructor(world) {
    this.world = world;
    this.billboards = new THREE.Group();
    this.billboards.name = 'memorialBillboards';
    this.world.scene.add(this.billboards);
    
    // Geometry for billboards
    this.planeGeo = new THREE.PlaneGeometry(3, 3);
    // EVR-06 (Oct 15): each billboard is its own draw (own photo/video texture), so only show those near the camera.
    this._cullTimer = setInterval(() => {
      const cam = this.world.camera; if (this.world._disposed) { clearInterval(this._cullTimer); return; } if (!cam) return;
      const R = ({ desktop: 120, mobile: 60 })[window.EV_PERF?.tier] || 45, R2 = R * R;
      for (const b of this.billboards.children) b.visible = b.position.distanceToSquared(cam.position) < R2;
    }, 250);
  }
  
  init(occupiedPlots) {
    // Clear existing
    while(this.billboards.children.length > 0) { 
      const child = this.billboards.children[0];
      this.billboards.remove(child);
      child.material.dispose();
    }
    
    const fallbackTex = new THREE.Texture(); // blank texture
    
    for (const plot of occupiedPlots) {
      if (!plot.memorial) continue;
      
      const m = plot.memorial;
      let map = fallbackTex;
      
      // If it has a video URL (from Veo), use VideoTextureManager
      // Otherwise, if it has a photo (from legacy), we could load it as a Texture, 
      // but the prompt focuses on Veo loops. Let's load photo as fallback if needed.
      if (m.videoUrl && videoManager) {
        map = videoManager.createVideoTexture('plot_' + plot.id, m.videoUrl, false);
      } else if (m.photo) {
        // Load legacy static photo
        const img = new Image();
        img.src = m.photo;
        const tex = new THREE.Texture(img);
        img.onload = () => tex.needsUpdate = true;
        map = tex;
      }
      
      const mat = new THREE.MeshBasicMaterial({
        map: map,
        transparent: true,
        side: THREE.DoubleSide,
        forceSinglePass: true, // EVR-06: no 2-pass render + per-frame needsUpdate
      });
      
      const mesh = new THREE.Mesh(this.planeGeo, mat);
      
      // Position slightly above the plot center
      mesh.position.set(plot.x, plot.y + 2.5, plot.z);
      
      // Billboard faces the camera dynamically, or just faces forward initially?
      // Since it's a memorial portrait, we can use an OnBeforeRender hack to make it face the camera.
      mesh.onBeforeRender = (renderer, scene, camera) => {
        mesh.quaternion.copy(camera.quaternion);
      };
      
      this.billboards.add(mesh);
      
      if (m.videoUrl && videoManager) {
        videoManager.registerMesh('plot_' + plot.id, mesh);
      }
    }
  }
}
