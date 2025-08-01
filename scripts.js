(() => {
  "use strict";

  function waitForThree(callback) {
    if (typeof THREE !== 'undefined') {
      callback();
    } else {
      setTimeout(() => waitForThree(callback), 100);
    }
  }

  if (typeof Splitting !== 'undefined') {
    try {
      Splitting();
    } catch (e) {
      console.warn('Splitting.js initialization failed:', e);
    }
  }

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const config = {
    snowflakeCount: isMobile ? 40 : 150,
    shootingStarInterval: isMobile ? 10000 : 6000,
    animationThrottle: isMobile ? 3 : 1,
    rotationSpeed: isMobile ? 0.0001 : 0.0002,
    disableAurora: isMobile,
    simplifiedRendering: isMobile,
    starCount: isMobile ? 50 : 120,
  };

  const TOTAL_NUM_FLAKES = isMobile ? 250 : 500;
  const SNOW_SYMBOLS = ["•", "❅", "❆", "❄"];

  const LAYERS = [
    {
      layer: 1,
      sizeMin: 20,
      sizeMax: 36,
      speedFactor: 0.10,
      swayAmpMin: 8,
      swayAmpMax: 25,
      opacity: 0.7, 
      blur: 0,
      colorVariationMin: 240,
      colorVariationMax: 255,
      symbols: ["•"],
      zIndex: 50 
    },
    {
      layer: 2,
      sizeMin: 16,
      sizeMax: 24,
      speedFactor: 0.07,
      swayAmpMin: 8,
      swayAmpMax: 20,
      opacity: 0.65,
      blur: 2,
      colorVariationMin: 230,
      colorVariationMax: 245,
      symbols: ["•"],
      zIndex: 45
    },
    {
      layer: 3,
      sizeMin: 12,
      sizeMax: 20,
      speedFactor: 0.05,
      swayAmpMin: 8,
      swayAmpMax: 18,
      opacity: 0.55,
      blur: 4,
      colorVariationMin: 220,
      colorVariationMax: 235,
      symbols: ["•"],
      zIndex: 35
    },
    {
      layer: 4,
      sizeMin: 10,
      sizeMax: 16,
      speedFactor: 0.04,
      swayAmpMin: 8,
      swayAmpMax: 16,
      opacity: 0.45,
      blur: 5,
      colorVariationMin: 210,
      colorVariationMax: 225,
      symbols: ["•"],
      zIndex: 17
    },
    {
      layer: 5,
      sizeMin: 8,
      sizeMax: 12,
      speedFactor: 0.02,
      swayAmpMin: 8,
      swayAmpMax: 15,
      opacity: 0.35,
      blur: 7,
      colorVariationMin: 200,
      colorVariationMax: 215,
      symbols: ["•"],
      zIndex: 16
    },
    {
      layer: 6,
      sizeMin: 6,
      sizeMax: 10,
      speedFactor: 0.01,
      swayAmpMin: 8,
      swayAmpMax: 15,
      opacity: 0.25,
      blur: 15, 
      colorVariationMin: 190,
      colorVariationMax: 205,
      symbols: ["•"],
      zIndex: 15
    }
  ];

  const AppState = {
    isAnimating: true,
    isLoaded: false,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    parallaxStrength: isMobile ? 0.02 : 0.05,
    hasWebGLSupport: true,
    moonPhase: 0,
    intervals: [], 
    animationFrames: [], 
    
    initialize() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        this.hasWebGLSupport = !!gl;
        
        if (this.hasWebGLSupport) {
          const program = gl.createProgram();
          if (!program) {
            throw new Error('WebGL program creation failed');
          }
          gl.deleteProgram(program);
        }
      } catch(e) {
        this.hasWebGLSupport = false;
        console.warn("WebGL not supported or failed, falling back to simplified version:", e);
      }
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      if (this.hasWebGLSupport) {
        try {
          initSnowEffect();
          initShootingStars();
          initMoonPhases();
          initStarField();
        } catch (e) {
          console.error('Error initializing WebGL effects:', e);
          this.applyFallbackStyles();
        }
      } else {
        this.applyFallbackStyles();
      }
    },
    
    applyFallbackStyles() {
      document.body.classList.add('no-webgl');
      
      const fadeElements = document.querySelectorAll('.fade-in');
      fadeElements.forEach(el => {
        el.classList.add('visible');
      });
      
      const overlay = document.querySelector('.loading-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
    },
    
    pauseAll() {
      this.isAnimating = false;
    },
    
    resumeAll() {
      this.isAnimating = true;
    },
    
    cleanup() {
      this.intervals.forEach(id => clearInterval(id));
      this.intervals = [];
      
      this.animationFrames.forEach(id => cancelAnimationFrame(id));
      this.animationFrames = [];
    }
  };

  class AnimationManager {
    constructor() {
      this.animations = new Map();
      this.isRunning = false;
      this.frameId = null;
    }
    
    register(name, callback) {
      this.animations.set(name, callback);
      if (!this.isRunning) {
        this.start();
      }
    }
    
    unregister(name) {
      this.animations.delete(name);
      if (this.animations.size === 0) {
        this.stop();
      }
    }
    
    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.animate();
    }
    
    stop() {
      this.isRunning = false;
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
    }
    
    animate() {
      if (!this.isRunning || !AppState.isAnimating) {
        this.frameId = requestAnimationFrame(() => this.animate());
        return;
      }
      
      for (const [name, callback] of this.animations) {
        try {
          callback();
        } catch (e) {
          console.error(`Animation error in ${name}:`, e);
        }
      }
      
      this.frameId = requestAnimationFrame(() => this.animate());
    }
  }

  const animationManager = new AnimationManager();

  function initStarField() {
    const starCanvas = document.getElementById('star-canvas');
    if (!starCanvas) {
      console.warn('Star canvas not found');
      return;
    }
    
    let ctx;
    try {
      ctx = starCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get 2D context for star canvas');
      }
    } catch (e) {
      console.error('Star field initialization failed:', e);
      return;
    }
    
    const stars = [];
    
    function resizeCanvas() {
      try {
        starCanvas.width = window.innerWidth * (window.devicePixelRatio || 1);
        starCanvas.height = window.innerHeight * (window.devicePixelRatio || 1);
        ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      } catch (e) {
        console.error('Star canvas resize failed:', e);
      }
    }
    
    function createStars() {
      stars.length = 0;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const numStars = Math.floor((width * height) / 8000) * (isMobile ? 0.6 : 1);
      
      for (let i = 0; i < numStars; i++) {
        const x = Math.random() * width;
        const y = Math.random() * (height * 0.75);
        const size = Math.random() * 1.5 + 0.3;
        const opacity = Math.random() * 0.8 + 0.2;
        const twinkleSpeed = Math.random() * 0.008 + 0.002;
        const color = Math.random() > 0.7 ? 
          `hsl(${200 + Math.random() * 60}, 70%, 80%)` :
          `hsl(0, 0%, ${80 + Math.random() * 20}%)`;
        
        stars.push({
          x, y, size, opacity, twinkleSpeed,
          twinkleOffset: Math.random() * Math.PI * 2,
          color
        });
      }
    }
    
    function drawStars() {
      if (!AppState.isAnimating || !ctx) return;
      
      try {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        ctx.clearRect(0, 0, width, height);
        
        for (const star of stars) {
          star.twinkleOffset += star.twinkleSpeed;
          const twinkleFactor = 0.4 + 0.6 * Math.sin(star.twinkleOffset);
          
          ctx.save();
          ctx.shadowBlur = star.size * 3;
          ctx.shadowColor = star.color;
          
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fillStyle = star.color.replace('80%)', `${Math.floor(star.opacity * twinkleFactor * 80)}%)`);
          ctx.fill();
          
          ctx.restore();
        }
      } catch (e) {
        console.error('Star drawing failed:', e);
      }
    }
    
    animationManager.register('stars', drawStars);
    
    const resizeHandler = () => {
      resizeCanvas();
      createStars();
    };
    
    window.addEventListener('resize', resizeHandler);
    
    resizeCanvas();
    createStars();
  }

  class SnowLayer {
    constructor(canvasId, layerProps) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) {
        console.error(`Canvas with ID ${canvasId} not found`);
        return;
      }
      
      try {
        this.ctx = this.canvas.getContext("2d");
        if (!this.ctx) {
          throw new Error(`Could not get 2D context for ${canvasId}`);
        }
      } catch (e) {
        console.error(`Snow layer initialization failed for ${canvasId}:`, e);
        return;
      }
      
      this.layerProps = layerProps;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      
      try {
        this.canvas.width = this.width * (window.devicePixelRatio || 1);
        this.canvas.height = this.height * (window.devicePixelRatio || 1);
        this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      } catch (e) {
        console.error('Canvas scaling failed:', e);
      }
      
      this.snowflakes = [];
      this.snowPileHeights = [];
      this.SEGMENT_WIDTH = 5;
      this.NUM_SEGMENTS = Math.ceil(this.width / this.SEGMENT_WIDTH);
      this.initializeSnowPiles();
      this.createSnowflakes(Math.floor(TOTAL_NUM_FLAKES / LAYERS.length));
      
      this.accumulatedSnow = 0;
      this.maxAccumulatedSnow = 40;
    }

    initializeSnowPiles() {
      this.snowPileHeights = [];
      this.NUM_SEGMENTS = Math.ceil(this.width / this.SEGMENT_WIDTH);
      
      const baseHeight = this.height - 18;
      
      for (let j = 0; j < this.NUM_SEGMENTS; j++) {
        if (j === 0) {
          this.snowPileHeights[j] = baseHeight + (Math.random() * 8 - 4);
        } else {
          const previousHeight = this.snowPileHeights[j - 1];
          let delta = Math.random() * 5 - 2.5;
          let newHeight = previousHeight + delta;

          const maxHeight = baseHeight + 8;
          const minHeight = baseHeight - 15;
          newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

          this.snowPileHeights[j] = newHeight;
        }
      }
      this.smoothSnowPile(3);
    }

    smoothSnowPile(iterations = 1) {
      for (let iter = 0; iter < iterations; iter++) {
        const temp = [...this.snowPileHeights];
        for (let i = 1; i < this.NUM_SEGMENTS - 1; i++) {
          temp[i] = (this.snowPileHeights[i - 1] + this.snowPileHeights[i] + this.snowPileHeights[i + 1]) / 3;
        }
        this.snowPileHeights = temp;
      }
    }

    createSnowflakes(numFlakes) {
      for (let i = 0; i < numFlakes; i++) {
        this.snowflakes.push(this.createSnowflake());
      }
    }

    createSnowflake() {
      const symbol = this.layerProps.symbols[Math.floor(Math.random() * this.layerProps.symbols.length)];
      const layerProps = this.layerProps;

      const size = Math.random() * (layerProps.sizeMax - layerProps.sizeMin) + layerProps.sizeMin;
      const fallSpeed = size * layerProps.speedFactor + Math.random() * 0.3;
      const swayAmplitude = Math.random() * (layerProps.swayAmpMax - layerProps.swayAmpMin) + layerProps.swayAmpMin;
      const swaySpeed = Math.random() * 0.015 + 0.008;

      const rotation = Math.random() * Math.PI * 2;
      const rotationSpeed = Math.random() * 0.015 - 0.0075;

      const colorVariation = Math.floor(Math.random() * (layerProps.colorVariationMax - layerProps.colorVariationMin + 1)) + layerProps.colorVariationMin;
      
      const blueShift = Math.random() * 10 + 5;
      const color = `rgba(${Math.max(0, colorVariation - blueShift)}, ${Math.max(0, colorVariation - blueShift/2)}, ${colorVariation}, ${layerProps.opacity})`;

      return {
        x: Math.random() * this.width,
        y: Math.random() * -this.height,
        size, symbol, fallSpeed, swayAmplitude, swaySpeed,
        swayOffset: Math.random() * Math.PI * 2,
        opacity: layerProps.opacity,
        blur: layerProps.blur,
        color, rotation, rotationSpeed
      };
    }

    drawSnowPile() {
      if (!this.ctx) return;
      
      try {
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.snowPileHeights[0]);

        for (let i = 1; i < this.NUM_SEGMENTS; i++) {
          this.ctx.lineTo(i * this.SEGMENT_WIDTH, this.snowPileHeights[i]);
        }

        this.ctx.lineTo(this.width, this.snowPileHeights[this.NUM_SEGMENTS - 1]);
        this.ctx.lineTo(this.width, this.height);
        this.ctx.lineTo(0, this.height);
        this.ctx.closePath();

        const gradient = this.ctx.createLinearGradient(0, this.height - 50, 0, this.height);
        gradient.addColorStop(0, `rgba(180, 194, 223, ${this.layerProps.opacity * 0.9})`);
        gradient.addColorStop(1, `rgba(160, 175, 207, ${this.layerProps.opacity})`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        if (this.layerProps.layer === 1) {
          this.ctx.strokeStyle = "rgba(140, 156, 194, 0.4)";
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      } catch (e) {
        console.error('Snow pile drawing failed:', e);
      }
    }

    getSnowPileHeight(x) {
      const index = Math.floor(x / this.SEGMENT_WIDTH);
      if (index < 0 || index >= this.NUM_SEGMENTS) {
        return this.height;
      }
      return this.snowPileHeights[index];
    }

    addToSnowPile(x, size) {
      const index = Math.floor(x / this.SEGMENT_WIDTH);
      if (index < 0 || index >= this.NUM_SEGMENTS) return;
      
      this.accumulatedSnow += size * 0.008;
      this.accumulatedSnow = Math.min(this.accumulatedSnow, this.maxAccumulatedSnow);
      
      const accumulation = size * 0.4 * (1 - this.accumulatedSnow / this.maxAccumulatedSnow);
      this.snowPileHeights[index] -= accumulation;

      const spread = 2;
      for (let i = 1; i <= spread; i++) {
        if (index - i >= 0) {
          this.snowPileHeights[index - i] -= accumulation * 0.15;
        }
        if (index + i < this.NUM_SEGMENTS) {
          this.snowPileHeights[index + i] -= accumulation * 0.15;
        }
      }

      const minHeight = this.height - 100;
      for (let i = -spread; i <= spread; i++) {
        const currentIndex = index + i;
        if (currentIndex >= 0 && currentIndex < this.NUM_SEGMENTS) {
          this.snowPileHeights[currentIndex] = Math.max(this.snowPileHeights[currentIndex], minHeight);
        }
      }

      this.smoothSnowPile(1);
    }

    animate(wind) {
      if (!AppState.isAnimating || !this.ctx) return;
      
      try {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawSnowPile();

        for (let flake of this.snowflakes) {
          const swayX = Math.sin(flake.swayOffset) * flake.swayAmplitude;
          const windEffect = wind.speed * wind.direction * 0.7;

          flake.rotation += flake.rotationSpeed;

          this.ctx.save();
          this.ctx.translate(flake.x + swayX + windEffect, flake.y);
          this.ctx.rotate(flake.rotation);
          this.ctx.font = `${flake.size}px sans-serif`;
          this.ctx.fillStyle = flake.color;
          
          if (flake.blur > 0) {
            this.ctx.shadowBlur = flake.blur;
            this.ctx.shadowColor = flake.color;
          }
          
          this.ctx.fillText(flake.symbol, 0, 0);
          this.ctx.restore();

          flake.y += flake.fallSpeed;
          flake.x += windEffect * 0.3;
          flake.swayOffset += flake.swaySpeed;

          if (flake.y >= this.getSnowPileHeight(flake.x + swayX + windEffect) - flake.size / 2) {
            this.addToSnowPile(flake.x + swayX + windEffect, flake.size);
            Object.assign(flake, this.createSnowflake());
            flake.y = Math.random() * -this.height;
            flake.x = Math.random() * this.width;
            flake.swayOffset = Math.random() * Math.PI * 2;
          }

          if (flake.x > this.width + 50) {
            flake.x = -50;
          } else if (flake.x < -50) {
            flake.x = this.width + 50;
          }

          if (flake.y > this.height + 50) {
            flake.y = Math.random() * -this.height;
            flake.x = Math.random() * this.width;
            flake.swayOffset = Math.random() * Math.PI * 2;
          }
        }
      } catch (e) {
        console.error('Snow animation failed:', e);
      }
    }

    resize() {
      try {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * (window.devicePixelRatio || 1);
        this.canvas.height = this.height * (window.devicePixelRatio || 1);
        this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        this.NUM_SEGMENTS = Math.ceil(this.width / this.SEGMENT_WIDTH);
        this.initializeSnowPiles();
        this.snowflakes = [];
        this.createSnowflakes(Math.floor(TOTAL_NUM_FLAKES / LAYERS.length));
        this.accumulatedSnow = 0;
      } catch (e) {
        console.error('Snow layer resize failed:', e);
      }
    }
  }

  // Wind system - gentler for night theme
  let wind = {
    direction: Math.random() < 0.5 ? -1 : 1,
    speed: Math.random() * 0.6 + 0.1
  };

  const windInterval = setInterval(() => {
    wind.direction = Math.random() < 0.5 ? -1 : 1;
    wind.speed = Math.random() * 0.6 + 0.1;
  }, 12000);

  AppState.intervals.push(windInterval);

  function initSnowEffect() {
    const snowCanvas = document.getElementById('snow-canvas');
    if (!snowCanvas) {
      console.warn('Snow canvas not found');
      return;
    }
    
    let ctx;
    try {
      ctx = snowCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get 2D context for snow canvas');
      }
    } catch (e) {
      console.error('Snow effect initialization failed:', e);
      return;
    }
    
    const snowflakes = [];
    
    function resizeCanvas() {
      try {
        snowCanvas.width = window.innerWidth;
        snowCanvas.height = window.innerHeight;
      } catch (e) {
        console.error('Snow canvas resize failed:', e);
      }
    }
    
    function createSnowflake() {
      const type = Math.random();
      return {
        x: Math.random() * snowCanvas.width,
        y: Math.random() * snowCanvas.height - snowCanvas.height,
        radius: type < 0.8 ? Math.random() * 1.5 + 0.3 : Math.random() * 3 + 1.5,
        density: Math.random() * 8 + 1,
        speed: type < 0.8 ? Math.random() * 0.4 + 0.2 : Math.random() * 1.2 + 0.4,
        opacity: type < 0.8 ? Math.random() * 0.5 + 0.15 : Math.random() * 0.25 + 0.1,
        xMovement: Math.random() * 1.5 - 0.75,
        blur: type < 0.8 ? 0 : Math.random() * 1.5 + 0.5,
        glow: Math.random() > 0.85,
        blueShift: Math.random() * 20 + 10
      };
    }
    
    function initSnowflakes() {
      snowflakes.length = 0;
      const count = config.snowflakeCount;
      
      for (let i = 0; i < count; i++) {
        snowflakes.push(createSnowflake());
      }
    }
    
    function drawSnowflake(flake) {
      if (!ctx) return;
      
      try {
        ctx.save();
        
        if (flake.blur > 0) {
          ctx.filter = `blur(${flake.blur}px)`;
        }
        
        if (flake.glow) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = `rgba(173, 216, 230, 0.6)`;
        }
        
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        
        const r = Math.max(0, 255 - flake.blueShift);
        const g = Math.max(0, 255 - flake.blueShift/2);
        const b = 255;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${flake.opacity})`;
        ctx.fill();
        
        ctx.restore();
      } catch (e) {
        console.error('Snowflake drawing failed:', e);
      }
    }
    
    function updateSnowflake(flake) {
      flake.y += flake.speed;
      flake.x += flake.xMovement * 0.4 + Math.sin(flake.y * 0.008) * 0.2;
      
      if (flake.y > snowCanvas.height) {
        flake.y = -10;
        flake.x = Math.random() * snowCanvas.width;
      }
      
      if (flake.x > snowCanvas.width) {
        flake.x = 0;
      } else if (flake.x < 0) {
        flake.x = snowCanvas.width;
      }
    }
    
    function drawSnow() {
      if (!AppState.isAnimating || !ctx) return;
      
      try {
        ctx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
        
        snowflakes.forEach(flake => {
          updateSnowflake(flake);
          drawSnowflake(flake);
        });
      } catch (e) {
        console.error('Snow drawing failed:', e);
      }
    }
    
    // Register with animation manager
    animationManager.register('snow', drawSnow);
    
    const resizeHandler = () => {
      resizeCanvas();
      initSnowflakes();
    };
    
    window.addEventListener('resize', resizeHandler);
    
    resizeCanvas();
    initSnowflakes();
  }

  function initShootingStars() {
    const canvas = document.getElementById('shooting-stars');
    if (!canvas) {
      console.warn('Shooting stars canvas not found');
      return;
    }
    
    let ctx;
    try {
      ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get 2D context for shooting stars canvas');
      }
    } catch (e) {
      console.error('Shooting stars initialization failed:', e);
      return;
    }
    
    const stars = [];
    
    function resizeCanvas() {
      try {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } catch (e) {
        console.error('Shooting stars canvas resize failed:', e);
      }
    }
    
    function createShootingStar() {
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height * 0.4;
      const angle = Math.PI / 4 + (Math.random() - 0.5) * Math.PI / 8;
      
      return {
        x: startX, y: startY,
        length: Math.random() * 100 + 60,
        speed: Math.random() * 12 + 8,
        angle, opacity: 1, trail: [],
        color: Math.random() > 0.6 ? 
          `rgba(173, 216, 230, ` : 
          `rgba(255, 255, 255, `
      };
    }
    
    function drawShootingStar(star) {
      if (!ctx) return;
      
      try {
        ctx.save();
        
        star.trail.forEach((point, index) => {
          const opacity = (index / star.trail.length) * star.opacity * 0.6;
          ctx.beginPath();
          ctx.strokeStyle = star.color + `${opacity})`;
          ctx.lineWidth = 3 * (index / star.trail.length);
          if (index > 0) {
            ctx.moveTo(star.trail[index - 1].x, star.trail[index - 1].y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
          }
        });
        
        const gradient = ctx.createLinearGradient(
          star.x - Math.cos(star.angle) * star.length,
          star.y - Math.sin(star.angle) * star.length,
          star.x, star.y
        );
        gradient.addColorStop(0, star.color + `0)`);
        gradient.addColorStop(1, star.color + `${star.opacity})`);
        
        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 10;
        ctx.shadowColor = star.color + `0.8)`;
        ctx.moveTo(star.x - Math.cos(star.angle) * star.length, star.y - Math.sin(star.angle) * star.length);
        ctx.lineTo(star.x, star.y);
        ctx.stroke();
        
        ctx.restore();
      } catch (e) {
        console.error('Shooting star drawing failed:', e);
      }
    }
    
    function updateShootingStar(star) {
      star.trail.push({ x: star.x, y: star.y });
      if (star.trail.length > 25) star.trail.shift();
      
      star.x += Math.cos(star.angle) * star.speed;
      star.y += Math.sin(star.angle) * star.speed;
      star.opacity -= 0.015;
      
      return star.opacity > 0 && star.x < canvas.width && star.y < canvas.height;
    }
    
    function animate() {
      if (!AppState.isAnimating || !ctx) return;
      
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = stars.length - 1; i >= 0; i--) {
          if (!updateShootingStar(stars[i])) {
            stars.splice(i, 1);
          } else {
            drawShootingStar(stars[i]);
          }
        }
      } catch (e) {
        console.error('Shooting stars animation failed:', e);
      }
    }
    
    animationManager.register('shootingStars', animate);
    
    const starInterval = setInterval(() => {
      if (AppState.isAnimating && stars.length < 2) {
        stars.push(createShootingStar());
      }
    }, config.shootingStarInterval);
    
    AppState.intervals.push(starInterval);
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  function initMoonPhases() {
    const moonPhase = document.querySelector('.moon-phase');
    if (!moonPhase) {
      console.warn('Moon phase element not found');
      return;
    }
    
    function updateMoonPhase() {
      try {
        AppState.moonPhase = (AppState.moonPhase + 0.005) % 1;
        const phase = AppState.moonPhase * 2 - 1;
        
        const shadowValue = Math.abs(phase) * 25;
        const shadowDirection = phase < 0 ? shadowValue : -shadowValue;
        moonPhase.style.boxShadow = `inset ${shadowDirection}px 0 0 0 rgba(0, 0, 0, 0.9)`;
      } catch (e) {
        console.error('Moon phase update failed:', e);
      }
    }
    
    const moonInterval = setInterval(updateMoonPhase, 150);
    AppState.intervals.push(moonInterval);
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      AppState.pauseAll();
    } else {
      AppState.resumeAll();
    }
  }

  class LoadingManager {
    constructor() {
      this.overlay = document.querySelector('.loading-overlay');
      this.fadeElements = document.querySelectorAll('.fade-in');
    }
    
    startLoading() {
      if (this.overlay) {
        this.overlay.classList.remove('hidden');
      }
    }
    
    finishLoading() {
      if (this.overlay) {
        this.overlay.classList.add('hidden');
      }
      
      const baseDelay = isMobile ? 100 : 300;
      
      this.fadeElements.forEach((el, index) => {
        setTimeout(() => {
          el.classList.add('visible');
        }, baseDelay + index * (isMobile ? 50 : 150));
      });
      
      AppState.isLoaded = true;
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showCopyConfirmation();
        })
        .catch(() => {
          fallbackCopyToClipboard(text);
        });
    } else {
      fallbackCopyToClipboard(text);
    }
  }
  
  function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      showCopyConfirmation();
    } catch (err) {
      console.error('Copy failed:', err);
    }
    
    document.body.removeChild(textarea);
  }
  
  function showCopyConfirmation() {
    const confirmation = document.createElement('div');
    confirmation.classList.add('copy-confirmation');
    confirmation.textContent = 'copied zcian';
    document.body.appendChild(confirmation);
    
    setTimeout(() => {
      confirmation.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
      confirmation.classList.remove('visible');
      setTimeout(() => {
        if (document.body.contains(confirmation)) {
          document.body.removeChild(confirmation);
        }
      }, 500);
    }, 1500);
  }

  function handleMouseMove(e) {
    try {
      const x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      
      AppState.targetMouseX = x - window.innerWidth / 2;
      AppState.targetMouseY = y - window.innerHeight / 2;
    } catch (err) {
      console.error('Mouse move handling failed:', err);
    }
  }
  
  function handleTouchMove(e) {
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        touches: e.touches
      });
    }
  }
  
  const throttleTime = isMobile ? 100 : 16;
  const throttledMouseMove = throttle(handleMouseMove, throttleTime);
  
  function throttle(callback, limit) {
    let waiting = false;
    return function() {
      if (!waiting) {
        callback.apply(this, arguments);
        waiting = true;
        setTimeout(() => {
          waiting = false;
        }, limit);
      }
    };
  }

  function debounce(func, wait) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
  }

  function createTrees() {
    document.querySelectorAll('.tree').forEach(tree => tree.remove());
    
    const treeImages = ['Tree1.png', 'Tree2.png'];
    
    const allTreePositions = [
      { left: '5%', bottom: 'calc(var(--mountain-bottom) - 2vh)', scale: 0.7, image: 0 },
      { left: '12%', bottom: 'calc(var(--mountain-bottom) - 5vh)', scale: 0.9, image: 1 },
      { left: '20%', bottom: 'calc(var(--mountain-bottom) - 1vh)', scale: 0.8, image: 0 },
      { left: '28%', bottom: 'calc(var(--mountain-bottom) - 8vh)', scale: 1.0, image: 1 },
      { left: '38%', bottom: 'calc(var(--mountain-bottom) - 3vh)', scale: 0.85, image: 0 },
      { left: '46%', bottom: 'calc(var(--mountain-bottom) - 6vh)', scale: 0.75, image: 1 },
      { left: '58%', bottom: 'calc(var(--mountain-bottom) - 4vh)', scale: 0.9, image: 0 },
      { left: '67%', bottom: 'calc(var(--mountain-bottom) - 7vh)', scale: 0.8, image: 1 },
      { left: '76%', bottom: 'calc(var(--mountain-bottom) - 2vh)', scale: 0.7, image: 0 },
      { left: '85%', bottom: 'calc(var(--mountain-bottom) - 5vh)', scale: 0.95, image: 1 },
      { left: '94%', bottom: 'calc(var(--mountain-bottom) - 3vh)', scale: 0.8, image: 0 }
    ];
    
    function getTreePositionsForScreenSize() {
      if (window.innerWidth <= 480) {
        return [allTreePositions[0], allTreePositions[3], allTreePositions[6], allTreePositions[9]];
      } else if (window.innerWidth <= 768) {
        return [allTreePositions[0], allTreePositions[2], allTreePositions[4], allTreePositions[6], allTreePositions[8], allTreePositions[10]];
      } else {
        return allTreePositions;
      }
    }
    
    const treePositions = getTreePositionsForScreenSize();
    
    treePositions.forEach((pos, index) => {
      const tree = document.createElement('img');
      tree.id = 'tree_' + (index + 1);
      tree.className = 'tree';
      tree.src = treeImages[pos.image];
      tree.alt = 'tree';
      tree.onerror = () => {
        console.warn(`Tree image ${tree.src} failed to load`);
        tree.style.display = 'none';
      };
      
      if (pos.left) tree.style.left = pos.left;
      if (pos.right) tree.style.right = pos.right;
      tree.style.bottom = pos.bottom;
      tree.style.transform = `scale(${pos.scale})`;
      
      const zIndex = Math.floor(30 - (pos.bottom.includes('8vh') ? 3 : 
                              pos.bottom.includes('7vh') ? 2 : 
                              pos.bottom.includes('6vh') ? 1 : 0));
      tree.style.zIndex = zIndex;
      
      document.body.appendChild(tree);
    });
  }

  const handleResize = debounce(() => {
    try {
      const canvases = [
        'snow-canvas',
        'shooting-stars', 
        'star-canvas'
      ];
      
      canvases.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
          if (id === 'star-canvas') {
            canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
            canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
          } else {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
          }
        }
      });
      
      createTrees();
    } catch (e) {
      console.error('Resize handling failed:', e);
    }
  }, isMobile ? 500 : 250);

  window.addEventListener('DOMContentLoaded', () => {
    const loadingManager = new LoadingManager();
    loadingManager.startLoading();
    
    try {
      AppState.initialize();
      
      setTimeout(() => {
        if (!AppState.hasWebGLSupport) {
          document.body.classList.add('no-webgl');
          loadingManager.finishLoading();
          return;
        }
        
        try {
          const groundElement = document.getElementById('ground');
          if (groundElement) {
            const groundSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            groundSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            const sprout1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            sprout1.setAttribute('id', 'sprout_1');
            sprout1.setAttribute('d', 'm183,60l-28,-62l36,61l-8,1z');
            sprout1.setAttribute('stroke-width', '2');
            sprout1.setAttribute('stroke', '#000000');
            sprout1.setAttribute('fill', '#004000');
            
            const sprout2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            sprout2.setAttribute('id', 'sprout_2');
            sprout2.setAttribute('d', 'm168.45071,11.83101l10.77464,12.74646l16.19717,20.35211l-1.05634,15.14085l-7.04225,-14.78874l-11.97183,-16.12677l-6.9014,-17.32391z');
            sprout2.setAttribute('transform', 'rotate(1.487221360206604 181.93661499023597,25.95071411132733)');
            sprout2.setAttribute('stroke-width', '2');
            sprout2.setAttribute('stroke', '#000000');
            sprout2.setAttribute('fill', '#004000');
            
            const sprout3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            sprout3.setAttribute('id', 'sprout_3');
            sprout3.setAttribute('d', 'm195.13304,61.44763l2.05006,-3.84201l10.91548,-31.97182l5.28169,-9.50705l6.33803,-9.50703l10.21127,-5.6338l-6.69014,7.39436l-7.04225,9.50705l-4.92958,6.33803');
            sprout3.setAttribute('stroke-width', '2');
            sprout3.setAttribute('stroke', '#000000');
            sprout3.setAttribute('fill', '#004000');
            
            group.appendChild(sprout1);
            group.appendChild(sprout2);
            group.appendChild(sprout3);
            groundSvg.appendChild(group);
            groundElement.appendChild(groundSvg);
          }
        } catch (e) {
          console.error('Ground SVG creation failed:', e);
        }
        
        try {
          createTrees();
        } catch (e) {
          console.error('Tree creation failed:', e);
        }
        
        let snowLayers = [];
        try {
          snowLayers = LAYERS.map(layer => {
            try {
              return new SnowLayer(`snow-canvas-${layer.layer}`, layer);
            } catch (e) {
              console.error(`Failed to create snow layer ${layer.layer}:`, e);
              return null;
            }
          }).filter(layer => layer !== null);

          function handleSnowResize() {
            snowLayers.forEach(layer => {
              try {
                layer.resize();
              } catch (e) {
                console.error('Snow layer resize failed:', e);
              }
            });
          }
          
          window.addEventListener('resize', handleSnowResize);
          
          function animateSouthParkSnow() {
            snowLayers.forEach(layer => {
              try {
                layer.animate(wind);
              } catch (e) {
                console.error('Snow layer animation failed:', e);
              }
            });
          }
          
          animationManager.register('southParkSnow', animateSouthParkSnow);
        } catch (e) {
          console.error('South Park snow initialization failed:', e);
        }
        
        try {
          const discordButton = document.querySelector('[data-social="discord"]');
          if (discordButton) {
            const eventType = isMobile ? 'touchend' : 'click';
            discordButton.addEventListener(eventType, function(e) {
              e.preventDefault();
              e.stopPropagation();
              copyToClipboard('zcian');
            });
          }
        } catch (e) {
          console.error('Discord button setup failed:', e);
        }

        try {
          if (typeof Splitting !== 'undefined') {
            Splitting();
          }
        } catch (e) {
          console.warn('Splitting.js re-initialization failed:', e);
        }

        if (isMobile) {
          document.body.classList.add('is-mobile');
        }
        
        loadingManager.finishLoading();
      }, isMobile ? 200 : 500);
    } catch (e) {
      console.error('Initialization failed:', e);
      loadingManager.finishLoading();
    }
  });
  
  window.addEventListener('resize', handleResize);
  
  if (isMobile) {
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchstart', handleTouchMove, { passive: true });
  } else {
    document.addEventListener('mousemove', throttledMouseMove);
  }
  
  window.addEventListener('beforeunload', () => {
    try {
      AppState.pauseAll();
      AppState.cleanup();
      animationManager.stop();
      
      window.removeEventListener('resize', handleResize);
      
      if (isMobile) {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchstart', handleTouchMove);
      } else {
        document.removeEventListener('mousemove', throttledMouseMove);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    } catch (e) {
      console.error('Cleanup failed:', e);
    }
  });
})();