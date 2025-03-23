import * as THREE from './js/three/three.module.js';
import { OrbitControls } from './js/three/examples/jsm/controls/OrbitControls.js';
import { FirstPersonControls } from './js/three/examples/jsm/controls/FirstPersonControls.js';
import Stats from './js/three/examples/jsm/libs/stats.module.js';

// Global variables
let scene, camera, renderer, controls, stats;
let particles, particleSystem;
let mouseX = 0, mouseY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let analyser, audioContext, audioSource, dataArray;
let isAudioActive = false;
let mouseDown = false; // Add mouseDown tracking variable
let blackHole, accretionDisk; // Add references to black hole objects
let fpsControls; // First person controls
let isSpaceshipMode = false;
let spaceshipMesh, laserSound, alienSound, gameOverSound;
let aliens = [];
let lasers = [];
let score = 0;
let scoreDisplay;
let cockpitContainer, dashboard, steeringWheel;
let gameOver = false;
let alienSpeed = 2;
let tempVector = new THREE.Vector3();
let tempQuaternion = new THREE.Quaternion();
let tempDirection = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
let lastShotTimestamp; // Add this line to track the last shot time

// Configuration
const config = {
    // Particle system settings
    particleCount: 5000,
    particleSize: 0.1,
    particleColor: 0x00ffff,
    backgroundColor: 0x000816,
    speed: 0.01,
    rotationSpeed: 0.001,
    interactionStrength: 0.5,
    audioReactivity: 0.5,
    colorScheme: 'cosmic',
    colorSchemes: {
        cosmic: [0x00ffff, 0xff00ff, 0x00ff00, 0xff0066],
        sunset: [0xff5e62, 0xff9966, 0xffcc66, 0xffff66],
        ocean: [0x004e92, 0x00c6ff, 0x0072ff, 0x00a8e8],
        galaxy: [0x6600ff, 0x9900ff, 0xcc00ff, 0xff00cc],
        neon: [0x00ffff, 0xff00ff, 0xffff00, 0x00ff00]
    },
    
    // Galaxy physics settings
    mode: 'particle',  // 'particle', 'galaxy' or 'spaceship'
    galaxySettings: {
        galaxyRadius: 25,
        spiralArms: 3,
        spiralTightness: 3.5,
        rotationFactor: 0.5,
        coreSize: 5,
        coreConcentration: 2.0,
        haloSize: 25,
        haloParticleRatio: 0.3,
        dustCloudCount: 5,
        enableGravity: true,
        blackHoleMass: 1000,
        stabilityFactor: 0.98
    },
    
    // Visual effects settings
    glow: {
        enabled: true,
        size: 1.5
    },
    
    // Spaceship settings
    spaceship: {
        speed: 0.5,
        turnSpeed: 0.5,
        laserSpeed: 2.0,
        laserCooldown: 500, // ms
        alienCount: 20
    }
};

// Initialize the scene
init();
animate();

// Prevent space key from scrolling the page
window.addEventListener('keydown', function(e) {
    // Prevent space key from scrolling
    if (e.code === 'Space' && isSpaceshipMode) {
        e.preventDefault();
        return false;
    }
}, {passive: false});

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    
    // Setup subtle ambient fog for atmosphere
    scene.fog = new THREE.FogExp2(
        config.backgroundColor, 
        0.00015 // Fixed subtle value for soft atmosphere
    );

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add point light for better illumination
    const pointLight = new THREE.PointLight(0xffffff, 1.0);
    scene.add(pointLight);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    // Create renderer with enhanced settings
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // Initialize stats
    stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    // Add controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    
    // Create first person controls (disabled by default)
    fpsControls = new FirstPersonControls(camera, renderer.domElement);
    fpsControls.movementSpeed = config.spaceship.speed * 30;
    fpsControls.lookSpeed = config.spaceship.turnSpeed * 0.1;
    fpsControls.enabled = false;
    fpsControls.lookVertical = true;
    fpsControls.activeLook = true;

    // Create particle system based on mode
    if (config.mode === 'galaxy') {
        createGalaxySystem(); // This includes creating the black hole
    } else {
        createParticleSystem(); // This ensures no black hole is present
    }
    
    // Create background stars
    createStarfield();
    
    // Create spaceship
    createSpaceship();
    
    // Create cockpit for first-person view
    createCockpit();
    
    // Create score display
    createScoreDisplay();
    
    // Load sounds
    loadLaserSound();
    loadAlienSound();
    loadGameOverSound();
    
    // Setup audio analyzer
    setupAudio();
    
    // Add event listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    
    // Create UI controls
    createControls();
}

function createParticleSystem() {
    // Clean up old particle system if it exists
    if (particleSystem) {
        scene.remove(particleSystem);
        particles.dispose();
    }
    
    // Remove black hole objects if they exist
    if (blackHole) {
        scene.remove(blackHole);
        blackHole.geometry.dispose();
        blackHole.material.dispose();
        blackHole = null;
    }
    
    if (accretionDisk) {
        scene.remove(accretionDisk);
        accretionDisk.geometry.dispose();
        accretionDisk.material.dispose();
        accretionDisk = null;
    }

    const positions = new Float32Array(config.particleCount * 3);
    const colors = new Float32Array(config.particleCount * 3);
    const sizes = new Float32Array(config.particleCount);
    const velocities = new Float32Array(config.particleCount * 3); // Add velocities

    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        
        // Random position within a sphere
        const radius = 30;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
        
        // Initialize velocities with small random values
        velocities[i3] = (Math.random() - 0.5) * 0.01;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;
        
        // Use the color from the config with slight variation
        const colorScheme = config.colorSchemes[config.colorScheme];
        const colorIndex = Math.floor(Math.random() * colorScheme.length);
        const color = new THREE.Color(colorScheme[colorIndex]);
        
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
        
        // Random size
        sizes[i] = config.particleSize * (0.8 + Math.random() * 0.4);
        
        // Validate data to prevent NaN
        for (let j = 0; j < 3; j++) {
            if (isNaN(positions[i3 + j])) positions[i3 + j] = 0;
            if (isNaN(velocities[i3 + j])) velocities[i3 + j] = 0;
            if (isNaN(colors[i3 + j])) colors[i3 + j] = 0.5;
        }
        if (isNaN(sizes[i])) sizes[i] = config.particleSize;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3)); // Add velocity attribute

    // Use enhanced glow material
    const material = createGlowMaterial(config.particleSize);

    particles = geometry; // Store the geometry, not just the attributes
    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
    
    // Ensure subtle fog is maintained
    if (!scene.fog) {
        scene.fog = new THREE.FogExp2(config.backgroundColor, 0.00015);
    }
}

function createStarfield() {
    // Create a background starfield
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        // Random positions far away
        const radius = 100 + Math.random() * 900; // 100-1000
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starPositions[i3 + 2] = radius * Math.cos(phi);
        
        // Star colors - mostly white with hints of blue/yellow
        const colorChoice = Math.random();
        let color;
        if (colorChoice < 0.6) {
            color = new THREE.Color(0xffffff); // White (most stars)
        } else if (colorChoice < 0.8) {
            color = new THREE.Color(0xccccff); // Bluish
        } else {
            color = new THREE.Color(0xffffcc); // Yellowish
        }
        
        starColors[i3] = color.r;
        starColors[i3 + 1] = color.g;
        starColors[i3 + 2] = color.b;
        
        // Star sizes - mostly small with a few larger ones
        starSizes[i] = 0.05 + Math.pow(Math.random(), 10) * 0.5; // Mostly small with few large
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    
    const starMaterial = new THREE.PointsMaterial({
        size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);
}

function updateParticles() {
    // Choose update method based on mode
    if (config.mode === 'galaxy') {
        updateGalaxyPhysics();
    } else {
        updateParticleEffects();
    }
}

// Original particle update function renamed
function updateParticleEffects() {
    const positions = particles.attributes.position.array;
    const sizes = particles.attributes.size.array;
    const colors = particles.attributes.color.array;
    const velocities = particles.attributes.velocity.array;
    
    // Audio data for reactivity
    let audioAverage = 0;
    if (isAudioActive && analyser) {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average audio level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        audioAverage = sum / dataArray.length;
        
        if (audioAverage > 0) {
            console.log("Detecting audio: " + audioAverage.toFixed(2));
        }
    }
    
    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        
        // Apply audio reactivity if active
        let audioFactor = 1;
        if (isAudioActive && dataArray && dataArray.length > 0) {
            // For more dramatic effect, use different frequency bands for different particles
            const audioIndex = Math.min(Math.floor(i / config.particleCount * dataArray.length), dataArray.length - 1);
            audioFactor = 1 + (dataArray[audioIndex] / 128) * config.audioReactivity; // More amplification
            
            // Apply size change - more dramatic effect
            sizes[i] = config.particleSize * (0.5 + audioFactor);
            
            // Make particles move based on audio for more dramatic effect
            const audioImpulse = audioFactor * config.audioReactivity * 0.03;
            velocities[i3] += (Math.random() - 0.5) * audioImpulse;
            velocities[i3 + 1] += (Math.random() - 0.5) * audioImpulse;
            velocities[i3 + 2] += (Math.random() - 0.5) * audioImpulse;
            
            // Modulate color for extra visual feedback
            if (i % 5 === 0) { // Only affect some particles for better effect
                const colorScheme = config.colorSchemes[config.colorScheme];
                const pulseAmount = Math.sin(Date.now() * 0.001 * audioAverage * 0.01) * 0.3 + 0.7;
                colors[i3] *= pulseAmount;
                colors[i3 + 1] *= pulseAmount;
                colors[i3 + 2] *= pulseAmount;
            }
        } else {
            // Reset size when audio not active
            sizes[i] = config.particleSize * (0.8 + Math.random() * 0.4);
        }
        
        // Update velocities with sine motion
        velocities[i3] += Math.sin(i + Date.now() * 0.001) * config.speed * 0.01;
        velocities[i3 + 1] += Math.cos(i + Date.now() * 0.001) * config.speed * 0.01;
        velocities[i3 + 2] += Math.sin(i + Date.now() * 0.001) * config.speed * 0.005;
        
        // Apply mouse interaction to velocities
        const mouseXOffset = (mouseX - windowHalfX) / windowHalfX;
        const mouseYOffset = (mouseY - windowHalfY) / windowHalfY;
        
        velocities[i3] += mouseXOffset * config.interactionStrength * 0.001;
        velocities[i3 + 1] -= mouseYOffset * config.interactionStrength * 0.001;
        
        // Apply damping to velocities
        velocities[i3] *= 0.98;
        velocities[i3 + 1] *= 0.98;
        velocities[i3 + 2] *= 0.98;
        
        // Apply velocities to positions
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];
        
        // Containment - keep particles within bounds
        const maxDist = 50;
        const dist = Math.sqrt(
            positions[i3] * positions[i3] + 
            positions[i3 + 1] * positions[i3 + 1] + 
            positions[i3 + 2] * positions[i3 + 2]
        );
        
        if (dist > maxDist) {
            const scale = maxDist / dist;
            positions[i3] *= scale;
            positions[i3 + 1] *= scale;
            positions[i3 + 2] *= scale;
        }
        
        // Protection against NaN values
        for (let j = 0; j < 3; j++) {
            if (isNaN(positions[i3 + j])) {
                positions[i3 + j] = 0;
            }
            if (isNaN(velocities[i3 + j])) {
                velocities[i3 + j] = 0;
            }
        }
    }
    
    particles.attributes.position.needsUpdate = true;
    particles.attributes.size.needsUpdate = true;
    particles.attributes.color.needsUpdate = true; // Make sure color updates are applied
    particles.attributes.velocity.needsUpdate = true; // Update velocities
    
    // Adjust rotation speed with audio if active
    const rotationMultiplier = isAudioActive ? (1 + audioAverage / 128 * config.audioReactivity) : 1;
    particleSystem.rotation.x += config.rotationSpeed * 0.5 * rotationMultiplier;
    particleSystem.rotation.y += config.rotationSpeed * rotationMultiplier;
}

// New galaxy physics update function
function updateGalaxyPhysics() {
    const positions = particles.attributes.position.array;
    const velocities = particles.attributes.velocity.array;
    const accelerations = particles.attributes.acceleration.array;
    const particleTypes = particles.attributes.particleType.array;
    const masses = particles.attributes.mass.array;
    const sizes = particles.attributes.size.array;
    const colors = particles.attributes.color.array;
    
    const galaxySettings = config.galaxySettings;
    const dt = 0.016; // Time step
    const gravityConstant = 0.01;
    
    // Black hole at center
    const blackHole = new THREE.Vector3(0, 0, 0);
    const blackHoleMass = galaxySettings.blackHoleMass;
    
    // Apply global rotation to enhance visual rotation effect
    particleSystem.rotation.y += 0.001 * galaxySettings.rotationFactor;
    
    // Update each particle
    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        const particleType = particleTypes[i];
        const mass = masses[i] || 1; // Ensure mass is never zero
        
        // Get current position and create vector
        const position = new THREE.Vector3(
            positions[i3] || 0,
            positions[i3 + 1] || 0,
            positions[i3 + 2] || 0
        );
        
        // Calculate distance to black hole
        const distToCenter = position.distanceTo(blackHole);
        
        // Reset acceleration
        accelerations[i3] = 0;
        accelerations[i3 + 1] = 0;
        accelerations[i3 + 2] = 0;
        
        if (galaxySettings.enableGravity) {
            // Apply gravity from black hole (with safety check for very small distances)
            const minDistance = 0.1; // Minimum distance to prevent extreme forces
            const forceMagnitude = gravityConstant * blackHoleMass * mass / Math.max(minDistance * minDistance, distToCenter * distToCenter);
            
            // Direction to black hole (with protection against zero-length vectors)
            const forceDirection = new THREE.Vector3().subVectors(blackHole, position);
            if (forceDirection.lengthSq() > 0.000001) {
                forceDirection.normalize();
                
                // Calculate acceleration = force / mass (with protection)
                const forceFactor = forceMagnitude / Math.max(0.1, mass);
                const acceleration = forceDirection.multiplyScalar(forceFactor);
                
                accelerations[i3] += acceleration.x;
                accelerations[i3 + 1] += acceleration.y;
                accelerations[i3 + 2] += acceleration.z;
            }
        }
        
        // Mouse interaction
        if (mouseDown) {
            const mouseVector = new THREE.Vector3(
                (mouseX - windowHalfX) / windowHalfX * 20,
                -(mouseY - windowHalfY) / windowHalfY * 20,
                0
            );
            
            // Project mouse to appropriate depth
            mouseVector.unproject(camera);
            const dir = mouseVector.sub(camera.position).normalize();
            const distance = -camera.position.z / dir.z;
            const mousePosWorld = camera.position.clone().add(dir.multiplyScalar(distance));
            
            // Calculate distance to mouse position
            const distToMouse = position.distanceTo(mousePosWorld);
            
            if (distToMouse < 10) { // Influence radius
                // Direction to/from mouse (with protection)
                const forceDirection = new THREE.Vector3().subVectors(mousePosWorld, position);
                if (forceDirection.lengthSq() > 0.000001) {
                    forceDirection.normalize();
                    const forceMagnitude = 0.01 * config.interactionStrength / Math.max(0.1, distToMouse);
                    
                    // Apply force (attraction)
                    const mouseAccel = forceDirection.multiplyScalar(forceMagnitude);
                    
                    accelerations[i3] += mouseAccel.x;
                    accelerations[i3 + 1] += mouseAccel.y;
                    accelerations[i3 + 2] += mouseAccel.z;
                }
            }
        }
        
        // Apply acceleration to velocity (with limits)
        const maxAccel = 0.1;
        velocities[i3] += clamp(accelerations[i3] * dt, -maxAccel, maxAccel);
        velocities[i3 + 1] += clamp(accelerations[i3 + 1] * dt, -maxAccel, maxAccel);
        velocities[i3 + 2] += clamp(accelerations[i3 + 2] * dt, -maxAccel, maxAccel);
        
        // Apply damping (stability)
        velocities[i3] *= galaxySettings.stabilityFactor;
        velocities[i3 + 1] *= galaxySettings.stabilityFactor;
        velocities[i3 + 2] *= galaxySettings.stabilityFactor;
            
            // Apply velocity to position
        positions[i3] += velocities[i3] * dt;
        positions[i3 + 1] += velocities[i3 + 1] * dt;
        positions[i3 + 2] += velocities[i3 + 2] * dt;
        
        // Limit maximum velocity to prevent instability
        const maxVelocity = 2.0;
        const currentVelocity = Math.sqrt(
            velocities[i3] * velocities[i3] + 
            velocities[i3 + 1] * velocities[i3 + 1] + 
            velocities[i3 + 2] * velocities[i3 + 2]
        );
        
        if (currentVelocity > maxVelocity) {
            const scale = maxVelocity / currentVelocity;
            velocities[i3] *= scale;
            velocities[i3 + 1] *= scale;
            velocities[i3 + 2] *= scale;
        }
        
        // Containment - if particles go too far, gently pull them back
        const maxRadius = galaxySettings.galaxyRadius * 5;
        if (distToCenter > maxRadius) {
            const pullFactor = 0.01;
            const pullDirection = new THREE.Vector3().subVectors(blackHole, position);
            if (pullDirection.lengthSq() > 0.000001) {
                pullDirection.normalize();
                velocities[i3] += pullDirection.x * pullFactor;
                velocities[i3 + 1] += pullDirection.y * pullFactor;
                velocities[i3 + 2] += pullDirection.z * pullFactor;
            }
        }
        
        // Final safety check to prevent NaN values
        for (let j = 0; j < 3; j++) {
            if (isNaN(positions[i3 + j])) {
                positions[i3 + j] = 0;
            }
            if (isNaN(velocities[i3 + j])) {
                velocities[i3 + j] = 0;
            }
            if (isNaN(accelerations[i3 + j])) {
                accelerations[i3 + j] = 0;
            }
        }
    }
    
    // Update the buffers
    particles.attributes.position.needsUpdate = true;
    particles.attributes.color.needsUpdate = true;
    particles.attributes.size.needsUpdate = true;
    particles.attributes.velocity.needsUpdate = true;
}

// Helper function to clamp values between min and max
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = 0.016; // Approx time between frames
    
    if (isSpaceshipMode) {
        // Only update fps controls for movement when not using dual mouse controls
        if (!(leftMouseDown && rightMouseDown)) {
            fpsControls.update(delta);
        } else {
            // Apply forward/backward movement based on keys when dual mouse is active
            const moveSpeed = config.spaceship.speed * 30 * delta;
            
            // Get forward vector from camera direction
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(camera.quaternion);
            
            // Check for WASD or arrow keys
            if (keyStates['KeyW'] || keyStates['ArrowUp']) {
                camera.position.addScaledVector(forward, moveSpeed);
            }
            if (keyStates['KeyS'] || keyStates['ArrowDown']) {
                camera.position.addScaledVector(forward, -moveSpeed);
            }
            
            // Apply sideways movement
            const right = new THREE.Vector3(1, 0, 0);
            right.applyQuaternion(camera.quaternion);
            
            if (keyStates['KeyA'] || keyStates['ArrowLeft']) {
                camera.position.addScaledVector(right, -moveSpeed);
            }
            if (keyStates['KeyD'] || keyStates['ArrowRight']) {
                camera.position.addScaledVector(right, moveSpeed);
            }
        }
        
        updateLasersAndAliens(delta);
        
        // Update cockpit position to match camera
        if (cockpitContainer) {
            cockpitContainer.position.copy(camera.position);
            cockpitContainer.quaternion.copy(camera.quaternion);
            
            // Make steering wheel rotate slightly based on turning
            if (steeringWheel) {
                // Extract yaw rotation from camera quaternion
                const yawRot = Math.atan2(2.0 * (camera.quaternion.y * camera.quaternion.w),
                                        1.0 - 2.0 * (camera.quaternion.y * camera.quaternion.y));
                // Apply a scaled rotation to the steering wheel
                steeringWheel.rotation.z = yawRot * 2;
            }
        }
    } else {
        controls.update();
    }
    
    // Choose update method based on mode
    if (config.mode === 'galaxy') {
        updateGalaxyPhysics();
    } else {
        updateParticleEffects();
    }
    
    renderer.render(scene, camera);
    stats.update();
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
}

function onDocumentMouseDown(event) {
    mouseDown = true;
}

function onDocumentMouseUp(event) {
    mouseDown = false;
}

function setupAudio() {
    try {
        // Create button to enable audio
        const audioButton = document.createElement('button');
        audioButton.textContent = 'Enable Audio Reactivity';
        audioButton.id = 'audio-reactivity-button';
        audioButton.name = 'audio-reactivity-button';
        audioButton.setAttribute('aria-label', 'Toggle audio reactivity');
        audioButton.style.position = 'absolute';
        audioButton.style.bottom = '10px';
        audioButton.style.left = '10px';
        audioButton.style.zIndex = '1000';
        audioButton.style.padding = '10px';
        audioButton.style.backgroundColor = '#333';
        audioButton.style.color = '#fff';
        audioButton.style.border = 'none';
        audioButton.style.borderRadius = '5px';
        audioButton.style.cursor = 'pointer';
        
        audioButton.addEventListener('click', function() {
            // Only create the audio context on user click if it doesn't exist
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
            }
            
            // Resume context on user interaction
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log("Audio context resumed successfully");
                });
            }
            
            if (!isAudioActive) {
                navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                    .then(function(stream) {
                        audioSource = audioContext.createMediaStreamSource(stream);
                        audioSource.connect(analyser);
                        isAudioActive = true;
                        audioButton.textContent = 'Disable Audio Reactivity';
                        audioButton.setAttribute('aria-pressed', 'true');
                        console.log("Audio reactivity enabled successfully");
                        
                        // Adjust sensitivity
                        analyser.minDecibels = -90;
                        analyser.maxDecibels = -10;
                        analyser.smoothingTimeConstant = 0.85;
                    })
                    .catch(function(err) {
                        console.error('Audio input error: ' + err);
                        alert('Audio error: ' + err.message);
                    });
            } else {
                if (audioSource) {
                    audioSource.disconnect();
                }
                isAudioActive = false;
                audioButton.textContent = 'Enable Audio Reactivity';
                audioButton.setAttribute('aria-pressed', 'false');
            }
        });
        
        document.body.appendChild(audioButton);
    } catch (e) {
        console.error('Audio context not supported or other audio error: ' + e);
        alert('Audio system error: ' + e.message);
    }
}

function createControls() {
    const controlsPanel = document.getElementById('controls');
    controlsPanel.innerHTML = '';  // Clear existing controls
    
    // Main container
    const container = document.createElement('div');
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.padding = '15px';
    container.style.borderRadius = '5px';
    container.style.color = '#fff';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.maxWidth = '300px';
    container.style.maxHeight = '80vh';
    container.style.overflowY = 'auto';
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Galaxy Simulator Controls';
    title.style.margin = '0 0 15px 0';
    title.style.textAlign = 'center';
    title.style.fontSize = '18px';
    container.appendChild(title);
    
    // Simulation mode toggle
    const modeDiv = document.createElement('div');
    modeDiv.style.margin = '10px 0';
    
    const modeLabel = document.createElement('div');
    modeLabel.textContent = 'Simulation Mode: ';
    modeLabel.style.display = 'block';
    modeLabel.style.marginBottom = '5px';
    modeDiv.appendChild(modeLabel);
    
    // Container for the toggle buttons
    const modeToggle = document.createElement('div');
    modeToggle.style.display = 'flex';
    modeToggle.style.justifyContent = 'space-between';
    modeToggle.style.backgroundColor = '#333';
    modeToggle.style.borderRadius = '20px';
    modeToggle.style.padding = '3px';
    
    // Particle mode option
    const particleLabel = document.createElement('label');
    particleLabel.style.flex = '1';
    particleLabel.style.textAlign = 'center';
    particleLabel.style.borderRadius = '17px';
    particleLabel.style.padding = '8px';
    particleLabel.style.cursor = 'pointer';
    particleLabel.style.backgroundColor = config.mode === 'particle' ? '#4CAF50' : 'transparent';
    particleLabel.style.color = config.mode === 'particle' ? '#000' : '#fff';
    
    const particleInput = document.createElement('input');
    particleInput.type = 'radio';
    particleInput.id = 'particle-mode';
    particleInput.name = 'simulation-mode';
    particleInput.value = 'particle';
    particleInput.checked = config.mode === 'particle';
    particleInput.style.display = 'none'; // Hide the radio button
    
    particleLabel.appendChild(particleInput);
    particleLabel.appendChild(document.createTextNode('Particles'));
    particleLabel.htmlFor = 'particle-mode';
    
    // Galaxy mode option
    const galaxyLabel = document.createElement('label');
    galaxyLabel.style.flex = '1';
    galaxyLabel.style.textAlign = 'center';
    galaxyLabel.style.borderRadius = '17px';
    galaxyLabel.style.padding = '8px';
    galaxyLabel.style.cursor = 'pointer';
    galaxyLabel.style.backgroundColor = config.mode === 'galaxy' ? '#4CAF50' : 'transparent';
    galaxyLabel.style.color = config.mode === 'galaxy' ? '#000' : '#fff';
    
    const galaxyInput = document.createElement('input');
    galaxyInput.type = 'radio';
    galaxyInput.id = 'galaxy-mode';
    galaxyInput.name = 'simulation-mode';
    galaxyInput.value = 'galaxy';
    galaxyInput.checked = config.mode === 'galaxy';
    galaxyInput.style.display = 'none'; // Hide the radio button
    
    galaxyLabel.appendChild(galaxyInput);
    galaxyLabel.appendChild(document.createTextNode('Galaxy'));
    galaxyLabel.htmlFor = 'galaxy-mode';
    
    // Add event listeners
    particleInput.addEventListener('change', function() {
        if (this.checked) {
            config.mode = 'particle';
            createParticleSystem(); // This ensures no black hole is present
            updateToggleUI();
            createControls(); // Refresh controls
        }
    });
    
    galaxyInput.addEventListener('change', function() {
        if (this.checked) {
            config.mode = 'galaxy';
            createGalaxySystem(); // This creates the black hole
            updateToggleUI();
            createControls(); // Refresh controls
        }
    });
    
    // Helper function to update toggle UI
    function updateToggleUI() {
        particleLabel.style.backgroundColor = config.mode === 'particle' ? '#4CAF50' : 'transparent';
        particleLabel.style.color = config.mode === 'particle' ? '#000' : '#fff';
        galaxyLabel.style.backgroundColor = config.mode === 'galaxy' ? '#4CAF50' : 'transparent';
        galaxyLabel.style.color = config.mode === 'galaxy' ? '#000' : '#fff';
    }
    
    modeToggle.appendChild(particleLabel);
    modeToggle.appendChild(galaxyLabel);
    modeDiv.appendChild(modeToggle);
    container.appendChild(modeDiv);
    
    // Particle settings section
    const particleTitle = document.createElement('h4');
    particleTitle.textContent = 'Particle Settings';
    particleTitle.style.margin = '20px 0 10px 0';
    particleTitle.style.borderBottom = '1px solid #444';
    particleTitle.style.paddingBottom = '5px';
    container.appendChild(particleTitle);
    
    // Particle Count slider
    container.appendChild(createSlider('Particle Count:', config.particleCount, 1000, 10000, 100, (value) => {
        config.particleCount = Number(value);
        if (config.mode === 'particle') {
            createParticleSystem();
        } else {
            createGalaxySystem();
        }
    }));
    
    // Particle Size slider
    container.appendChild(createSlider('Particle Size:', config.particleSize, 0.05, 0.3, 0.01, (value) => {
        config.particleSize = Number(value);
        if (config.mode === 'particle') {
            createParticleSystem();
        } else {
            createGalaxySystem();
        }
    }));
    
    // Speed slider
    container.appendChild(createSlider('Speed:', config.speed, 0.001, 0.05, 0.001, (value) => {
        config.speed = Number(value);
    }));
    
    // Rotation Speed slider
    container.appendChild(createSlider('Rotation Speed:', config.rotationSpeed, 0, 0.01, 0.0001, (value) => {
        config.rotationSpeed = Number(value);
    }));
    
    // Interaction Strength slider
    container.appendChild(createSlider('Interaction Strength:', config.interactionStrength, 0, 1, 0.05, (value) => {
        config.interactionStrength = Number(value);
    }));
    
    // Audio Reactivity slider
    container.appendChild(createSlider('Audio Reactivity:', config.audioReactivity, 0, 2, 0.1, (value) => {
        config.audioReactivity = Number(value);
    }));
    
    // Galaxy-specific controls (only shown in galaxy mode)
    if (config.mode === 'galaxy') {
        const galaxyTitle = document.createElement('h4');
        galaxyTitle.textContent = 'Galaxy Settings';
        galaxyTitle.style.margin = '20px 0 10px 0';
        galaxyTitle.style.borderBottom = '1px solid #444';
        galaxyTitle.style.paddingBottom = '5px';
        container.appendChild(galaxyTitle);
        
        // Galaxy Radius slider
        container.appendChild(createSlider('Galaxy Radius:', config.galaxySettings.galaxyRadius, 10, 50, 1, (value) => {
            config.galaxySettings.galaxyRadius = Number(value);
            createGalaxySystem();
        }));
        
        // Spiral Arms slider
        container.appendChild(createSlider('Spiral Arms:', config.galaxySettings.spiralArms, 2, 7, 1, (value) => {
            config.galaxySettings.spiralArms = Math.floor(Number(value));
            createGalaxySystem();
        }));
        
        // Spiral Tightness slider
        container.appendChild(createSlider('Spiral Tightness:', config.galaxySettings.spiralTightness, 0.5, 5, 0.1, (value) => {
            config.galaxySettings.spiralTightness = Number(value);
            createGalaxySystem();
        }));
        
        // Rotation Factor slider
        container.appendChild(createSlider('Rotation Factor:', config.galaxySettings.rotationFactor, 0.1, 1, 0.05, (value) => {
            config.galaxySettings.rotationFactor = Number(value);
        }));
        
        // Black Hole Mass slider
        container.appendChild(createSlider('Black Hole Mass:', config.galaxySettings.blackHoleMass, 100, 2000, 100, (value) => {
            config.galaxySettings.blackHoleMass = Number(value);
        }));
        
        // Gravity Toggle
        const gravityDiv = document.createElement('div');
        gravityDiv.style.margin = '10px 0';
        
        const gravityLabel = document.createElement('div');
        gravityLabel.style.display = 'flex';
        gravityLabel.style.justifyContent = 'space-between';
        gravityLabel.style.alignItems = 'center';
        gravityLabel.style.marginBottom = '5px';
        
        const gravityText = document.createElement('label');
        gravityText.textContent = 'Enable Gravity:';
        gravityText.htmlFor = 'gravity-toggle'; // Associate with checkbox
        
        const gravityToggle = document.createElement('input');
        gravityToggle.type = 'checkbox';
        gravityToggle.id = 'gravity-toggle';
        gravityToggle.name = 'gravity-toggle';
        gravityToggle.checked = config.galaxySettings.enableGravity;
        gravityToggle.style.width = '20px';
        gravityToggle.style.height = '20px';
        
        gravityToggle.addEventListener('change', function() {
            config.galaxySettings.enableGravity = this.checked;
        });
        
        gravityLabel.appendChild(gravityText);
        gravityLabel.appendChild(gravityToggle);
        gravityDiv.appendChild(gravityLabel);
        container.appendChild(gravityDiv);
    }
    
    // Visual effects section
    const effectsTitle = document.createElement('h4');
    effectsTitle.textContent = 'Visual Effects';
    effectsTitle.style.margin = '20px 0 10px 0';
    effectsTitle.style.borderBottom = '1px solid #444';
    effectsTitle.style.paddingBottom = '5px';
    container.appendChild(effectsTitle);
    
    // Glow size slider
    const glowDiv = document.createElement('div');
    glowDiv.style.margin = '10px 0';
    
    const glowLabel = document.createElement('div');
    glowLabel.style.display = 'flex';
    glowLabel.style.justifyContent = 'space-between';
    glowLabel.style.marginBottom = '5px';
    
    const glowText = document.createElement('label');
    glowText.textContent = 'Glow Size:';
    glowText.htmlFor = 'glow-slider'; // Associate with slider
    
    const glowValue = document.createElement('span');
    glowValue.textContent = config.glow.size.toFixed(1);
    
    glowLabel.appendChild(glowText);
    glowLabel.appendChild(glowValue);
    glowDiv.appendChild(glowLabel);
    
    const glowSlider = document.createElement('input');
    glowSlider.type = 'range';
    glowSlider.id = 'glow-slider';
    glowSlider.name = 'glow-slider';
    glowSlider.min = '0';
    glowSlider.max = '3';
    glowSlider.step = '0.1';
    glowSlider.value = config.glow.size;
    glowSlider.style.width = '100%';
    glowSlider.style.accentColor = '#4CAF50';
    
    glowSlider.addEventListener('input', function() {
        const value = Number(this.value);
        config.glow.size = value;
        glowValue.textContent = value.toFixed(1);
        
        // Update the glow effect without recreating the entire particle system
        updateGlowEffect();
    });
    
    glowDiv.appendChild(glowSlider);
    container.appendChild(glowDiv);
    
    // Color scheme selector (single implementation)
    const colorSchemeDiv = document.createElement('div');
    colorSchemeDiv.style.margin = '10px 0';
    
    const colorSchemeLabel = document.createElement('label');
    colorSchemeLabel.textContent = 'Color Scheme: ';
    colorSchemeLabel.style.display = 'block';
    colorSchemeLabel.style.marginBottom = '5px';
    colorSchemeLabel.htmlFor = 'color-scheme-select'; // Associate with select
    colorSchemeDiv.appendChild(colorSchemeLabel);
    
    const colorSchemeSelect = document.createElement('select');
    colorSchemeSelect.id = 'color-scheme-select';
    colorSchemeSelect.name = 'color-scheme';
    colorSchemeSelect.style.width = '100%';
    colorSchemeSelect.style.padding = '5px';
    colorSchemeSelect.style.backgroundColor = '#222';
    colorSchemeSelect.style.color = '#fff';
    colorSchemeSelect.style.border = '1px solid #444';
    
    for (const scheme in config.colorSchemes) {
        const option = document.createElement('option');
        option.value = scheme;
        option.textContent = scheme.charAt(0).toUpperCase() + scheme.slice(1);
        if (scheme === config.colorScheme) {
            option.selected = true;
        }
        colorSchemeSelect.appendChild(option);
    }
    
    colorSchemeSelect.addEventListener('change', function() {
        config.colorScheme = this.value;
        if (config.mode === 'particle') {
            createParticleSystem();
        } else {
            createGalaxySystem();
        }
    });
    
    colorSchemeDiv.appendChild(colorSchemeSelect);
    container.appendChild(colorSchemeDiv);
    
    // Reset button
    const resetDiv = document.createElement('div');
    resetDiv.style.margin = '20px 0 10px 0';
    
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.id = 'reset-button';
    resetBtn.name = 'reset-button';
    resetBtn.style.width = '100%';
    resetBtn.style.padding = '10px';
    resetBtn.style.backgroundColor = '#d9534f';
    resetBtn.style.color = 'white';
    resetBtn.style.border = 'none';
    resetBtn.style.borderRadius = '4px';
    resetBtn.style.cursor = 'pointer';
    
    resetBtn.addEventListener('click', function() {
        // Reset to default settings based on current mode
        if (config.mode === 'particle') {
            // Reset particle settings
            config.particleCount = 1000;
            config.particleSize = 0.1;
            config.particleColor = 0xffffff;
            config.colorScheme = 'cosmic';
            config.speed = 0.01;
            config.rotationSpeed = 0.001;
            config.interactionStrength = 0.5;
            config.audioReactivity = 0.5;
            config.glow.size = 1.5;
            createParticleSystem(); // This will remove any black hole objects
        } else {
            // Reset galaxy settings
            config.galaxySettings.galaxyRadius = 25;
            config.galaxySettings.spiralArms = 3;
            config.galaxySettings.spiralTightness = 1.5;
            config.galaxySettings.rotationFactor = 0.5;
            config.galaxySettings.coreSize = 5;
            config.galaxySettings.coreConcentration = 2.0;
            config.galaxySettings.haloSize = 25;
            config.galaxySettings.haloParticleRatio = 0.2;
            config.galaxySettings.dustCloudCount = 5;
            config.galaxySettings.enableGravity = true;
            config.galaxySettings.blackHoleMass = 1000;
            config.galaxySettings.stabilityFactor = 0.98;
            config.colorScheme = 'cosmic';
            config.speed = 0.01;
            config.rotationSpeed = 0.001;
            config.interactionStrength = 0.5;
            config.audioReactivity = 0.5;
            config.glow.size = 1.5;
            createGalaxySystem(); // This will create new black hole objects
        }
        createControls(); // Refresh controls
    });
    
    resetDiv.appendChild(resetBtn);
    container.appendChild(resetDiv);
    
    // Add spaceship mode button
    const spaceshipButtonContainer = document.createElement('div');
    spaceshipButtonContainer.style.textAlign = 'center';
    spaceshipButtonContainer.style.margin = '15px 0';
    
    const spaceshipButton = document.createElement('button');
    spaceshipButton.textContent = isSpaceshipMode ? 'Exit Spaceship' : 'Enter Spaceship';
    spaceshipButton.style.backgroundColor = '#4CAF50';
    spaceshipButton.style.color = 'white';
    spaceshipButton.style.padding = '10px 15px';
    spaceshipButton.style.border = 'none';
    spaceshipButton.style.borderRadius = '5px';
    spaceshipButton.style.cursor = 'pointer';
    spaceshipButton.style.fontWeight = 'bold';
    spaceshipButton.style.fontSize = '16px';
    spaceshipButton.style.width = '100%';
    
    spaceshipButton.addEventListener('click', function() {
        toggleSpaceshipMode();
        this.textContent = isSpaceshipMode ? 'Exit Spaceship' : 'Enter Spaceship';
    });
    
    spaceshipButtonContainer.appendChild(spaceshipButton);
    container.appendChild(spaceshipButtonContainer);
    
    // Spaceship controls instructions
    if (isSpaceshipMode) {
        const instructionsDiv = document.createElement('div');
        instructionsDiv.style.marginTop = '10px';
        instructionsDiv.style.padding = '10px';
        instructionsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        instructionsDiv.style.borderRadius = '5px';
        instructionsDiv.style.fontSize = '12px';
        
        instructionsDiv.innerHTML = `
            <p><strong>Spaceship Controls:</strong></p>
            <p>W/S or Arrow Keys - Forward/Backward</p>
            <p>A/D or Arrow Keys - Strafe Left/Right</p>
            <p>Mouse - Look around</p>
            <p><strong>HOLD BOTH MOUSE BUTTONS</strong> - Control ship orientation</p>
            <p>Space - Fire laser</p>
        `;
        
        container.appendChild(instructionsDiv);
    }
    
    // Add container to panel
    controlsPanel.appendChild(container);
}

// Helper function to create sliders
function createSlider(labelText, initialValue, min, max, step, onChange) {
    const sliderDiv = document.createElement('div');
    sliderDiv.style.margin = '10px 0';
    
    // Create unique ID for the input
    const inputId = 'slider-' + labelText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    
    const sliderLabel = document.createElement('div');
    sliderLabel.style.display = 'flex';
    sliderLabel.style.justifyContent = 'space-between';
    sliderLabel.style.marginBottom = '5px';
    
    const text = document.createElement('label');
    text.textContent = labelText;
    text.htmlFor = inputId; // Associate label with input
    
    const value = document.createElement('span');
    value.textContent = typeof initialValue === 'number' ? 
        (initialValue < 0.01 ? initialValue.toFixed(4) : initialValue.toFixed(2)) : 
        initialValue;
    
    sliderLabel.appendChild(text);
    sliderLabel.appendChild(value);
    sliderDiv.appendChild(sliderLabel);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min.toString();
    slider.max = max.toString();
    slider.step = step.toString();
    slider.value = initialValue.toString();
    slider.style.width = '100%';
    slider.style.accentColor = '#4CAF50';
    slider.id = inputId; // Add ID
    slider.name = inputId; // Add name
    
    slider.addEventListener('input', function() {
        const val = this.value;
        const numVal = Number(val);
        
        // Update display value with appropriate precision
        if (numVal < 0.01) {
            value.textContent = numVal.toFixed(4);
        } else if (step < 0.1) {
            value.textContent = numVal.toFixed(2);
        } else {
            value.textContent = numVal.toFixed(1);
        }
        
        // Call the provided onChange handler
        onChange(val);
    });
    
    sliderDiv.appendChild(slider);
    return sliderDiv;
}

// Create point material with enhanced glow effect
function createGlowMaterial(baseSize) {
    const glowStrength = config.glow.size;
    
    // Calculate opacity based on glow size
    // Lower glow = more opaque, higher glow = more transparent to create diffusion effect
    const baseOpacity = 0.8;
    const opacity = Math.max(0.3, baseOpacity / Math.sqrt(glowStrength));
    
    return new THREE.PointsMaterial({
        size: baseSize * glowStrength,
        vertexColors: true,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
}

// Function to update glow effect on existing particle system
function updateGlowEffect() {
    if (!particleSystem) return;
    
    // Update the material with new glow settings
    const glowStrength = config.glow.size;
    const baseOpacity = 0.8;
    const opacity = Math.max(0.3, baseOpacity / Math.sqrt(glowStrength));
    
    // Update existing material
    particleSystem.material.size = config.particleSize * glowStrength;
    particleSystem.material.opacity = opacity;
    particleSystem.material.needsUpdate = true;
}

// Create galaxy particle types and properties
function createGalaxySystem() {
    // Clean up old particle system if it exists
    if (particleSystem) {
        scene.remove(particleSystem);
        particles.dispose();
    }

    const totalParticles = config.particleCount;
    const galaxySettings = config.galaxySettings;
    
    // Calculate particle type counts
    const coreStarCount = Math.floor(totalParticles * 0.1); // 10% core stars
    const armStarCount = Math.floor(totalParticles * 0.5);  // 50% spiral arm stars
    const haloStarCount = Math.floor(totalParticles * 0.2); // 20% halo stars
    const nebulaParticleCount = Math.floor(totalParticles * 0.1); // 10% nebula particles
    const dustParticleCount = totalParticles - coreStarCount - armStarCount - haloStarCount - nebulaParticleCount;

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);
    
    // Add additional attributes for physics
    const velocities = new Float32Array(totalParticles * 3);
    const accelerations = new Float32Array(totalParticles * 3);
    const particleTypes = new Float32Array(totalParticles);
    const masses = new Float32Array(totalParticles);
    
    // Initialize particles
    let currentIndex = 0;
    
    // 1. Create core stars
    currentIndex = createGalaxyCore(positions, colors, sizes, velocities, particleTypes, masses, currentIndex, coreStarCount);
    
    // 2. Create spiral arm stars
    currentIndex = createSpiralArms(positions, colors, sizes, velocities, particleTypes, masses, currentIndex, armStarCount);
    
    // 3. Create halo stars
    currentIndex = createHaloStars(positions, colors, sizes, velocities, particleTypes, masses, currentIndex, haloStarCount);
    
    // 4. Create nebula particles
    currentIndex = createNebulaClouds(positions, colors, sizes, velocities, particleTypes, masses, currentIndex, nebulaParticleCount);
    
    // 5. Create dust particles
    currentIndex = createDustParticles(positions, colors, sizes, velocities, particleTypes, masses, currentIndex, dustParticleCount);
    
    // Validate all data to prevent NaN values
    for (let i = 0; i < totalParticles; i++) {
        const i3 = i * 3;
        for (let j = 0; j < 3; j++) {
            // Check and fix position values
            if (isNaN(positions[i3 + j])) positions[i3 + j] = 0;
            
            // Check and fix velocity values
            if (isNaN(velocities[i3 + j])) velocities[i3 + j] = 0;
            
            // Check and fix acceleration values
            if (isNaN(accelerations[i3 + j])) accelerations[i3 + j] = 0;
            
            // Check and fix color values
            if (isNaN(colors[i3 + j])) colors[i3 + j] = 0.5;
        }
        
        // Check and fix other attributes
        if (isNaN(sizes[i])) sizes[i] = config.particleSize;
        if (isNaN(particleTypes[i])) particleTypes[i] = 0;
        if (isNaN(masses[i])) masses[i] = 1;
    }
    
    // Set geometry attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Custom attributes for physics
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('acceleration', new THREE.BufferAttribute(accelerations, 3));
    geometry.setAttribute('particleType', new THREE.BufferAttribute(particleTypes, 1));
    geometry.setAttribute('mass', new THREE.BufferAttribute(masses, 1));
    
    // Use the enhanced glow material
    const material = createGlowMaterial(config.particleSize);
    
    // Create particle system
    particleSystem = new THREE.Points(geometry, material);
    particles = geometry; // Store the geometry, not the attributes
    scene.add(particleSystem);
    
    // Create central black hole visualization
    createBlackHole();
    
    // Ensure subtle fog is maintained
    if (!scene.fog) {
        scene.fog = new THREE.FogExp2(config.backgroundColor, 0.00015);
    }
}

// Create galaxy core stars
function createGalaxyCore(positions, colors, sizes, velocities, particleTypes, masses, startIndex, count) {
    const galaxySettings = config.galaxySettings;
    const colorScheme = config.colorSchemes[config.colorScheme];
    
    for (let i = 0; i < count; i++) {
        const i3 = (startIndex + i) * 3;
        
        // Position - concentrated in center with gaussian-like distribution
        const radius = Math.pow(Math.random(), galaxySettings.coreConcentration) * galaxySettings.coreSize;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI - Math.PI/2; // Flatten somewhat along z-axis
        
        positions[i3] = radius * Math.cos(theta) * Math.cos(phi);
        positions[i3 + 1] = radius * Math.sin(phi) * 0.5; // Flattened along y-axis
        positions[i3 + 2] = radius * Math.sin(theta) * Math.cos(phi);
        
        // Colors - predominantly yellow/white for core (older stars)
        const coreColor = new THREE.Color(0xffffaa);
        colors[i3] = coreColor.r;
        colors[i3 + 1] = coreColor.g;
        colors[i3 + 2] = coreColor.b;
        
        // Sizes - relatively larger for core stars
        sizes[startIndex + i] = config.particleSize * (1.0 + Math.random() * 1.5);
        
        // Velocities - orbital motion
        const orbitalSpeed = Math.sqrt(galaxySettings.blackHoleMass / Math.max(0.1, radius));
        velocities[i3] = -Math.sin(theta) * orbitalSpeed;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.01; // Minor vertical motion
        velocities[i3 + 2] = Math.cos(theta) * orbitalSpeed;
        
        // Particle type: 0 = core star
        particleTypes[startIndex + i] = 0;
        
        // Mass: heavier than arm stars
        masses[startIndex + i] = 0.8 + Math.random() * 0.4;
    }
    
    return startIndex + count;
}

// Create spiral arm stars
function createSpiralArms(positions, colors, sizes, velocities, particleTypes, masses, startIndex, count) {
    const galaxySettings = config.galaxySettings;
    const colorScheme = config.colorSchemes[config.colorScheme];
    const arms = galaxySettings.spiralArms;
    
    for (let i = 0; i < count; i++) {
        const i3 = (startIndex + i) * 3;
        
        // Choose which arm this star belongs to
        const arm = Math.floor(Math.random() * arms);
        
        // Randomize radius, more stars toward outer edge of galaxy
        const radiusBase = galaxySettings.coreSize + Math.pow(Math.random(), 0.7) * (galaxySettings.galaxyRadius - galaxySettings.coreSize);
        const radiusFactor = 0.8 + Math.random() * 0.4; // Variation in arm width
        const radius = radiusBase * radiusFactor;
        
        // Calculate angle based on radius and arm
        const armOffset = (2 * Math.PI / arms) * arm;
        // Logarithmic spiral formula: r = a*e^(b*θ)
        // Working backwards, θ = ln(r/a)/b where b is the spiral tightness
        const b = galaxySettings.spiralTightness * 0.1;
        const rotationAmount = Math.log(radius / galaxySettings.coreSize) / b;
        const theta = armOffset + rotationAmount;
        
        // Add some random spread to the arm
        // Less spread near the core, more at edges for natural appearance
        const spreadFactor = 0.2 + 0.3 * (radius / galaxySettings.galaxyRadius);
        const spread = (Math.random() - 0.5) * spreadFactor;
        const finalTheta = theta + spread;
        
        // Height above/below plane, thinner at edges
        const heightFactor = 0.1 * (1 - radius / galaxySettings.galaxyRadius);
        const height = (Math.random() - 0.5) * heightFactor * galaxySettings.galaxyRadius;
        
        // Set position
        positions[i3] = radius * Math.cos(finalTheta);
        positions[i3 + 1] = height;
        positions[i3 + 2] = radius * Math.sin(finalTheta);
        
        // Colors - blue for young stars in arms, redder for older stars
        const starType = Math.random();
        let starColor;
        
        if (starType < 0.6) { // Most arm stars are blue/white
            starColor = new THREE.Color(0x8888ff);
        } else if (starType < 0.9) { // Some yellow
            starColor = new THREE.Color(0xffff88);
        } else { // Few red giants
            starColor = new THREE.Color(0xff8866);
        }
        
        colors[i3] = starColor.r;
        colors[i3 + 1] = starColor.g;
        colors[i3 + 2] = starColor.b;
        
        // Sizes vary based on star type
        sizes[startIndex + i] = config.particleSize * (0.6 + Math.random() * 0.8);
        
        // Calculate proper orbital velocity for stable circular orbit
        // v = sqrt(G*M/r) - tangential velocity
        const orbitalSpeed = Math.sqrt(galaxySettings.blackHoleMass / Math.max(0.1, radius)) * galaxySettings.rotationFactor;
        
        // The velocity should be perpendicular to the radius vector
        // In a clockwise orbit (looking down from +y), velocity is perpendicular to position
        velocities[i3] = -Math.sin(finalTheta) * orbitalSpeed;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.01; // Minor vertical motion
        velocities[i3 + 2] = Math.cos(finalTheta) * orbitalSpeed;
        
        // Add a small radial component to create some natural dynamics
        const radialVelocity = (Math.random() - 0.5) * 0.05 * orbitalSpeed;
        velocities[i3] += Math.cos(finalTheta) * radialVelocity;
        velocities[i3 + 2] += Math.sin(finalTheta) * radialVelocity;
        
        // Particle type: 1 = arm star
        particleTypes[startIndex + i] = 1;
        
        // Mass - regular stars
        masses[startIndex + i] = 0.4 + Math.random() * 0.3;
    }
    
    return startIndex + count;
}

// Create halo stars (spherical distribution around galaxy)
function createHaloStars(positions, colors, sizes, velocities, particleTypes, masses, startIndex, count) {
    const galaxySettings = config.galaxySettings;
    
    for (let i = 0; i < count; i++) {
        const i3 = (startIndex + i) * 3;
        
        // Position in spherical halo
        const radius = galaxySettings.coreSize + Math.pow(Math.random(), 0.5) * galaxySettings.haloSize;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1); // Full sphere
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
        
        // Colors - reddish/orange for halo stars (older)
        const haloColor = new THREE.Color(0xff7744);
        colors[i3] = haloColor.r;
        colors[i3 + 1] = haloColor.g;
        colors[i3 + 2] = haloColor.b;
        
        // Sizes - smaller for halo stars
        sizes[startIndex + i] = config.particleSize * (0.3 + Math.random() * 0.4);
        
        // Velocities - mostly radial orbits
        const orbitalSpeed = Math.sqrt(galaxySettings.blackHoleMass / Math.max(0.1, radius)) * 0.3;
        const randomFactor = Math.random() * Math.PI * 2;
        velocities[i3] = Math.sin(randomFactor) * orbitalSpeed;
        velocities[i3 + 1] = Math.cos(randomFactor) * orbitalSpeed;
        velocities[i3 + 2] = (Math.random() - 0.5) * orbitalSpeed;
        
        // Particle type: 2 = halo star
        particleTypes[startIndex + i] = 2;
        
        // Mass - lighter old stars
        masses[startIndex + i] = 0.2 + Math.random() * 0.2;
    }
    
    return startIndex + count;
}

// Create nebula particles
function createNebulaClouds(positions, colors, sizes, velocities, particleTypes, masses, startIndex, count) {
    const galaxySettings = config.galaxySettings;
    const nebulaCount = Math.min(10, Math.floor(count / 100)); // Create up to 10 nebulae
    const particlesPerNebula = Math.floor(count / nebulaCount);
    
    // Nebula centers - placed in the arms
    const nebulaCenters = [];
    const nebulaColors = [];
    const nebulaRadii = [];
    
    for (let n = 0; n < nebulaCount; n++) {
        // Choose an arm and position along it
        const arm = Math.floor(Math.random() * galaxySettings.spiralArms);
        const radiusBase = galaxySettings.coreSize * 1.5 + (galaxySettings.galaxyRadius - galaxySettings.coreSize) * 0.7 * Math.random();
        
        // Calculate angle based on radius and arm
        const armOffset = (2 * Math.PI / galaxySettings.spiralArms) * arm;
        const rotationAmount = galaxySettings.spiralTightness * Math.log(radiusBase / galaxySettings.coreSize);
        const theta = armOffset + rotationAmount;
        
        // Create nebula center
        const center = new THREE.Vector3(
            radiusBase * Math.cos(theta),
            (Math.random() - 0.5) * 1.0,
            radiusBase * Math.sin(theta)
        );
        
        nebulaCenters.push(center);
        
        // Nebula color - create different types
        const colorType = Math.random();
        let nebulaColor;
        
        if (colorType < 0.3) {
            // Red emission nebula
            nebulaColor = new THREE.Color(0xff2200);
        } else if (colorType < 0.6) {
            // Blue reflection nebula
            nebulaColor = new THREE.Color(0x4466ff);
        } else if (colorType < 0.8) {
            // Green/teal nebula
            nebulaColor = new THREE.Color(0x00ffaa);
        } else {
            // Purple nebula
            nebulaColor = new THREE.Color(0xaa22ff);
        }
        
        nebulaColors.push(nebulaColor);
        
        // Nebula radius - proportional to distance from center
        const nebulaRadius = 1.0 + Math.random() * 3.0;
        nebulaRadii.push(nebulaRadius);
    }
    
    // Create particles for each nebula
    for (let i = 0; i < count; i++) {
        const i3 = (startIndex + i) * 3;
        
        // Determine which nebula this particle belongs to
        const nebulaIndex = Math.floor(i / particlesPerNebula);
        if (nebulaIndex >= nebulaCount) continue; // Skip if we've used all nebulae
        
        const center = nebulaCenters[nebulaIndex];
        const nebulaColor = nebulaColors[nebulaIndex];
        const nebulaRadius = nebulaRadii[nebulaIndex];
        
        // Position - gaussian cloud around center
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * nebulaRadius,
            (Math.random() - 0.5) * nebulaRadius * 0.5, // Flatter in y
            (Math.random() - 0.5) * nebulaRadius
        );
        
        // Apply gaussian-like distribution
        const distanceFactor = Math.random();
        offset.multiplyScalar(distanceFactor * distanceFactor); // Concentrate in center
        
        positions[i3] = center.x + offset.x;
        positions[i3 + 1] = center.y + offset.y;
        positions[i3 + 2] = center.z + offset.z;
        
        // Colors - use nebula color with some variation
        const brightness = 0.7 + Math.random() * 0.3;
        colors[i3] = nebulaColor.r * brightness;
        colors[i3 + 1] = nebulaColor.g * brightness;
        colors[i3 + 2] = nebulaColor.b * brightness;
        
        // Sizes - larger for nebula particles
        sizes[startIndex + i] = config.particleSize * (1.0 + Math.random() * 2.0);
        
        // Velocities - follow galactic rotation but slower
        const radius = Math.sqrt(center.x * center.x + center.z * center.z);
        const theta = Math.atan2(center.z, center.x);
        const orbitalSpeed = Math.sqrt(galaxySettings.blackHoleMass / Math.max(0.1, radius)) * 0.7;
        
        velocities[i3] = -Math.sin(theta) * orbitalSpeed;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
        velocities[i3 + 2] = Math.cos(theta) * orbitalSpeed;
        
        // Particle type: 3 = nebula
        particleTypes[startIndex + i] = 3;
        
        // Mass - very light (gas)
        masses[startIndex + i] = 0.01 + Math.random() * 0.05;
    }
    
    return startIndex + count;
}

// Create dust particles
function createDustParticles(positions, colors, sizes, velocities, particleTypes, masses, startIndex, count) {
    const galaxySettings = config.galaxySettings;
    
    for (let i = 0; i < count; i++) {
        const i3 = (startIndex + i) * 3;
        
        // Position - concentrated in galactic plane
        const radius = galaxySettings.coreSize + Math.random() * (galaxySettings.galaxyRadius - galaxySettings.coreSize);
        const theta = Math.random() * Math.PI * 2;
        const height = (Math.random() - 0.5) * 0.5; // Very thin dust layer
        
        positions[i3] = radius * Math.cos(theta);
        positions[i3 + 1] = height;
        positions[i3 + 2] = radius * Math.sin(theta);
        
        // Colors - dark dust lanes
        const dustBrightness = 0.1 + Math.random() * 0.1;
        const dustColor = new THREE.Color(
            0.3 + Math.random() * 0.2, 
            0.2 + Math.random() * 0.1,
            0.1 + Math.random() * 0.1
        ).multiplyScalar(dustBrightness);
        
        colors[i3] = dustColor.r;
        colors[i3 + 1] = dustColor.g;
        colors[i3 + 2] = dustColor.b;
        
        // Sizes - vary for dust
        sizes[startIndex + i] = config.particleSize * (0.2 + Math.random() * 0.4);
        
        // Velocities - follow galactic rotation
        const orbitalSpeed = Math.sqrt(galaxySettings.blackHoleMass / Math.max(0.1, radius)) * 0.8;
        velocities[i3] = -Math.sin(theta) * orbitalSpeed;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.005; // Very little vertical motion
        velocities[i3 + 2] = Math.cos(theta) * orbitalSpeed;
        
        // Particle type: 4 = dust
        particleTypes[startIndex + i] = 4;
        
        // Mass - light dust particles
        masses[startIndex + i] = 0.05 + Math.random() * 0.1;
    }
    
    return startIndex + count;
}

// Create central black hole visualization
function createBlackHole() {
    // Black hole event horizon
    const blackHoleGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        transparent: true,
        opacity: 0.8
    });
    blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    scene.add(blackHole);
    
    // Accretion disk
    const diskGeometry = new THREE.RingGeometry(0.6, 2, 32);
    const diskMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffaa22, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
    });
    accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
    accretionDisk.rotation.x = Math.PI / 2; // Horizontal
    scene.add(accretionDisk);
}

function createSpaceship() {
    // Simple spaceship mesh
    const geometry = new THREE.ConeGeometry(0.5, 2, 8);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshPhongMaterial({
        color: 0x22aadd,
        emissive: 0x112244,
        shininess: 30,
        specular: 0x2233aa
    });
    
    spaceshipMesh = new THREE.Mesh(geometry, material);
    spaceshipMesh.visible = false; // Hide until spaceship mode is activated
    scene.add(spaceshipMesh);
    
    // Create cockpit elements
    createCockpit();
}

function createCockpit() {
    // Create cockpit container
    cockpitContainer = new THREE.Object3D();
    // Scale down the entire cockpit to be visually smaller
    cockpitContainer.scale.set(0.6, 0.6, 0.6);
    scene.add(cockpitContainer);
    
    // Add ambient cockpit lighting
    const cockpitAmbientLight = new THREE.AmbientLight(0x555566, 0.5);
    cockpitContainer.add(cockpitAmbientLight);
    
    // Add dashboard point light
    const dashboardLight = new THREE.PointLight(0x6688cc, 1.5, 3);
    dashboardLight.position.set(0, 0.3, -0.5);
    cockpitContainer.add(dashboardLight);
    
    // Add overhead instrument light (warm color)
    const overheadLight = new THREE.PointLight(0xffaa44, 1, 2);
    overheadLight.position.set(0, 1, -1);
    cockpitContainer.add(overheadLight);
    
    // Add side panel lights
    const leftPanelLight = new THREE.PointLight(0x88aaff, 0.8, 1.5);
    leftPanelLight.position.set(-1.2, -0.3, -0.7);
    cockpitContainer.add(leftPanelLight);
    
    const rightPanelLight = new THREE.PointLight(0x88aaff, 0.8, 1.5);
    rightPanelLight.position.set(1.2, -0.3, -0.7);
    cockpitContainer.add(rightPanelLight);
    
    // Add subtle floor lighting
    const floorLight = new THREE.PointLight(0x4466aa, 0.6, 2);
    floorLight.position.set(0, -0.8, -0.2);
    cockpitContainer.add(floorLight);
    
    // Create aircraft-style instrument panel - wider and flatter
    const dashboardGeometry = new THREE.BoxGeometry(3.4, 0.65, 0.8);
    dashboardGeometry.translate(0, 0, 0.1);
    const dashboardMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x222233,
        shininess: 60,
        specular: 0x555566
    });
    dashboard = new THREE.Mesh(dashboardGeometry, dashboardMaterial);
    dashboard.position.set(0, -0.85, -1.2);
    cockpitContainer.add(dashboard);
    
    // Add dashboard trim and details
    const trimGeometry = new THREE.BoxGeometry(3.5, 0.03, 0.85);
    const trimMaterial = new THREE.MeshPhongMaterial({
        color: 0x777788,
        shininess: 90,
        specular: 0xaaaaaa
    });
    const dashboardTrim = new THREE.Mesh(trimGeometry, trimMaterial);
    dashboardTrim.position.set(0, -0.55, -1.2);
    cockpitContainer.add(dashboardTrim);
    
    // Add overhead panel
    const overheadPanelGeometry = new THREE.BoxGeometry(1.2, 0.2, 0.4);
    const overheadPanel = new THREE.Mesh(overheadPanelGeometry, dashboardMaterial);
    overheadPanel.position.set(0, 1.2, -1.1);
    cockpitContainer.add(overheadPanel);
    
    // Overhead switches and buttons
    const overheadButtonsCount = 8;
    const overheadButtonColors = [0xff0000, 0xffff00, 0x00ff00, 0x00ffff];
    
    for (let i = 0; i < overheadButtonsCount; i++) {
        const switchGeometry = new THREE.BoxGeometry(0.08, 0.06, 0.06);
        const switchMaterial = new THREE.MeshPhongMaterial({
            color: overheadButtonColors[i % overheadButtonColors.length],
            shininess: 70,
            emissive: new THREE.Color(overheadButtonColors[i % overheadButtonColors.length]).multiplyScalar(0.2)
        });
        const switchMesh = new THREE.Mesh(switchGeometry, switchMaterial);
        switchMesh.position.set(-0.5 + i * 0.15, 1.15, -0.95);
        overheadPanel.add(switchMesh);
    }
    
    // Create realistic aircraft instrument arrangement
    // Center console with primary flight display
    const primaryDisplayGeometry = new THREE.PlaneGeometry(0.8, 0.6);
    const primaryDisplayMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000,
        emissive: 0x001133,
        shininess: 100
    });
    const primaryDisplay = new THREE.Mesh(primaryDisplayGeometry, primaryDisplayMaterial);
    primaryDisplay.position.set(0, -0.6, -0.85);
    primaryDisplay.rotation.x = -Math.PI * 0.25;
    cockpitContainer.add(primaryDisplay);
    
    // Add artificial horizon lines to primary display
    const horizonLineGeometry = new THREE.PlaneGeometry(0.7, 0.01);
    const horizonLineMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8
    });
    const horizonLine = new THREE.Mesh(horizonLineGeometry, horizonLineMaterial);
    horizonLine.position.z = 0.01;
    primaryDisplay.add(horizonLine);
    
    // Add attitude indicator
    const attitudeLineGeometry = new THREE.PlaneGeometry(0.2, 0.01);
    const attitudeLineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    const attitudeLine1 = new THREE.Mesh(attitudeLineGeometry, attitudeLineMaterial);
    attitudeLine1.position.set(-0.15, 0, 0.01);
    primaryDisplay.add(attitudeLine1);
    
    const attitudeLine2 = new THREE.Mesh(attitudeLineGeometry, attitudeLineMaterial);
    attitudeLine2.position.set(0.15, 0, 0.01);
    primaryDisplay.add(attitudeLine2);
    
    // Secondary displays - left side (navigation)
    const navDisplayGeometry = new THREE.PlaneGeometry(0.5, 0.4);
    const navDisplayMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000,
        emissive: 0x001122,
        shininess: 80
    });
    const navDisplay = new THREE.Mesh(navDisplayGeometry, navDisplayMaterial);
    navDisplay.position.set(-1.0, -0.6, -0.85);
    navDisplay.rotation.x = -Math.PI * 0.25;
    cockpitContainer.add(navDisplay);
    
    // Add circular radar sweep to nav display
    const radarCircleGeometry = new THREE.RingGeometry(0.05, 0.18, 32);
    const radarCircleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const radarCircle = new THREE.Mesh(radarCircleGeometry, radarCircleMaterial);
    radarCircle.position.z = 0.01;
    navDisplay.add(radarCircle);
    
    // Radar sweep line
    const radarSweepGeometry = new THREE.PlaneGeometry(0.18, 0.01);
    const radarSweepMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.7
    });
    const radarSweep = new THREE.Mesh(radarSweepGeometry, radarSweepMaterial);
    radarSweep.position.set(0.09, 0, 0.02);
    radarSweep.geometry.translate(0.09, 0, 0);
    radarCircle.add(radarSweep);
    
    // Secondary displays - right side (engine status)
    const engineDisplayGeometry = new THREE.PlaneGeometry(0.5, 0.4);
    const engineDisplayMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000,
        emissive: 0x110011,
        shininess: 80
    });
    const engineDisplay = new THREE.Mesh(engineDisplayGeometry, engineDisplayMaterial);
    engineDisplay.position.set(1.0, -0.6, -0.85);
    engineDisplay.rotation.x = -Math.PI * 0.25;
    cockpitContainer.add(engineDisplay);
    
    // Add engine gauges
    const gaugePositions = [
        { x: -0.15, y: 0.1 },
        { x: 0.15, y: 0.1 },
        { x: -0.15, y: -0.1 },
        { x: 0.15, y: -0.1 }
    ];
    
    const gaugeColors = [0xff0000, 0x00ff00, 0xffff00, 0x00ffff];
    
    gaugePositions.forEach((pos, i) => {
        const gaugeGeometry = new THREE.RingGeometry(0.05, 0.07, 16);
        const gaugeMaterial = new THREE.MeshBasicMaterial({
            color: gaugeColors[i],
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const gauge = new THREE.Mesh(gaugeGeometry, gaugeMaterial);
        gauge.position.set(pos.x, pos.y, 0.01);
        engineDisplay.add(gauge);
        
        // Gauge needle
        const needleGeometry = new THREE.PlaneGeometry(0.06, 0.01);
        const needleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: false
        });
        const needle = new THREE.Mesh(needleGeometry, needleMaterial);
        needle.position.set(0, 0, 0.01);
        needle.geometry.translate(0.03, 0, 0);
        needle.rotation.z = Math.PI * 0.25 * Math.random();
        gauge.add(needle);
    });
    
    // Physical control yoke (more realistic aircraft yoke)
    steeringWheel = new THREE.Object3D();
    
    // Yoke base/shaft
    const yokeBaseGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 16);
    const yokeMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        shininess: 70,
        specular: 0x777777
    });
    const yokeBase = new THREE.Mesh(yokeBaseGeometry, yokeMaterial);
    yokeBase.rotation.x = Math.PI / 2;
    yokeBase.position.y = 0.1;
    steeringWheel.add(yokeBase);
    
    // Yoke wheel (circular control wheel)
    const yokeWheelGeometry = new THREE.TorusGeometry(0.15, 0.025, 16, 32, Math.PI * 1.5);
    const yokeWheelMaterial = new THREE.MeshPhongMaterial({
        color: 0x222222,
        shininess: 60,
        specular: 0x555555
    });
    const yokeWheel = new THREE.Mesh(yokeWheelGeometry, yokeWheelMaterial);
    yokeWheel.position.set(0, 0.45, 0);
    yokeWheel.rotation.x = Math.PI / 2;
    steeringWheel.add(yokeWheel);
    
    // Add wheel center
    const wheelCenterGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16);
    const wheelCenter = new THREE.Mesh(wheelCenterGeometry, yokeMaterial);
    wheelCenter.position.set(0, 0.45, 0);
    wheelCenter.rotation.x = Math.PI / 2;
    steeringWheel.add(wheelCenter);
    
    // Add grips to the wheel
    const leftGripGeometry = new THREE.CylinderGeometry(0.028, 0.028, 0.08, 16);
    const gripMaterial = new THREE.MeshPhongMaterial({
        color: 0x111111,
        shininess: 50
    });
    
    const leftGrip = new THREE.Mesh(leftGripGeometry, gripMaterial);
    leftGrip.position.set(-0.15, 0.45, 0);
    leftGrip.rotation.z = Math.PI / 2;
    steeringWheel.add(leftGrip);
    
    const rightGrip = new THREE.Mesh(leftGripGeometry, gripMaterial);
    rightGrip.position.set(0.15, 0.45, 0);
    rightGrip.rotation.z = Math.PI / 2;
    steeringWheel.add(rightGrip);
    
    // Add red fire button on right grip
    const fireButtonGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.01, 16);
    const fireButtonMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        emissive: 0x330000,
        shininess: 80
    });
    const fireButton = new THREE.Mesh(fireButtonGeometry, fireButtonMaterial);
    fireButton.position.set(0.15, 0.45, 0.04);
    fireButton.rotation.x = Math.PI / 2;
    steeringWheel.add(fireButton);
    
    // Position the yoke
    steeringWheel.position.set(0, -0.8, -0.6);
    cockpitContainer.add(steeringWheel);
    
    // Create side panels with controls
    const leftPanelGeometry = new THREE.BoxGeometry(0.4, 0.7, 1.4);
    const panelMaterial = new THREE.MeshPhongMaterial({
        color: 0x222233,
        shininess: 40
    });
    const leftPanel = new THREE.Mesh(leftPanelGeometry, panelMaterial);
    leftPanel.position.set(-1.5, -0.6, -0.5);
    cockpitContainer.add(leftPanel);
    
    const rightPanelGeometry = new THREE.BoxGeometry(0.4, 0.7, 1.4);
    const rightPanel = new THREE.Mesh(rightPanelGeometry, panelMaterial);
    rightPanel.position.set(1.5, -0.6, -0.5);
    cockpitContainer.add(rightPanel);
    
    // Add throttle controls to left panel
    const throttleBaseGeometry = new THREE.BoxGeometry(0.25, 0.08, 0.2);
    const throttleBaseMaterial = new THREE.MeshPhongMaterial({
        color: 0x333344,
        shininess: 50
    });
    const throttleBase = new THREE.Mesh(throttleBaseGeometry, throttleBaseMaterial);
    throttleBase.position.set(-1.3, -0.5, -0.7);
    throttleBase.name = "throttleBase";
    cockpitContainer.add(throttleBase);
    
    // Create throttle levers (dual engine)
    for (let i = 0; i < 2; i++) {
        const throttleLeverGeometry = new THREE.BoxGeometry(0.05, 0.25, 0.04);
        const throttleLeverMaterial = new THREE.MeshPhongMaterial({
            color: 0xcc0000,
            shininess: 60
        });
        const throttleLever = new THREE.Mesh(throttleLeverGeometry, throttleLeverMaterial);
        throttleLever.position.set(-0.06 + i * 0.12, 0.17, 0);
        throttleLever.rotation.x = -Math.PI / 6;
        throttleLever.name = i === 0 ? "throttleLever" : "throttleLever2";
        throttleBase.add(throttleLever);
        
        // Add throttle knobs
        const throttleKnobGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 16);
        const throttleKnobMaterial = new THREE.MeshPhongMaterial({
            color: 0x111111,
            shininess: 80
        });
        const throttleKnob = new THREE.Mesh(throttleKnobGeometry, throttleKnobMaterial);
        throttleKnob.position.set(0, 0.15, 0);
        throttleKnob.rotation.x = Math.PI / 2;
        throttleKnob.name = i === 0 ? "throttleKnob" : "throttleKnob2";
        throttleLever.add(throttleKnob);
    }
    
    // Radio panel on right side
    const radioPanelGeometry = new THREE.BoxGeometry(0.25, 0.15, 0.25);
    const radioPanelMaterial = new THREE.MeshPhongMaterial({
        color: 0x111122,
        shininess: 50
    });
    const radioPanel = new THREE.Mesh(radioPanelGeometry, radioPanelMaterial);
    radioPanel.position.set(1.3, -0.3, -0.7);
    cockpitContainer.add(radioPanel);
    
    // Radio display
    const radioDisplayGeometry = new THREE.PlaneGeometry(0.2, 0.06);
    const radioDisplayMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8
    });
    const radioDisplay = new THREE.Mesh(radioDisplayGeometry, radioDisplayMaterial);
    radioDisplay.position.set(0, 0.04, 0.13);
    radioPanel.add(radioDisplay);
    
    // Radio knobs
    for (let i = 0; i < 2; i++) {
        const knobGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16);
        const knobMaterial = new THREE.MeshPhongMaterial({
            color: 0x777777,
            shininess: 80
        });
        const knob = new THREE.Mesh(knobGeometry, knobMaterial);
        knob.position.set(-0.07 + i * 0.14, -0.04, 0.13);
        knob.rotation.x = Math.PI / 2;
        radioPanel.add(knob);
    }
    
    // Add airplane-style rudder pedals
    const pedalGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.1);
    const pedalMaterial = new THREE.MeshPhongMaterial({
        color: 0x444444,
        shininess: 60
    });
    
    const leftPedal = new THREE.Mesh(pedalGeometry, pedalMaterial);
    leftPedal.position.set(-0.15, -1.18, -0.6);
    leftPedal.rotation.x = Math.PI / 6;
    cockpitContainer.add(leftPedal);
    
    const rightPedal = new THREE.Mesh(pedalGeometry, pedalMaterial);
    rightPedal.position.set(0.15, -1.18, -0.6);
    rightPedal.rotation.x = Math.PI / 6;
    cockpitContainer.add(rightPedal);
    
    // Create advanced windshield - with frame structure
    // Main windshield glass
    const windshieldGeometry = new THREE.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.5);
    const windshieldMaterial = new THREE.MeshPhongMaterial({
        color: 0x8899ff,
        transparent: true,
        opacity: 0.1,
        shininess: 100,
        specular: 0xffffff,
        side: THREE.DoubleSide
    });
    
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0, 0, -1);
    windshield.rotation.y = Math.PI;
    cockpitContainer.add(windshield);
    
    // Add windshield frame
    const frameRadius = 2.2;
    const frameWidth = 0.04;
    const frameMaterial = new THREE.MeshPhongMaterial({
        color: 0x444455,
        shininess: 60
    });
    
    // Central vertical frame
    const verticalFrameGeometry = new THREE.BoxGeometry(frameWidth, 0.9, frameWidth);
    const verticalFrame = new THREE.Mesh(verticalFrameGeometry, frameMaterial);
    verticalFrame.position.set(0, 0.7, -2.15);
    cockpitContainer.add(verticalFrame);
    
    // Horizontal frames
    const horizontalFrameGeometry = new THREE.BoxGeometry(2.0, frameWidth, frameWidth);
    const horizontalFrame = new THREE.Mesh(horizontalFrameGeometry, frameMaterial);
    horizontalFrame.position.set(0, 0.4, -2.15);
    cockpitContainer.add(horizontalFrame);
    
    // Angled frames
    const createAngledFrame = (xPos, yPos) => {
        const length = 0.8;
        const angleFrameGeometry = new THREE.BoxGeometry(length, frameWidth, frameWidth);
        const angleFrame = new THREE.Mesh(angleFrameGeometry, frameMaterial);
        angleFrame.position.set(xPos, yPos, -2.15);
        angleFrame.rotation.z = xPos > 0 ? Math.PI / 4 : -Math.PI / 4;
        cockpitContainer.add(angleFrame);
    };
    
    createAngledFrame(-0.7, 0.7);
    createAngledFrame(0.7, 0.7);
    
    // Add targeting reticle in the center of view
    const reticleSize = 0.025;
    const reticleGeometry = new THREE.RingGeometry(reticleSize, reticleSize + 0.008, 32);
    const reticleMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.position.set(0, 0, -2);
    cockpitContainer.add(reticle);
    
    // Add crosshair lines
    const lineGeometryH = new THREE.PlaneGeometry(reticleSize * 6, 0.002);
    const lineGeometryV = new THREE.PlaneGeometry(0.002, reticleSize * 6);
    const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    
    const lineH = new THREE.Mesh(lineGeometryH, lineMaterial);
    lineH.position.set(0, 0, -2);
    cockpitContainer.add(lineH);
    
    const lineV = new THREE.Mesh(lineGeometryV, lineMaterial);
    lineV.position.set(0, 0, -2);
    cockpitContainer.add(lineV);
    
    // Add small tick marks around reticle
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const distance = 0.06;
        
        const tickWidth = i % 2 === 0 ? 0.025 : 0.015;
        const tickGeometry = new THREE.PlaneGeometry(0.002, tickWidth);
        const tick = new THREE.Mesh(tickGeometry, lineMaterial);
        
        const x = Math.sin(angle) * distance;
        const y = Math.cos(angle) * distance;
        
        tick.position.set(x, y, -2);
        tick.rotation.z = angle;
        cockpitContainer.add(tick);
    }
    
    // Add cockpit floor
    const floorGeometry = new THREE.BoxGeometry(3.2, 0.05, 2);
    const floorMaterial = new THREE.MeshPhongMaterial({
        color: 0x222233,
        shininess: 30
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, -1.25, -0.2);
    cockpitContainer.add(floor);
    
    // Make cockpit initially invisible
    cockpitContainer.visible = false;
}

function createAliens() {
    // Clean up any existing aliens
    for (let alien of aliens) {
        scene.remove(alien);
        alien.geometry.dispose();
        alien.material.dispose();
    }
    aliens = [];
    
    // Create new aliens
    const alienCount = config.spaceship.alienCount;
    
    for (let i = 0; i < alienCount; i++) {
        // Create a simple alien shape
        const geometry = new THREE.SphereGeometry(0.5, 8, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0xff4400,
            emissive: 0x441100,
            shininess: 30
        });
        
        const alien = new THREE.Mesh(geometry, material);
        
        // Random position within a radius
        const radius = 30 + Math.random() * 70; // 30-100 units away
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        alien.position.x = radius * Math.sin(phi) * Math.cos(theta);
        alien.position.y = radius * Math.sin(phi) * Math.sin(theta);
        alien.position.z = radius * Math.cos(phi);
        
        // Add to scene and array
        scene.add(alien);
        aliens.push(alien);
    }
}

function createScoreDisplay() {
    // Create score display div
    scoreDisplay = document.createElement('div');
    scoreDisplay.style.position = 'absolute';
    scoreDisplay.style.top = '10px';
    scoreDisplay.style.left = '10px';
    scoreDisplay.style.color = '#ffffff';
    scoreDisplay.style.fontSize = '24px';
    scoreDisplay.style.fontFamily = 'Arial, sans-serif';
    scoreDisplay.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.7)';
    scoreDisplay.style.display = 'none';
    scoreDisplay.textContent = 'Score: 0';
    document.body.appendChild(scoreDisplay);
}

function updateScoreDisplay() {
    if (scoreDisplay) {
        scoreDisplay.textContent = `Score: ${score}`;
    }
}

function loadLaserSound() {
    // Create audio element for laser sound
    laserSound = new Audio();
    laserSound.src = 'data:audio/wav;base64,UklGRqRnAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YYBnAACBgIF/gn2Cf4GBgYSDhoOIhYmGiYmJi4uNjIyOjI+JkIuRjZKPk5GUk5WS'; // Base64 placeholder
    laserSound.volume = 0.4;
    laserSound.preload = 'auto';
}

function loadAlienSound() {
    // Create audio element for alien hit sound
    alienSound = new Audio();
    alienSound.src = 'data:audio/wav;base64,UklGRqRnAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YYBnAACBgIF/gn2Cf4GBgYSDhoOIhYmGiYmJi4uNjIyOjI+JkIuRjZKPk5GUk5WS'; // Base64 placeholder
    alienSound.volume = 0.5;
    alienSound.preload = 'auto';
}

function loadGameOverSound() {
    // Create audio element for game over sound
    gameOverSound = new Audio();
    gameOverSound.src = 'data:audio/wav;base64,UklGRqRnAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YYBnAACBgIF/gn2Cf4GBgYSDhoOIhYmGiYmJi4uNjIyOjI+JkIuRjZKPk5GUk5WS'; // Base64 placeholder
    gameOverSound.volume = 0.6;
    gameOverSound.preload = 'auto';
}

function shootLaser() {
    // Create laser beam with initial length
    const laserLength = 5; // Initial length
    const laserGeometry = new THREE.CylinderGeometry(0.05, 0.05, laserLength, 12);
    laserGeometry.rotateX(Math.PI / 2); // Make cylinder point forward
    const laserMaterial = new THREE.MeshPhongMaterial({
        color: 0xff2200,
        emissive: 0xff2200,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.9
    });
    const laser = new THREE.Mesh(laserGeometry, laserMaterial);
    
    // Add glow effect to laser
    const laserGlowGeometry = new THREE.CylinderGeometry(0.12, 0.12, laserLength, 12);
    laserGlowGeometry.rotateX(Math.PI / 2);
    const laserGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });
    const laserGlow = new THREE.Mesh(laserGlowGeometry, laserGlowMaterial);
    laser.add(laserGlow);
    
    // Add second outer glow for more visibility
    const outerGlowGeometry = new THREE.CylinderGeometry(0.2, 0.2, laserLength, 12);
    outerGlowGeometry.rotateX(Math.PI / 2);
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8800,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    laser.add(outerGlow);
    
    // Get camera position and direction
    camera.getWorldPosition(tempVector);
    camera.getWorldQuaternion(tempQuaternion);
    
    // Set laser direction
    tempDirection.set(0, 0, -1).applyQuaternion(tempQuaternion);
    
    // Position laser in front of the camera - offset from cockpit view
    const laserStartPos = tempVector.clone().addScaledVector(tempDirection, 2);
    
    laser.position.copy(laserStartPos);
    laser.quaternion.copy(tempQuaternion);
    
    // Create muzzle flash effect
    const flashGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xff7700,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.scale.set(1, 1, 0.5);
    flash.position.copy(laserStartPos);
    scene.add(flash);
    
    // Add a glowing ring for additional muzzle effect
    const ringGeometry = new THREE.RingGeometry(0.1, 0.35, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(laserStartPos);
    ring.lookAt(laserStartPos.clone().add(tempDirection));
    scene.add(ring);
    
    // Add trail particles for the laser
    const trailParticles = [];
    for (let i = 0; i < 5; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.06, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Position behind the laser at different offsets
        const offset = 0.2 + i * 0.1;
        particle.position.copy(laserStartPos.clone().addScaledVector(tempDirection, -offset));
        scene.add(particle);
        trailParticles.push(particle);
    }
    
    // Store data with the laser
    laser.userData = {
        startPosition: laserStartPos.clone(),
        direction: tempDirection.clone(),
        distanceTraveled: 0,
        creationTime: Date.now(),
        flash: flash,
        ring: ring,
        trailParticles: trailParticles,
        maxDistance: 500
    };
    
    scene.add(laser);
    lasers.push(laser);
    
    // Play laser sound
    if (laserSound) {
        laserSound.currentTime = 0;
        laserSound.play().catch(e => console.log("Couldn't play laser sound:", e));
    }
    
    // Remove flash effects after short time
    setTimeout(() => {
        scene.remove(flash);
        scene.remove(ring);
        trailParticles.forEach(particle => scene.remove(particle));
    }, 150);
}

function updateLasersAndAliens(deltaTime) {
    if (gameOver) return;
    
    // Update laser positions
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i];
        const laserData = laser.userData;
        
        // Update laser travel distance
        const travelSpeed = 70 * deltaTime; // Units per second - increased for better gameplay
        laserData.distanceTraveled += travelSpeed;
        
        // Check for collisions with aliens using raycaster
        raycaster.set(laserData.startPosition, laserData.direction);
        const intersects = raycaster.intersectObjects(aliens);
        
        let hitAlien = false;
        let hitDistance = laserData.maxDistance; // Maximum laser travel distance
        
        if (intersects.length > 0) {
            const closestHit = intersects[0];
            hitDistance = closestHit.distance;
            
            // Check if we've traveled far enough to hit the alien
            if (laserData.distanceTraveled >= hitDistance) {
                hitAlien = true;
                
                // Remove alien
                const hitAlienObj = closestHit.object;
                const alienIndex = aliens.indexOf(hitAlienObj);
                if (alienIndex !== -1) {
                    scene.remove(hitAlienObj);
                    aliens.splice(alienIndex, 1);
                    
                    // Play alien hit sound
                    if (alienSound) {
                        alienSound.currentTime = 0;
                        alienSound.play().catch(e => console.log("Couldn't play alien sound:", e));
                    }
                    
                    // Create explosion effect
                    createExplosionEffect(hitAlienObj.position);
                    
                    // Create new alien
                    setTimeout(createNewAlien, 2000);
                    
                    score += 10;
                    updateScoreDisplay();
                }
            }
        }
        
        // Update laser length based on travel distance or hit
        if (hitAlien || laserData.distanceTraveled > hitDistance) {
            // Create explosion at impact point if it hit something (but wasn't an alien)
            if (!hitAlien && laserData.distanceTraveled > hitDistance) {
                const impactPoint = laserData.startPosition.clone().addScaledVector(laserData.direction, hitDistance);
                createSmallImpactEffect(impactPoint);
            }
            
            // Remove laser if it hit something or traveled too far
            scene.remove(laser);
            lasers.splice(i, 1);
            
            // If there was trail particles still present, remove them
            if (laserData.trailParticles) {
                laserData.trailParticles.forEach(particle => scene.remove(particle));
            }
            
            // If there was a flash/ring effect still present, remove them
            if (laserData.flash) scene.remove(laserData.flash);
            if (laserData.ring) scene.remove(laserData.ring);
        } else {
            // Update laser position
            const newPos = laserData.startPosition.clone().addScaledVector(laserData.direction, laserData.distanceTraveled);
            laser.position.copy(newPos);
            
            // Update laser trail particles
            if (laserData.trailParticles) {
                for (let j = 0; j < laserData.trailParticles.length; j++) {
                    const particle = laserData.trailParticles[j];
                    if (particle) {
                        const offset = 0.2 + j * 0.1;
                        particle.position.copy(newPos.clone().addScaledVector(laserData.direction, -offset));
                        
                        // Fade out particles over time
                        const age = Date.now() - laserData.creationTime;
                        if (age > 200) {
                            const opacity = Math.max(0, 0.7 - (age - 200) / 300);
                            particle.material.opacity = opacity;
                        }
                    }
                }
            }
            
            // Update laser length if it's approaching a hit
            if (laserData.distanceTraveled < hitDistance && hitDistance < laserData.maxDistance) {
                // Calculate remaining distance to hit
                const remainingDistance = hitDistance - laserData.distanceTraveled;
                if (remainingDistance < 5) {
                    // Adjust laser length to end at hit point
                    const newLength = Math.max(0.1, remainingDistance);
                    laser.scale.z = newLength / 5; // 5 is our initial length
                    
                    // Also adjust the glow
                    if (laser.children.length > 0) {
                        laser.children.forEach(child => {
                            child.scale.z = newLength / 5;
                        });
                    }
                }
            }
            
            // Remove laser if it's been alive too long
            if (Date.now() - laserData.creationTime > 5000) {
                scene.remove(laser);
                lasers.splice(i, 1);
                
                // Remove trail particles
                if (laserData.trailParticles) {
                    laserData.trailParticles.forEach(particle => scene.remove(particle));
                }
            }
        }
    }
    
    // Move aliens toward player
    for (let i = 0; i < aliens.length; i++) {
        const alien = aliens[i];
        const alienPosition = alien.position.clone();
        const direction = new THREE.Vector3();
        
        // Direction to camera
        direction.subVectors(camera.position, alienPosition).normalize();
        
        // Move alien toward camera
        alien.position.addScaledVector(direction, alienSpeed * deltaTime);
        alien.lookAt(camera.position);
        
        // Rotate alien for visual effect
        alien.rotation.y += 1.0 * deltaTime;
        
        // Check if alien is too close to player
        if (alien.position.distanceTo(camera.position) < 2) {
            // Game over
            gameOver = true;
            
            // Play game over sound
            if (gameOverSound) {
                gameOverSound.currentTime = 0;
                gameOverSound.play().catch(e => console.log("Couldn't play game over sound:", e));
            }
            
            showGameOverScreen();
            break;
        }
    }
}

function createExplosionEffect(position) {
    // Create particles for explosion effect
    const particleCount = 20;
    const particles = [];
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xff5500 : 0xff0000,
                transparent: true,
                opacity: 0.8
            })
        );
        
        // Random position within a small sphere
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.2;
        particle.position.copy(position);
        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(Math.random() * 2 + 1),
            age: 0,
            maxAge: Math.random() * 500 + 500 // ms
        };
        
        scene.add(particle);
        particles.push(particle);
    }
    
    // Add a flash of light
    const light = new THREE.PointLight(0xff5500, 5, 5);
    light.position.copy(position);
    scene.add(light);
    
    // Animate the explosion
    const startTime = Date.now();
    function animateExplosion() {
        const elapsed = Date.now() - startTime;
        const lightFade = Math.max(0, 1 - elapsed / 300);
        
        light.intensity = 5 * lightFade;
        
        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            const data = particle.userData;
            data.age += 16; // Approx ms per frame at 60fps
            
            if (data.age >= data.maxAge) {
                scene.remove(particle);
                particles.splice(i, 1);
            } else {
                const lifeRatio = data.age / data.maxAge;
                particle.material.opacity = 0.8 * (1 - lifeRatio);
                particle.scale.set(1 + lifeRatio, 1 + lifeRatio, 1 + lifeRatio);
                particle.position.add(data.velocity.clone().multiplyScalar(0.05));
            }
        }
        
        if (elapsed > 1000 || particles.length === 0) {
            scene.remove(light);
            return;
        }
        
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}

function createSmallImpactEffect(position) {
    // Create a small impact effect for when lasers hit non-alien objects
    const particleCount = 8;
    const particles = [];
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0xff7700,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            })
        );
        
        particle.position.copy(position);
        particle.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(Math.random() + 0.5),
            age: 0,
            maxAge: Math.random() * 200 + 200 // ms
        };
        
        scene.add(particle);
        particles.push(particle);
    }
    
    // Add a flash of light
    const light = new THREE.PointLight(0xff5500, 3, 3);
    light.position.copy(position);
    scene.add(light);
    
    // Animate the impact
    const startTime = Date.now();
    function animateImpact() {
        const elapsed = Date.now() - startTime;
        const lightFade = Math.max(0, 1 - elapsed / 200);
        
        light.intensity = 3 * lightFade;
        
        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            const data = particle.userData;
            data.age += 16; // Approx ms per frame at 60fps
            
            if (data.age >= data.maxAge) {
                scene.remove(particle);
                particles.splice(i, 1);
            } else {
                const lifeRatio = data.age / data.maxAge;
                particle.material.opacity = 0.8 * (1 - lifeRatio);
                particle.scale.set(1 - lifeRatio, 1 - lifeRatio, 1 - lifeRatio);
                particle.position.add(data.velocity.clone().multiplyScalar(0.03));
            }
        }
        
        if (elapsed > 500 || particles.length === 0) {
            scene.remove(light);
            return;
        }
        
        requestAnimationFrame(animateImpact);
    }
    
    animateImpact();
}

function toggleSpaceshipMode() {
    isSpaceshipMode = !isSpaceshipMode;
    
    if (isSpaceshipMode) {
        // Enable spaceship mode
        controls.enabled = false;
        fpsControls.enabled = true;
        spaceshipMesh.visible = false; // Hide the external ship 
        cockpitContainer.visible = true; // Show cockpit
        scoreDisplay.style.display = 'block';
        
        // Reset mouse button states
        leftMouseDown = false;
        rightMouseDown = false;
        
        // Reset key states
        for (let key in keyStates) {
            keyStates[key] = false;
        }
        
        // Reset score
        score = 0;
        updateScoreDisplay();
        
        // Create new aliens if needed
        if (aliens.length === 0) {
            createAliens();
        }
        
        // Change camera position if needed
        camera.position.set(0, 0, 30);
        camera.lookAt(0, 0, 0);
        
        // Update instruction display with new controls
        updateControlInstructions();
        
    } else {
        // Disable spaceship mode
        fpsControls.enabled = false;
        controls.enabled = true;
        spaceshipMesh.visible = false;
        cockpitContainer.visible = false; // Hide cockpit
        scoreDisplay.style.display = 'none';
        
        // Clean up lasers
        for (let i = lasers.length - 1; i >= 0; i--) {
            const laser = lasers[i];
            scene.remove(laser);
            lasers.splice(i, 1);
        }
    }
}

// Add function to update the control instructions
function updateControlInstructions() {
    // Remove old instructions if they exist
    const oldInstructions = document.querySelector('.spaceship-instructions');
    if (oldInstructions) {
        oldInstructions.remove();
    }
    
    if (isSpaceshipMode) {
        const controlsPanel = document.getElementById('controls');
        const instructionsDiv = document.createElement('div');
        instructionsDiv.className = 'spaceship-instructions';
        instructionsDiv.style.marginTop = '10px';
        instructionsDiv.style.padding = '10px';
        instructionsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        instructionsDiv.style.borderRadius = '5px';
        instructionsDiv.style.fontSize = '12px';
        
        instructionsDiv.innerHTML = `
            <p><strong>Spaceship Controls:</strong></p>
            <p>W/S or Arrow Keys - Forward/Backward</p>
            <p>A/D or Arrow Keys - Strafe Left/Right</p>
            <p>Mouse - Look around</p>
            <p><strong>HOLD BOTH MOUSE BUTTONS</strong> - Control ship orientation</p>
            <p>Space - Fire laser</p>
        `;
        
        controlsPanel.appendChild(instructionsDiv);
    }
}

function createNewAlien() {
    // Only create if spaceship mode is active
    if (!isSpaceshipMode) return;
    
    // Create alien at random position
    const distance = 30 + Math.random() * 20;
    const angle = Math.random() * Math.PI * 2;
    
    // Position in a ring around the player, but not directly in front
    const x = Math.sin(angle) * distance;
    const y = (Math.random() - 0.5) * 10;
    const z = Math.cos(angle) * distance;
    
    const alienGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const alienMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ff00,
        emissive: 0x003300,
        shininess: 30 
    });
    const alien = new THREE.Mesh(alienGeometry, alienMaterial);
    alien.position.set(x, y, z);
    
    scene.add(alien);
    aliens.push(alien);
}

function onKeyDown(event) {
    // Prevent spacebar from scrolling the page when in spaceship mode
    if (isSpaceshipMode && event.code === 'Space') {
        event.preventDefault();
    }

    // Handle keypress events
    if (isSpaceshipMode) {
        // Spacebar to shoot laser in spaceship mode
        if (event.code === 'Space') {
            // Only shoot if the game is not over
            if (!gameOver) {
                // Add cooldown to prevent rapid-fire
                const now = Date.now();
                const lastShotTime = lastShotTimestamp || 0;
                const cooldown = 300; // milliseconds
                
                if (now - lastShotTime > cooldown) {
                    shootLaser();
                    lastShotTimestamp = now;
                    
                    // Add recoil effect to the control stick
                    if (steeringWheel) {
                        // Save original position
                        const originalRotationX = steeringWheel.rotation.x;
                        
                        // Apply recoil
                        steeringWheel.rotation.x += 0.1;
                        
                        // Return to original position
                        setTimeout(() => {
                            if (steeringWheel) {
                                steeringWheel.rotation.x = originalRotationX;
                            }
                        }, 100);
                    }
                }
            } else {
                // If game is over, pressing space restarts the game
                // Remove game over screen if it exists
                const gameOverScreen = document.querySelector('div[style*="position: absolute"][style*="zIndex: 1000"]');
                if (gameOverScreen) {
                    document.body.removeChild(gameOverScreen);
                }
                
                // Reset game state
                gameOver = false;
                score = 0;
                updateScoreDisplay();
                
                // Remove all existing aliens
                for (let i = aliens.length - 1; i >= 0; i--) {
                    scene.remove(aliens[i]);
                }
                aliens = [];
                
                // Create new aliens
                createAliens();
            }
        }
        
        // Arrow keys for additional steering control
        if (event.code === 'ArrowUp') {
            // Pitch down (look up)
            camera.rotation.x += 0.05;
            if (steeringWheel) {
                steeringWheel.rotation.x += 0.1;
            }
        }
        
        if (event.code === 'ArrowDown') {
            // Pitch up (look down)
            camera.rotation.x -= 0.05;
            if (steeringWheel) {
                steeringWheel.rotation.x -= 0.1;
            }
        }
        
        if (event.code === 'ArrowLeft') {
            // Roll left
            camera.rotation.z += 0.05;
            if (steeringWheel) {
                steeringWheel.rotation.z -= 0.1;
            }
        }
        
        if (event.code === 'ArrowRight') {
            // Roll right
            camera.rotation.z -= 0.05;
            if (steeringWheel) {
                steeringWheel.rotation.z += 0.1;
            }
        }
        
        // WASD keys for manual movement
        if (event.code === 'KeyW') {
            // Move forward
            const forwardVector = new THREE.Vector3(0, 0, -1);
            forwardVector.applyQuaternion(camera.quaternion);
            camera.position.addScaledVector(forwardVector, 1);
        }
        
        if (event.code === 'KeyS') {
            // Move backward
            const forwardVector = new THREE.Vector3(0, 0, -1);
            forwardVector.applyQuaternion(camera.quaternion);
            camera.position.addScaledVector(forwardVector, -1);
        }
        
        if (event.code === 'KeyA') {
            // Strafe left
            const rightVector = new THREE.Vector3(1, 0, 0);
            rightVector.applyQuaternion(camera.quaternion);
            camera.position.addScaledVector(rightVector, -1);
        }
        
        if (event.code === 'KeyD') {
            // Strafe right
            const rightVector = new THREE.Vector3(1, 0, 0);
            rightVector.applyQuaternion(camera.quaternion);
            camera.position.addScaledVector(rightVector, 1);
        }
        
        // Boost with Shift
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
            // Temporarily increase movement speed
            fpsControls.movementSpeed = config.spaceship.speed * 50;
            
            // Show boost effect in cockpit - flash throttle control
            if (cockpitContainer) {
                // Find the throttle lever in the cockpit
                cockpitContainer.traverse(function(child) {
                    if (child.name === 'throttleLever') {
                        // Save original color
                        const originalColor = child.material.color.clone();
                        const originalEmissive = child.material.emissive.clone();
                        
                        // Set boost color
                        child.material.color.setHex(0xff5500);
                        child.material.emissive.setHex(0x551100);
                        
                        // Return to original color
                        setTimeout(() => {
                            child.material.color.copy(originalColor);
                            child.material.emissive.copy(originalEmissive);
                        }, 300);
                    }
                });
            }
        }
    } 
}

// Add key up handler for boost end
function onKeyUp(event) {
    // Reset boost speed
    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && isSpaceshipMode) {
        fpsControls.movementSpeed = config.spaceship.speed * 30;
    }
}

function showGameOverScreen() {
    // Create game over screen overlay
    const gameOverDiv = document.createElement('div');
    gameOverDiv.style.position = 'absolute';
    gameOverDiv.style.top = '0';
    gameOverDiv.style.left = '0';
    gameOverDiv.style.width = '100%';
    gameOverDiv.style.height = '100%';
    gameOverDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    gameOverDiv.style.display = 'flex';
    gameOverDiv.style.flexDirection = 'column';
    gameOverDiv.style.justifyContent = 'center';
    gameOverDiv.style.alignItems = 'center';
    gameOverDiv.style.zIndex = '1000';
    
    // Game over text
    const gameOverText = document.createElement('h1');
    gameOverText.textContent = 'GAME OVER';
    gameOverText.style.color = '#ff0000';
    gameOverText.style.fontSize = '48px';
    gameOverText.style.marginBottom = '20px';
    gameOverText.style.fontFamily = 'Arial, sans-serif';
    gameOverText.style.textShadow = '0 0 10px #ff0000';
    
    // Score display
    const finalScore = document.createElement('h2');
    finalScore.textContent = `Final Score: ${score}`;
    finalScore.style.color = '#ffffff';
    finalScore.style.fontSize = '24px';
    finalScore.style.marginBottom = '30px';
    finalScore.style.fontFamily = 'Arial, sans-serif';
    
    // Restart button
    const restartButton = document.createElement('button');
    restartButton.textContent = 'Restart Game';
    restartButton.style.padding = '12px 24px';
    restartButton.style.fontSize = '18px';
    restartButton.style.backgroundColor = '#4CAF50';
    restartButton.style.color = 'white';
    restartButton.style.border = 'none';
    restartButton.style.borderRadius = '5px';
    restartButton.style.cursor = 'pointer';
    restartButton.style.marginBottom = '20px';
    
    restartButton.addEventListener('click', function() {
        // Reset game state
        gameOver = false;
        score = 0;
        updateScoreDisplay();
        
        // Remove all existing aliens
        for (let i = aliens.length - 1; i >= 0; i--) {
            scene.remove(aliens[i]);
        }
        aliens = [];
        
        // Create new aliens
        createAliens();
        
        // Remove game over screen
        document.body.removeChild(gameOverDiv);
    });
    
    // Exit button
    const exitButton = document.createElement('button');
    exitButton.textContent = 'Exit to Exploration Mode';
    exitButton.style.padding = '12px 24px';
    exitButton.style.fontSize = '18px';
    exitButton.style.backgroundColor = '#f44336';
    exitButton.style.color = 'white';
    exitButton.style.border = 'none';
    exitButton.style.borderRadius = '5px';
    exitButton.style.cursor = 'pointer';
    
    exitButton.addEventListener('click', function() {
        // Exit spaceship mode
        toggleSpaceshipMode();
        
        // Remove game over screen
        document.body.removeChild(gameOverDiv);
    });
    
    // Add elements to the overlay
    gameOverDiv.appendChild(gameOverText);
    gameOverDiv.appendChild(finalScore);
    gameOverDiv.appendChild(restartButton);
    gameOverDiv.appendChild(exitButton);
    document.body.appendChild(gameOverDiv);
}

// Add mouse event listeners for dual-button controls
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('mousemove', onMouseMove);

// Track mouse buttons state
let leftMouseDown = false;
let rightMouseDown = false;

function onMouseDown(event) {
    if (isSpaceshipMode) {
        if (event.button === 0) {
            leftMouseDown = true;
        } else if (event.button === 2) {
            rightMouseDown = true;
            // Prevent context menu when right-clicking in spaceship mode
            event.preventDefault();
        }
    }
}

function onMouseUp(event) {
    if (isSpaceshipMode) {
        if (event.button === 0) {
            leftMouseDown = false;
        } else if (event.button === 2) {
            rightMouseDown = false;
        }
    }
}

function onMouseMove(event) {
    if (isSpaceshipMode && leftMouseDown && rightMouseDown) {
        // Only control orientation when both mouse buttons are pressed
        // Calculate movement delta
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        // Adjust camera rotation based on mouse movement
        // This works together with the FPS controls
        const rotationSpeed = 0.002;
        camera.rotation.y -= movementX * rotationSpeed;
        
        // Limit vertical rotation to prevent flipping
        const currentPitch = camera.rotation.x + (movementY * rotationSpeed);
        const maxPitch = Math.PI / 3; // Limit to about 60 degrees up/down
        if (currentPitch < maxPitch && currentPitch > -maxPitch) {
            camera.rotation.x = currentPitch;
        }
        
        // Update the cockpit orientation to match the camera
        if (cockpitContainer) {
            cockpitContainer.quaternion.copy(camera.quaternion);
        }
    }
}

// Prevent context menu from appearing with right-click in spaceship mode
document.addEventListener('contextmenu', function(event) {
    if (isSpaceshipMode) {
        event.preventDefault();
    }
});

// Add key states tracking for smoother movement
const keyStates = {};

document.addEventListener('keydown', (event) => {
    keyStates[event.code] = true;
    // Still call the regular onKeyDown for other functionality
    onKeyDown(event);
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
    // Still call the regular onKeyUp for other functionality
    onKeyUp(event);
});
