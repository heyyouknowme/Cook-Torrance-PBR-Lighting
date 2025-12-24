/**
 * Camera Controls Module
 * 
 * Provides orbit camera controls with mouse interaction:
 * - Left-click drag: Rotate camera around target
 * - Right-click drag: Pan camera position
 * - Mouse wheel: Zoom in/out
 */

import { vec3, mat4, degToRad, clamp } from './math.js';

/**
 * Camera state and control system
 */
export class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Camera parameters
        this.target = [0, 0, 0];    // Point camera orbits around
        this.distance = 3.0;         // Distance from target
        this.yaw = 0.6;              // Horizontal rotation (radians)
        this.pitch = 0.35;           // Vertical rotation (radians)
        this.pan = [0, 0, 0];        // Camera offset from target
        
        // Matrices (updated each frame)
        this.viewMatrix = mat4.identity();
        this.projectionMatrix = mat4.identity();
        this.viewProjInverse = mat4.identity();
        this.position = [0, 0, 0];   // Computed camera position
        
        // Mouse state
        this.isRotating = false;
        this.isPanning = false;
        this.lastMousePos = [0, 0];
        
        // Bind event handlers
        this.setupEventListeners();
    }
    
    /**
     * Setup mouse event listeners for camera control
     */
    setupEventListeners() {
        // Mouse down: start rotation or pan
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.isRotating = true;  // Left button
            if (e.button === 2) this.isPanning = true;    // Right button
            this.lastMousePos = [e.clientX, e.clientY];
        });
        
        // Mouse up: stop rotation/pan
        this.canvas.addEventListener('mouseup', () => {
            this.isRotating = false;
            this.isPanning = false;
        });
        
        // Mouse leave: stop all interactions
        this.canvas.addEventListener('mouseleave', () => {
            this.isRotating = false;
            this.isPanning = false;
        });
        
        // Prevent context menu on right-click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Mouse move: handle rotation and panning
        this.canvas.addEventListener('mousemove', (e) => {
            const dx = e.clientX - this.lastMousePos[0];
            const dy = e.clientY - this.lastMousePos[1];
            
            if (this.isRotating) {
                // Rotate camera around target
                this.yaw += dx * 0.005;  // Horizontal rotation
                // Clamp pitch to avoid flipping
                this.pitch = clamp(this.pitch + dy * 0.005, -1.2, 1.2);
            }
            
            if (this.isPanning) {
                // Pan camera parallel to view plane
                const panScale = 0.002 * this.distance;
                
                // Calculate right and up vectors in world space
                const right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
                const up = [0, 1, 0];
                
                // Update pan offset
                this.pan = vec3.add(
                    this.pan,
                    vec3.add(
                        vec3.scale(right, -dx * panScale),
                        vec3.scale(up, dy * panScale)
                    )
                );
            }
            
            this.lastMousePos = [e.clientX, e.clientY];
        });
        
        // Mouse wheel: zoom in/out
        this.canvas.addEventListener('wheel', (e) => {
            // Clamp distance to reasonable bounds
            this.distance = clamp(
                this.distance * (1 + e.deltaY * 0.001),
                1.2,  // Min distance
                12.0  // Max distance
            );
        });
    }
    
    /**
     * Update camera matrices based on current parameters
     * Call this every frame before rendering
     * 
     * @param {number} aspectRatio - Canvas width / height
     */
    updateMatrices(aspectRatio) {
        // Calculate camera position using spherical coordinates
        const x = Math.cos(this.pitch) * Math.sin(this.yaw) * this.distance;
        const y = Math.sin(this.pitch) * this.distance;
        const z = Math.cos(this.pitch) * Math.cos(this.yaw) * this.distance;
        
        // Apply pan offset
        this.position = vec3.add([x, y, z], this.pan);
        const centerWithPan = vec3.add(this.target, this.pan);
        
        // Build view matrix (world → camera space)
        this.viewMatrix = mat4.lookAt(
            this.position,
            centerWithPan,
            [0, 1, 0]  // Up vector
        );
        
        // Build projection matrix (camera → clip space)
        this.projectionMatrix = mat4.perspective(
            degToRad(50),  // 50° field of view
            aspectRatio,
            0.1,           // Near plane
            50             // Far plane
        );
        
        // Compute inverse for ray casting (screen → world)
        const viewProj = mat4.multiply(this.projectionMatrix, this.viewMatrix);
        this.viewProjInverse = mat4.invert(viewProj);
    }
    
    /**
     * Unproject a screen point to world space
     * Used for mouse picking and ray casting
     * 
     * @param {number} screenX - X coordinate on canvas
     * @param {number} screenY - Y coordinate on canvas
     * @param {number} canvasWidth - Canvas width in pixels
     * @param {number} canvasHeight - Canvas height in pixels
     * @returns {{origin: Array<number>, direction: Array<number>}} Ray in world space
     */
    screenToWorldRay(screenX, screenY, canvasWidth, canvasHeight) {
        // Convert screen coordinates to normalized device coordinates [-1, 1]
        const ndcX = (screenX / canvasWidth) * 2 - 1;
        const ndcY = (1 - screenY / canvasHeight) * 2 - 1;
        
        // Create points at near and far planes
        const near = [ndcX, ndcY, -1, 1];
        const far = [ndcX, ndcY, 1, 1];
        
        // Unproject function
        const unproject = (p) => {
            const worldPos = mat4.multiplyVec4(this.viewProjInverse, p);
            const w = 1 / worldPos[3]; // Perspective divide
            return [worldPos[0] * w, worldPos[1] * w, worldPos[2] * w];
        };
        
        const nearWorld = unproject(near);
        const farWorld = unproject(far);
        
        // Calculate ray direction
        const direction = vec3.normalize(vec3.sub(farWorld, nearWorld));
        
        return {
            origin: this.position,
            direction: direction
        };
    }
}
