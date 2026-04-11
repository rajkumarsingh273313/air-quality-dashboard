/**
 * === Three.js Globe Module ===
 * Improved 3D earth visualization with responsiveness
 * Add this script before script.js in index.html: <script src="globe.js" defer></script>
 */

class GlobeController {
  constructor(containerId) {
    this.containerId = containerId;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.globe = null;
    this.isInitialized = false;
    this.animationId = null;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.rotationVelocity = { x: 0, y: 0 };
    
    this.init();
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`❌ Container ${this.containerId} not found`);
      return false;
    }

    try {
      // Set up scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x000000);
      this.scene.fog = new THREE.Fog(0x000000, 100, 1000);

      // Set up camera
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 400;

      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      this.camera.position.z = 5;

      // Set up renderer with optimization
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;

      container.innerHTML = ""; // Clear previous content
      container.appendChild(this.renderer.domElement);

      // Create globe
      this.createGlobe();

      // Set up lighting
      this.setupLights();

      // Bind event listeners
      this.attachEventListeners();

      // Start animation loop
      this.animate();

      this.isInitialized = true;
      console.log("✅ Globe initialized successfully");
      return true;

    } catch (error) {
      console.error("❌ Globe initialization error:", error);
      return false;
    }
  }

  createGlobe() {
    // Create sphere geometry with higher detail
    const geometry = new THREE.SphereGeometry(2, 128, 128);

    // Load texture with error handling
    const textureLoader = new THREE.TextureLoader();
    const textureUrl = "https://threejs.org/examples/textures/earth_atmos_2048.jpg";

    let texture = null;
    textureLoader.load(
      textureUrl,
      (loadedTexture) => {
        texture = loadedTexture;
        this.globe.material.map = texture;
        this.globe.material.needsUpdate = true;
        console.log("✅ Earth texture loaded successfully");
      },
      undefined,
      (error) => {
        console.warn("⚠️ Texture loading failed, using fallback color");
        // Fallback: use solid color if texture fails
        if (this.globe && this.globe.material) {
          this.globe.material.color.set(0x2e8b57); // Forest green fallback
        }
      }
    );

    // Create advanced material with better appearance
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.2,
      roughness: 0.65,
      emissive: 0x0d1b2a,
      emissiveIntensity: 0.5,
      side: THREE.FrontSide,
      wireframe: false
    });

    // Create mesh
    this.globe = new THREE.Mesh(geometry, material);
    this.globe.castShadow = true;
    this.globe.receiveShadow = true;
    this.globe.rotation.z = 0.1; // Slight tilt for visual interest

    this.scene.add(this.globe);

    console.log("🌍 Globe created with enhanced materials");
  }

  setupLights() {
    // Remove any existing lights
    this.scene.children.forEach(child => {
      if (child instanceof THREE.Light) {
        this.scene.remove(child);
      }
    });

    // Primary key light (sun) - stronger and warmer
    const sunLight = new THREE.DirectionalLight(0xfdb813, 2.0);
    sunLight.position.set(8, 5, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.far = 20;
    sunLight.shadow.camera.near = 0.1;
    this.scene.add(sunLight);

    // Ambient light for overall fill (cooler tone)
    const ambientLight = new THREE.AmbientLight(0x3366ff, 1.0);
    this.scene.add(ambientLight);

    // Rim light for depth and silhouette (orange/red sunset)
    const rimLight = new THREE.DirectionalLight(0xff6b35, 1.2);
    rimLight.position.set(-8, 2, -8);
    rimLight.castShadow = false;
    this.scene.add(rimLight);

    // Back fill light (subtle blue)
    const backLight = new THREE.DirectionalLight(0x5ba3f5, 0.8);
    backLight.position.set(0, -5, -10);
    backLight.castShadow = false;
    this.scene.add(backLight);

    console.log("💡 Professional lighting configured");
  }

  animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    // Smooth continuous rotation when not dragging
    if (this.globe && !this.isDragging) {
      this.globe.rotation.y += 0.0003; // Very smooth, slow rotation
      // Gentle bobbing motion
      this.globe.rotation.x += Math.sin(Date.now() * 0.0001) * 0.00001;
    }

    // Render the scene
    this.renderer.render(this.scene, this.camera);
  };

  handleWindowResize = () => {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    console.log(`📐 Resized to ${width}x${height}`);
  };

  attachEventListeners() {
    window.addEventListener("resize", this.handleWindowResize);

    // Optional: Add mouse controls
    this.attachMouseControls();
  }

  attachMouseControls() {
    const container = this.renderer.domElement;
    const self = this;

    container.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
      this.rotationVelocity = { x: 0, y: 0 };
      container.style.cursor = "grabbing";
    });

    container.addEventListener("mousemove", (e) => {
      if (this.isDragging && this.globe) {
        const deltaM = {
          x: e.clientX - this.previousMousePosition.x,
          y: e.clientY - this.previousMousePosition.y
        };

        // Smoother, more responsive rotation
        this.rotationVelocity.x = deltaM.y * 0.01;
        this.rotationVelocity.y = deltaM.x * 0.01;

        this.globe.rotation.x += this.rotationVelocity.x;
        this.globe.rotation.y += this.rotationVelocity.y;

        // Clamp x rotation to prevent over-rotation
        this.globe.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.globe.rotation.x));

        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    container.addEventListener("mouseup", () => {
      this.isDragging = false;
      container.style.cursor = "grab";
    });

    container.addEventListener("mouseleave", () => {
      this.isDragging = false;
      container.style.cursor = "grab";
    });

    // Hover effect
    container.addEventListener("mouseenter", () => {
      container.style.cursor = "grab";
    });

    console.log("🖱️ Mouse controls enabled");
  }

  /**
   * Add AQI marker to globe at specific coordinates
   */
  addAQIMarker(lat, lon, aqi) {
    if (!this.globe) return;

    // Convert lat/lon to 3D coordinates on sphere
    const radius = 2.1; // Slightly above globe surface
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    // Create main marker with better geometry
    const markerGeometry = new THREE.OctahedronGeometry(0.12, 2);
    const markerColor = this.getAQIColor(aqi);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: markerColor,
      emissive: markerColor,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.2
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);

    marker.position.set(x, y, z);
    marker.scale.set(1, 1, 1);
    this.scene.add(marker);

    // Add multiple glow rings for better visual effect
    for (let i = 1; i <= 3; i++) {
      const glowGeometry = new THREE.SphereGeometry(0.12 + i * 0.08, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: markerColor,
        transparent: true,
        opacity: 0.2 / i,
        wireframe: false
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.copy(marker.position);
      this.scene.add(glow);
    }

    // Add a point light at marker location for realistic lighting
    const markerLight = new THREE.PointLight(markerColor, 0.5, 5);
    markerLight.position.copy(marker.position);
    this.scene.add(markerLight);

    console.log(`📍 AQI Marker added at ${lat.toFixed(2)}, ${lon.toFixed(2)} with value ${aqi}`);
    return marker;
  }

  /**
   * Get color based on AQI value
   */
  getAQIColor(aqi) {
    if (aqi <= 50) return 0x00e400; // Good - Green
    if (aqi <= 100) return 0xffff00; // Moderate - Yellow
    if (aqi <= 150) return 0xff7e00; // Unhealthy for sensitive - Orange
    if (aqi <= 200) return 0xff0000; // Unhealthy - Red
    if (aqi <= 300) return 0x8f3f97; // Very Unhealthy - Purple
    return 0x7e0023; // Hazardous - Dark Red
  }

  /**
   * Cleanup and dispose resources
   */
  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }

    if (this.scene) {
      this.scene.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    window.removeEventListener("resize", this.handleWindowResize);

    console.log("🗑️ Globe resources disposed");
  }
}

// Initialize globe when DOM is ready
let globeInstance = null;

window.addEventListener("DOMContentLoaded", () => {
  const globe3dContainer = document.getElementById("globe3d");
  if (globe3dContainer) {
    globeInstance = new GlobeController("globe3d");
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (globeInstance) {
    globeInstance.dispose();
  }
});
