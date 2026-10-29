/**
 * Civic Resolve AI — Sculpted 3D Architectural City Environment
 * Art Direction: Continuous urban topography transitioning naturally from
 * warm ivory and limestone through muted sage into deep forest green.
 * Built with Three.js (WebGL) + Procedural Architecture + Soft Directional Lighting.
 */

(function () {
  'use strict';

  // Check if prefers-reduced-motion is active
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class CivicCityEnvironment {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.cityGroup = null;
      this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.rafId = null;
      this.isDestroyed = false;

      // Palette definition (Ivory -> Sage -> Forest Green)
      this.palette = {
        ivoryLight: 0xFDFBF7,
        ivoryBase: 0xF4EFE6,
        ivoryStone: 0xE6DFD2,
        ivoryShade: 0xD7CFC0,
        
        sandstone: 0xC6BCA9,
        sageLight: 0xA7B6A1,
        sageBase: 0x8A9C85,
        sageZinc: 0x73856E,
        
        forestLight: 0x2E4D3B,
        forestBase: 0x1E3B2C,
        forestDeep: 0x132A1F,
        forestDark: 0x0C1C14,
        
        roadPavement: 0x2A313C,
        roadMarking: 0xE2E8F0,
        curbStone: 0x475569,
        canalWater: 0x152820,
        bridgeSteel: 0xCBD5E1,
        bridgePiers: 0x64748B
      };

      this.init();
    }

    init() {
      // 1. Scene setup
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xF8FAFC);
      this.scene.fog = new THREE.FogExp2(0xF8FAFC, 0.0075);

      // 2. Camera setup: Elevated three-quarter aerial perspective
      const aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera = new THREE.PerspectiveCamera(34, aspect, 1, 1000);
      this.camera.position.set(-28, 52, 68);
      this.camera.lookAt(8, 2, -6);

      // 3. Renderer setup
      try {
        this.renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        });
      } catch (e) {
        console.warn('WebGL initialization failed, falling back to 2D:', e);
        this.renderFallback();
        return;
      }

      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputEncoding = THREE.sRGBEncoding;

      // Clean canvas styling
      const canvas = this.renderer.domElement;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      this.container.appendChild(canvas);

      // 4. City Container Group
      this.cityGroup = new THREE.Group();
      this.scene.add(this.cityGroup);

      // 5. Lighting
      this.setupLighting();

      // 6. Build the Sculpted City Topography
      this.buildTopographyAndInfrastructure();
      this.buildArchitecturalDistricts();
      this.buildBridgeAndCirculation();
      this.buildFoliageAndUrbanDetails();

      // 7. Event listeners
      this.bindEvents();

      // 8. Animation loop
      this.animate();
    }

    setupLighting() {
      // Soft warm ambient fill
      const ambient = new THREE.AmbientLight(0xFFF9F0, 0.72);
      this.scene.add(ambient);

      // Architectural Key Sun (warm morning/afternoon low-angle azimuth)
      const sun = new THREE.DirectionalLight(0xFFF4E6, 1.25);
      sun.position.set(-45, 75, 35);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 220;
      sun.shadow.camera.left = -65;
      sun.shadow.camera.right = 65;
      sun.shadow.camera.top = 65;
      sun.shadow.camera.bottom = -65;
      sun.shadow.bias = -0.0005;
      this.scene.add(sun);

      // Soft cool skylight fill from opposite side
      const skyFill = new THREE.DirectionalLight(0xD6E4ED, 0.45);
      skyFill.position.set(40, 30, -35);
      this.scene.add(skyFill);
    }

    getMaterial(color, roughness = 0.85, metalness = 0.05) {
      return new THREE.MeshLambertMaterial({
        color: color
      });
    }

    buildTopographyAndInfrastructure() {
      // Base Terraced Ground Planes
      // Left / West Plateau: Warm Ivory Limestone (Calm base)
      const westGroundGeo = new THREE.BoxGeometry(60, 4, 90);
      const westGroundMat = this.getMaterial(this.palette.ivoryBase);
      const westGround = new THREE.Mesh(westGroundGeo, westGroundMat);
      westGround.position.set(-28, -2, 0);
      westGround.receiveShadow = true;
      this.cityGroup.add(westGround);

      // Center Transition Terrace (Muted Sandstone & Sage Ground)
      const midGroundGeo = new THREE.BoxGeometry(45, 3.2, 90);
      const midGroundMat = this.getMaterial(this.palette.sandstone);
      const midGround = new THREE.Mesh(midGroundGeo, midGroundMat);
      midGround.position.set(12, -2.4, 0);
      midGround.receiveShadow = true;
      this.cityGroup.add(midGround);

      // East River Basin & Forest Parkway Base
      const eastGroundGeo = new THREE.BoxGeometry(55, 2.2, 90);
      const eastGroundMat = this.getMaterial(this.palette.forestDark);
      const eastGround = new THREE.Mesh(eastGroundGeo, eastGroundMat);
      eastGround.position.set(52, -2.9, 0);
      eastGround.receiveShadow = true;
      this.cityGroup.add(eastGround);

      // Sunken Water Corridor / Canal
      const canalGeo = new THREE.BoxGeometry(16, 1.5, 95);
      const canalMat = new THREE.MeshLambertMaterial({
        color: this.palette.canalWater,
        transparent: true,
        opacity: 0.92
      });
      const canal = new THREE.Mesh(canalGeo, canalMat);
      canal.position.set(28, -2.2, 0);
      canal.receiveShadow = true;
      this.cityGroup.add(canal);

      // Stone Canal Retaining Walls
      const wallMat = this.getMaterial(this.palette.curbStone);
      const wallWest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 95), wallMat);
      wallWest.position.set(19.4, -1.2, 0);
      wallWest.castShadow = true;
      wallWest.receiveShadow = true;
      this.cityGroup.add(wallWest);

      const wallEast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 95), wallMat);
      wallEast.position.set(36.6, -1.2, 0);
      wallEast.castShadow = true;
      wallEast.receiveShadow = true;
      this.cityGroup.add(wallEast);
    }

    buildBridgeAndCirculation() {
      // Primary West-East Highway / Boulevard
      const mainRoadGeo = new THREE.BoxGeometry(110, 0.25, 7.5);
      const roadMat = this.getMaterial(this.palette.roadPavement);
      const mainRoad = new THREE.Mesh(mainRoadGeo, roadMat);
      mainRoad.position.set(12, 0.13, -2);
      mainRoad.receiveShadow = true;
      this.cityGroup.add(mainRoad);

      // Road dividing markings
      const markingMat = this.getMaterial(this.palette.roadMarking);
      for (let x = -38; x <= 62; x += 6) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(3, 0.28, 0.25), markingMat);
        dash.position.set(x, 0.16, -2);
        this.cityGroup.add(dash);
      }

      // North-South Avenues
      const ave1 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 85), roadMat);
      ave1.position.set(-16, 0.12, 0);
      ave1.receiveShadow = true;
      this.cityGroup.add(ave1);

      const ave2 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.22, 85), roadMat);
      ave2.position.set(8, 0.12, 0);
      ave2.receiveShadow = true;
      this.cityGroup.add(ave2);

      // Major Architectural Viaduct / Bridge over Canal
      const bridgeDeckGeo = new THREE.BoxGeometry(24, 0.8, 8.2);
      const bridgeDeckMat = this.getMaterial(this.palette.ivoryStone);
      const bridgeDeck = new THREE.Mesh(bridgeDeckGeo, bridgeDeckMat);
      bridgeDeck.position.set(28, 1.8, -2);
      bridgeDeck.castShadow = true;
      bridgeDeck.receiveShadow = true;
      this.cityGroup.add(bridgeDeck);

      // Bridge Road Surface
      const bridgeRoad = new THREE.Mesh(new THREE.BoxGeometry(24, 0.15, 6.8), roadMat);
      bridgeRoad.position.set(28, 2.25, -2);
      bridgeRoad.receiveShadow = true;
      this.cityGroup.add(bridgeRoad);

      // Structural Bridge Piers
      const pierMat = this.getMaterial(this.palette.bridgePiers);
      const pier1 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 4.5, 12), pierMat);
      pier1.position.set(23, -0.5, -2);
      pier1.castShadow = true;
      this.cityGroup.add(pier1);

      const pier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 4.5, 12), pierMat);
      pier2.position.set(33, -0.5, -2);
      pier2.castShadow = true;
      this.cityGroup.add(pier2);

      // Curved Architectural Bridge Arches
      const archMat = this.getMaterial(this.palette.bridgeSteel);
      const archL = new THREE.Mesh(new THREE.TorusGeometry(10, 0.35, 8, 24, Math.PI), archMat);
      archL.rotation.x = 0;
      archL.rotation.y = 0;
      archL.position.set(28, 2.2, 2.2);
      this.cityGroup.add(archL);

      const archR = new THREE.Mesh(new THREE.TorusGeometry(10, 0.35, 8, 24, Math.PI), archMat);
      archR.position.set(28, 2.2, -6.2);
      this.cityGroup.add(archR);

      // Vertical Suspender Cables
      for (let k = -8; k <= 8; k += 2.5) {
        const cableH = Math.max(0.5, Math.sqrt(100 - k * k) - 0.2);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, cableH, 6), archMat);
        cable.position.set(28 + k, 2.2 + cableH / 2, 2.2);
        this.cityGroup.add(cable);

        const cable2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, cableH, 6), archMat);
        cable2.position.set(28 + k, 2.2 + cableH / 2, -6.2);
        this.cityGroup.add(cable2);
      }

      // Circular Civic Plaza Roundabout in Western Esplanade
      const plazaGeo = new THREE.CylinderGeometry(6.5, 6.5, 0.3, 32);
      const plazaMat = this.getMaterial(this.palette.ivoryLight);
      const plaza = new THREE.Mesh(plazaGeo, plazaMat);
      plaza.position.set(-36, 0.16, -2);
      plaza.receiveShadow = true;
      this.cityGroup.add(plaza);

      // Central Civic Monument Obelisk in Roundabout
      const obeliskGeo = new THREE.CylinderGeometry(0.3, 0.8, 8, 4);
      const obeliskMat = this.getMaterial(this.palette.ivoryBase);
      const obelisk = new THREE.Mesh(obeliskGeo, obeliskMat);
      obelisk.position.set(-36, 4.16, -2);
      obelisk.rotation.y = Math.PI / 4;
      obelisk.castShadow = true;
      this.cityGroup.add(obelisk);
    }

    buildArchitecturalDistricts() {
      // 1. WEST DISTRICT (Calm Ivory & Limestone - Low-rise civic pavilions)
      // Designed with calm, low relief and generous negative space to support typography
      const westBuildings = [
        { x: -44, z: 12, w: 9, d: 8, h: 3.5, col: this.palette.ivoryBase },
        { x: -32, z: 14, w: 10, d: 7, h: 4.2, col: this.palette.ivoryLight },
        { x: -42, z: 24, w: 8, d: 9, h: 3.2, col: this.palette.ivoryStone },
        { x: -30, z: 25, w: 9, d: 8, h: 4.0, col: this.palette.ivoryBase },
        { x: -45, z: -16, w: 10, d: 7, h: 3.8, col: this.palette.ivoryBase },
        { x: -33, z: -15, w: 8, d: 8, h: 4.5, col: this.palette.ivoryLight },
        { x: -44, z: -27, w: 9, d: 9, h: 3.5, col: this.palette.ivoryStone },
        { x: -32, z: -26, w: 9, d: 7, h: 4.2, col: this.palette.ivoryBase },
        { x: -24, z: 6, w: 6, d: 5, h: 5.0, col: this.palette.ivoryLight },
        { x: -24, z: -10, w: 6, d: 5, h: 4.8, col: this.palette.ivoryBase },
        { x: -24, z: 20, w: 6, d: 6, h: 5.2, col: this.palette.ivoryStone }
      ];

      westBuildings.forEach(b => {
        this.createCivicBuilding(b.x, b.z, b.w, b.d, b.h, b.col, 'ivory');
      });

      // 2. CENTRAL DISTRICT (Transition from Sandstone through Muted Sage)
      // Stepped terraces, mid-rise civic density, colonnades and rooftop gardens
      const centralBuildings = [
        // South of Main Boulevard
        { x: -6, z: 10, w: 9, d: 7, h: 7.5, col: this.palette.sandstone },
        { x: 3, z: 12, w: 8, d: 8, h: 9.0, col: this.palette.sageLight },
        { x: 13, z: 11, w: 8, d: 7, h: 10.5, col: this.palette.sageBase },
        
        { x: -8, z: 21, w: 8, d: 8, h: 6.8, col: this.palette.sandstone },
        { x: 2, z: 23, w: 9, d: 9, h: 8.5, col: this.palette.sageLight },
        { x: 14, z: 22, w: 8, d: 8, h: 11.0, col: this.palette.sageZinc },

        { x: -7, z: 32, w: 7, d: 7, h: 5.5, col: this.palette.sandstone },
        { x: 2, z: 34, w: 8, d: 8, h: 7.2, col: this.palette.sageLight },
        { x: 13, z: 33, w: 7, d: 8, h: 9.5, col: this.palette.sageBase },

        // North of Main Boulevard
        { x: -6, z: -14, w: 8, d: 8, h: 8.0, col: this.palette.sandstone },
        { x: 3, z: -15, w: 9, d: 7, h: 10.0, col: this.palette.sageLight },
        { x: 14, z: -14, w: 8, d: 8, h: 11.5, col: this.palette.sageBase },

        { x: -7, z: -25, w: 9, d: 8, h: 7.0, col: this.palette.sandstone },
        { x: 2, z: -26, w: 8, d: 9, h: 9.2, col: this.palette.sageLight },
        { x: 13, z: -25, w: 9, d: 8, h: 10.8, col: this.palette.sageZinc },

        { x: -6, z: -35, w: 8, d: 7, h: 5.8, col: this.palette.sandstone },
        { x: 3, z: -36, w: 8, d: 8, h: 7.5, col: this.palette.sageLight },
        { x: 14, z: -35, w: 7, d: 7, h: 9.0, col: this.palette.sageBase }
      ];

      centralBuildings.forEach(b => {
        this.createCivicBuilding(b.x, b.z, b.w, b.d, b.h, b.col, 'sage');
      });

      // 3. EAST DISTRICT (Deep Forest Green Infrastructure & High-Density Skyline)
      // Dramatic cantilevered towers, deep green podiums, skybridges and lush riverfront
      const eastBuildings = [
        // Along the eastern canal embankment
        { x: 42, z: 8, w: 9, d: 8, h: 12.5, col: this.palette.forestLight },
        { x: 53, z: 10, w: 9, d: 9, h: 15.0, col: this.palette.forestBase },
        { x: 64, z: 9, w: 8, d: 8, h: 17.5, col: this.palette.forestDeep },

        { x: 43, z: 20, w: 8, d: 8, h: 11.0, col: this.palette.forestLight },
        { x: 54, z: 22, w: 10, d: 9, h: 16.5, col: this.palette.forestBase },
        { x: 65, z: 21, w: 8, d: 8, h: 18.0, col: this.palette.forestDeep },

        { x: 42, z: 32, w: 8, d: 8, h: 9.5, col: this.palette.forestLight },
        { x: 53, z: 34, w: 9, d: 8, h: 13.5, col: this.palette.forestBase },
        { x: 64, z: 33, w: 8, d: 8, h: 15.0, col: this.palette.forestDeep },

        // North of Boulevard
        { x: 42, z: -14, w: 9, d: 8, h: 13.0, col: this.palette.forestLight },
        { x: 53, z: -15, w: 9, d: 9, h: 16.0, col: this.palette.forestBase },
        { x: 64, z: -14, w: 8, d: 8, h: 18.5, col: this.palette.forestDeep },

        { x: 43, z: -26, w: 8, d: 9, h: 11.5, col: this.palette.forestLight },
        { x: 54, z: -27, w: 10, d: 8, h: 15.5, col: this.palette.forestBase },
        { x: 65, z: -26, w: 8, d: 8, h: 17.0, col: this.palette.forestDeep },

        { x: 42, z: -37, w: 8, d: 7, h: 10.0, col: this.palette.forestLight },
        { x: 53, z: -38, w: 9, d: 8, h: 14.0, col: this.palette.forestBase },
        { x: 64, z: -37, w: 8, d: 8, h: 15.5, col: this.palette.forestDeep }
      ];

      eastBuildings.forEach(b => {
        this.createCivicBuilding(b.x, b.z, b.w, b.d, b.h, b.col, 'forest');
      });

      // Skybridges connecting prominent towers in the eastern district
      this.createSkybridge(53, 64, 10, 13.5);
      this.createSkybridge(54, 65, -15, 14.0);
      this.createSkybridge(3, 13, 11, 8.2);
    }

    createCivicBuilding(x, z, w, d, h, baseColor, district) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // Base Structure
      const mat = this.getMaterial(baseColor);
      const baseGeo = new THREE.BoxGeometry(w, h, d);
      const baseMesh = new THREE.Mesh(baseGeo, mat);
      baseMesh.position.y = h / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      // Architectural Tiering / Rooftop Terraces
      if (h > 6) {
        // Upper set-back tier
        const upperW = w * 0.72;
        const upperD = d * 0.72;
        const upperH = h * 0.35;
        const upperColor = (district === 'forest') ? this.palette.forestDeep : (district === 'sage') ? this.palette.sageZinc : this.palette.ivoryLight;
        const upperMesh = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), this.getMaterial(upperColor));
        upperMesh.position.y = h + upperH / 2;
        upperMesh.castShadow = true;
        group.add(upperMesh);

        // Rooftop plant garden or mechanical penthouse
        const penthouseW = upperW * 0.45;
        const penthouseD = upperD * 0.45;
        const penthouseH = 1.2;
        const pentMesh = new THREE.Mesh(new THREE.BoxGeometry(penthouseW, penthouseH, penthouseD), this.getMaterial(this.palette.curbStone));
        pentMesh.position.y = h + upperH + penthouseH / 2;
        group.add(pentMesh);
      } else {
        // Low-rise roof perimeter parapet
        const parapetMat = this.getMaterial(this.palette.ivoryStone);
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3), parapetMat);
        parapet.position.y = h + 0.2;
        group.add(parapet);
      }

      // Facade Rhythm: Horizontal Architectural Louvers
      const louverMat = this.getMaterial(this.palette.ivoryLight);
      const numLouvers = Math.floor(h / 2.2);
      for (let i = 1; i <= numLouvers; i++) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.2, d + 0.25), louverMat);
        louver.position.y = i * 2.2;
        group.add(louver);
      }

      this.cityGroup.add(group);
    }

    createSkybridge(x1, x2, z, y) {
      const length = Math.abs(x2 - x1);
      const midX = (x1 + x2) / 2;
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(length, 1.4, 2.0),
        this.getMaterial(this.palette.bridgeSteel)
      );
      bridge.position.set(midX, y, z);
      bridge.castShadow = true;
      this.cityGroup.add(bridge);
    }

    buildFoliageAndUrbanDetails() {
      // Tree canopy colors: Sage through deep emerald
      const treeColors = [
        this.palette.forestLight,
        this.palette.forestBase,
        this.palette.forestDeep,
        this.palette.sageBase
      ];

      // Plant avenue trees along boulevards and riverbanks
      const treeLocs = [
        // Along the riverbank promenade
        { x: 38, z: 2 }, { x: 38, z: 8 }, { x: 38, z: 14 }, { x: 38, z: 20 }, { x: 38, z: 26 }, { x: 38, z: 32 },
        { x: 38, z: -6 }, { x: 38, z: -12 }, { x: 38, z: -18 }, { x: 38, z: -24 }, { x: 38, z: -30 }, { x: 38, z: -36 },
        { x: 18, z: 4 }, { x: 18, z: 12 }, { x: 18, z: 20 }, { x: 18, z: 28 },
        { x: 18, z: -8 }, { x: 18, z: -16 }, { x: 18, z: -24 }, { x: 18, z: -32 },
        // Along Western Civic Esplanade
        { x: -28, z: 3 }, { x: -28, z: -7 }, { x: -36, z: 6 }, { x: -36, z: -10 }
      ];

      treeLocs.forEach((loc, idx) => {
        const col = treeColors[idx % treeColors.length];
        const treeGroup = new THREE.Group();
        treeGroup.position.set(loc.x, 0, loc.z);

        // Trunk
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.25, 1.5, 6),
          this.getMaterial(this.palette.curbStone)
        );
        trunk.position.y = 0.75;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // Foliage (geometric faceted dodecahedron)
        const foliage = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.2, 1),
          this.getMaterial(col)
        );
        foliage.position.y = 2.2;
        foliage.scale.set(1, 1.3, 1);
        foliage.castShadow = true;
        treeGroup.add(foliage);

        this.cityGroup.add(treeGroup);
      });
    }

    bindEvents() {
      // Gentle mouse parallax interaction
      window.addEventListener('mousemove', (e) => {
        if (prefersReducedMotion) return;
        const halfW = window.innerWidth / 2;
        const halfH = window.innerHeight / 2;
        this.mouse.targetX = (e.clientX - halfW) / halfW;
        this.mouse.targetY = (e.clientY - halfH) / halfH;
      }, { passive: true });

      // Window resize handler
      window.addEventListener('resize', () => {
        this.handleResize();
      }, { passive: true });
    }

    handleResize() {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w === 0 || h === 0) return;

      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    animate() {
      if (this.isDestroyed) return;

      this.rafId = requestAnimationFrame(() => this.animate());

      // Smooth camera micro-parallax damping
      if (!prefersReducedMotion) {
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.04;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.04;

        // Subtle camera orbit drift
        this.camera.position.x = -28 + this.mouse.x * 3.5;
        this.camera.position.y = 52 - this.mouse.y * 2.5;
        this.camera.lookAt(8 + this.mouse.x * 1.5, 2, -6);
      }

      this.renderer.render(this.scene, this.camera);
    }

    renderFallback() {
      // 2D Canvas Procedural Isometric City fallback if WebGL fails
      const canvas = document.createElement('canvas');
      canvas.width = this.container.clientWidth || 1440;
      canvas.height = this.container.clientHeight || 700;
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#FAF8F5');
        grad.addColorStop(0.5, '#A4B39F');
        grad.addColorStop(1, '#1E3B2C');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      this.container.appendChild(canvas);
    }

    destroy() {
      this.isDestroyed = true;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.renderer && this.renderer.domElement) {
        this.renderer.domElement.remove();
        this.renderer.dispose();
      }
    }
  }

  // Export to global scope
  window.CivicCityEnvironment = CivicCityEnvironment;

  // Auto-boot if container is present on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('city-3d-viewport');
    if (el && typeof THREE !== 'undefined') {
      window._civicCityInstance = new CivicCityEnvironment('city-3d-viewport');
    }
  });
})();

