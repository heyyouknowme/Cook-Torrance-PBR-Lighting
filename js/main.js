/**
 * Main Application Entry Point
 * 
 * Cook-Torrance WebGL Lighting Demo
 * Demonstrates physically-based rendering with:
 * - Cook-Torrance BRDF (GGX/Smith/Fresnel-Schlick)
 * - Multiple light types (point, directional, spot, area)
 * - Real-time material editing (roughness, metallic, albedo)
 * - Planar shadow projection
 * - Interactive orbit camera
 */

import { Camera } from './camera.js';
import { UIManager, TooltipManager } from './ui.js';
import { Renderer } from './renderer.js';
import { createCube, createSphere, createPlane, createLightSphere, createVAO } from './geometry.js';
import { vertexShader, fragmentShader, shadowFragmentShader, emissiveFragmentShader, createProgram } from './shaders.js';
import { vec3, mat4 } from './math.js';
import { intersectObject } from './intersection.js';
import { DebugVectorRenderer, debugVertexShader, debugFragmentShader } from './debug.js';

// ====================================
// Initialize WebGL
// ====================================
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    alert('WebGL2 is required for this demo.');
    throw new Error('WebGL2 not available');
}

// ====================================
// Create Shader Programs
// ====================================
const mainProgram = createProgram(gl, vertexShader, fragmentShader);
const shadowProgram = createProgram(gl, vertexShader, shadowFragmentShader);
const lightProgram = createProgram(gl, vertexShader, emissiveFragmentShader);
const debugProgram = createProgram(gl, debugVertexShader, debugFragmentShader);

// ====================================
// Initialize Modules
// ====================================
const camera = new Camera(canvas);
const uiManager = new UIManager();
const tooltipManager = new TooltipManager();
const renderer = new Renderer(gl, {
    main: mainProgram,
    shadow: shadowProgram,
    light: lightProgram
});
const debugRenderer = new DebugVectorRenderer(gl, debugProgram);

// Initialize UI controls
uiManager.initialize();

// ====================================
// Create Geometry
// ====================================
let geoSphere = createVAO(gl, createSphere());
let geoCube = createVAO(gl, createCube());
let geoPlane = createVAO(gl, createPlane());
let geoLightSphere = createVAO(gl, createLightSphere());

// Add model matrices to objects (identity = no transform, at origin)
geoSphere.modelMatrix = mat4.identity();
geoCube.modelMatrix = mat4.identity();
geoPlane.modelMatrix = mat4.identity();

// Track active object
let activeObject = geoSphere;

// Track hover state for debug vectors
let hoverInfo = null;

// Handle object type changes
uiManager.onObjectTypeChange = (type) => {
    activeObject = type === 'sphere' ? geoSphere : geoCube;
};

// ====================================
// Mouse Hover Handler (for vector tooltip)
// ====================================
canvas.addEventListener('mousemove', (e) => {
    const state = uiManager.getState();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Cast ray from mouse position
    const ray = camera.screenToWorldRay(x, y, canvas.clientWidth, canvas.clientHeight);
    
    // Test for intersection with current object
    const hit = intersectObject(ray.origin, ray.direction, state.objectType);
    
    if (hit) {
        // Calculate BRDF vectors
        const N = hit.normal;
        
        // Light direction depends on light type
        let L;
        if (state.lightType === 1) {
            // Directional light
            L = vec3.normalize(vec3.scale(state.lightDir, -1));
        } else {
            // Point/spot/area light
            L = vec3.normalize(vec3.sub(state.lightPos, hit.point));
        }
        
        // View direction (from hit point to camera)
        const V = vec3.normalize(vec3.sub(camera.position, hit.point));
        
        // Half vector (for specular)
        const H = vec3.normalize(vec3.add(V, L));
        
        // Dot products
        const NdotL = vec3.dot(N, L);
        const NdotH = vec3.dot(N, H);
        
        // Show tooltip with vector information
        tooltipManager.show({
            N, L, V, H,
            NdotL,
            NdotH
        }, x, y);
        
        // Save hover info for debug rendering
        hoverInfo = {
            point: hit.point,
            normal: hit.normal,
            vectors: { N, L, V, H }
        };
    } else {
        tooltipManager.hide();
        hoverInfo = null;
    }
});

// Hide tooltip when mouse leaves canvas
canvas.addEventListener('mouseleave', () => {
    tooltipManager.hide();
    hoverInfo = null;
});

// ====================================
// Resize Handler
// ====================================
function handleResize() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // Update canvas resolution if needed
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        renderer.resize(displayWidth, displayHeight);
    }
}

// ====================================
// Animation Loop
// ====================================
function render() {
    handleResize();
    
    // Update camera matrices
    const aspectRatio = canvas.width / canvas.height;
    camera.updateMatrices(aspectRatio);
    
    // Get current UI state
    const state = uiManager.getState();
    
    // Render scene
    renderer.render({
        camera,
        floor: geoPlane,
        object: activeObject,
        lightSphere: geoLightSphere
    }, state);
    
    // Render debug vectors if hovering
    if (hoverInfo) {
        debugRenderer.render(
            hoverInfo,
            hoverInfo.vectors,
            camera.viewMatrix,
            camera.projectionMatrix
        );
    }
    
    // Continue animation loop
    requestAnimationFrame(render);
}

// Start rendering
requestAnimationFrame(render);

// Handle window resize
window.addEventListener('resize', handleResize);
handleResize();

// ====================================
// Debug Helper (Auto-enabled)
// ====================================
window.__debugShadow = true;
console.log('%c[SHADOW DEBUG ENABLED]', 'color: green; font-weight: bold', 'Shadow calculations will be logged automatically');
console.log('To disable: window.__debugShadow = false');
