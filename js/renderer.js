/**
 * Renderer Module
 * 
 * Handles all WebGL rendering operations including:
 * - Scene rendering with Cook-Torrance BRDF
 * - Planar shadow projection onto floor
 * - Uniform management and shader setup
 */

import { vec3, mat4, mat3 } from './math.js';
import { FLOOR_Y } from './geometry.js';

/**
 * WebGL Renderer for Cook-Torrance lighting
 */
export class Renderer {
    constructor(gl, programs) {
        this.gl = gl;
        this.programs = programs; // { main, shadow }
        
        // Enable depth testing for proper 3D rendering
        gl.enable(gl.DEPTH_TEST);
        
        // Set clear color (dark blue background)
        gl.clearColor(0.02, 0.02, 0.07, 1);
    }
    
    /**
     * Build shadow projection matrix
     * Projects vertices onto a plane (the floor at y = FLOOR_Y)
     * 
     * Formula: M_shadow = M - (L * P^T) / (P · L)
     * Where:
     * - L: Light position in homogeneous coordinates [x, y, z, w]
     *      w=1 for point lights, w=0 for directional lights
     * - P: Plane equation [a, b, c, d] where ax + by + cz + d = 0
     *      For plane y = FLOOR_Y: 0*x + 1*y + 0*z - FLOOR_Y = 0
     * 
     * @param {Array<number>} lightHomogeneous - Light position [x, y, z, w]
     * @param {Array<number>} planeEq - Plane equation [a, b, c, d]
     * @returns {Array<number>} 4x4 shadow projection matrix
     */
    buildShadowMatrix(lightHomogeneous, planeEq = [0, 1, 0, -(FLOOR_Y + 0.01)]) {
        const [lx, ly, lz, lw] = lightHomogeneous;
        const [a, b, c, d] = planeEq;
        
        // Compute dot product: plane · light
        const dot = a * lx + b * ly + c * lz + d * lw;
        
        // DEBUG: Check if light is on the plane (dot should not be zero)
        if (window.__debugShadow && Math.abs(dot) < 0.001) {
            console.warn('[SHADOW WARNING] Light is nearly parallel to floor plane!', { dot, lightHomogeneous });
        }
        
        // Column-major layout for WebGL
        // Formula: M = dot(P·L)*I - L⊗P (outer product)
        const m = new Float32Array(16);

        // Column 0
        m[0]  = dot - lx * a;
        m[1]  = -ly * a;
        m[2]  = -lz * a;
        m[3]  = -lw * a;

        // Column 1
        m[4]  = -lx * b;
        m[5]  = dot - ly * b;
        m[6]  = -lz * b;
        m[7]  = -lw * b;

        // Column 2
        m[8]  = -lx * c;
        m[9]  = -ly * c;
        m[10] = dot - lz * c;
        m[11] = -lw * c;

        // Column 3
        m[12] = -lx * d;
        m[13] = -ly * d;
        m[14] = -lz * d;
        m[15] = dot - lw * d;

        return m;
    }
    
    /**
     * Set common uniforms for rendering
     * Uploads matrices, material properties, and light parameters to shader
     * 
     * @param {WebGLProgram} program - Shader program to configure
     * @param {Object} params - Rendering parameters
     */
    setUniforms(program, params) {
        const { gl } = this;
        const {
            modelMatrix = mat4.identity(),
            viewMatrix,
            projMatrix,
            normalMatrix = mat3.identity(),
            shadowMatrix = mat4.identity(),
            useShadowMatrix = false,
            cameraPos,
            state,
            shadowBlend = 0.0,
            overrideAlbedo = null,
            overrideMetallic = null,
            overrideRoughness = null,
            overrideColor = null,
        } = params;
        
        gl.useProgram(program);
        
        // Get uniform location helper
        const loc = (name) => gl.getUniformLocation(program, name);
        
        // Transformation matrices
        gl.uniformMatrix4fv(loc('uModel'), false, modelMatrix);
        gl.uniformMatrix4fv(loc('uView'), false, viewMatrix);
        gl.uniformMatrix4fv(loc('uProj'), false, projMatrix);
        gl.uniformMatrix4fv(loc('uShadowMat'), false, shadowMatrix);
        gl.uniform1i(loc('uUseShadowMat'), useShadowMatrix ? 1 : 0);
        gl.uniformMatrix3fv(loc('uNormalMat'), false, normalMatrix);
        
        // Camera position (for view direction)
        if (loc('uCameraPos')) {
            gl.uniform3fv(loc('uCameraPos'), cameraPos);
        }
        
        // Material properties
        if (loc('uAlbedo')) {
            const albedo = overrideAlbedo || state.albedo;
            gl.uniform3fv(loc('uAlbedo'), albedo);
        }
        if (loc('uMetallic')) {
            const metallic = overrideMetallic !== null ? overrideMetallic : state.metallic;
            gl.uniform1f(loc('uMetallic'), metallic);
        }
        if (loc('uRoughness')) {
            const roughness = overrideRoughness !== null ? overrideRoughness : state.roughness;
            gl.uniform1f(loc('uRoughness'), roughness);
        }
        
        // Light properties
        if (loc('uLightType')) {
            gl.uniform1i(loc('uLightType'), state.lightType);
        }
        if (loc('uLightPos')) {
            gl.uniform3fv(loc('uLightPos'), state.lightPos);
        }
        if (loc('uLightDir')) {
            gl.uniform3fv(loc('uLightDir'), vec3.normalize(state.lightDir));
        }
        if (loc('uLightColor')) {
            gl.uniform3fv(loc('uLightColor'), state.lightColor);
        }
        if (loc('uLightIntensity')) {
            gl.uniform1f(loc('uLightIntensity'), state.lightIntensity);
        }
        if (loc('uSpotAngle')) {
            gl.uniform1f(loc('uSpotAngle'), state.spotAngle);
        }
        if (loc('uSpotSoftness')) {
            gl.uniform1f(loc('uSpotSoftness'), state.spotSoftness);
        }
        if (loc('uAreaSize')) {
            gl.uniform2fv(loc('uAreaSize'), state.areaSize);
        }
        if (loc('uShadowBlend')) {
            gl.uniform1f(loc('uShadowBlend'), shadowBlend);
        }
        if (loc('uColor') && overrideColor) {
            gl.uniform3fv(loc('uColor'), overrideColor);
        }
    }
    
    /**
     * Render complete scene
     * 
     * @param {Object} scene - Scene data containing geometry and camera
     * @param {Object} state - Application state (materials, lights, etc.)
     */
    render(scene, state) {
        const { gl, programs } = this;
        const { camera, floor, object } = scene;
        
        // Clear buffers
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Get camera matrices
        const viewMatrix = camera.viewMatrix;
        const projMatrix = camera.projectionMatrix;
        const cameraPos = camera.position;
        
        // Calculate normal matrix (inverse-transpose of model matrix)
        const normalMatrix = mat3.transpose(mat3.invert(mat3.fromMat4(mat4.identity())));
        
        // ====================================
        // 1. Render floor plane
        // ====================================
        gl.bindVertexArray(floor.vao);
        this.setUniforms(programs.main, {
            viewMatrix,
            projMatrix,
            normalMatrix,
            cameraPos,
            state,
            // Floor-specific material (dark, non-metallic, rough)
            overrideAlbedo: [0.2, 0.24, 0.27],
            overrideMetallic: 0.0,
            overrideRoughness: 0.85,
        });
        gl.drawElements(gl.TRIANGLES, floor.count, gl.UNSIGNED_SHORT, 0);
        
        // ====================================
        // 2. Render shadow (if enabled)
        // ====================================
        if (state.shadowEnabled) {
            // Determine light position for shadow calculation
            // Directional lights use direction as homogeneous coords with w=0
            // Point/spot/area lights use position with w=1
            const lightHomogeneous = state.lightType === 1
                ? [...vec3.normalize(vec3.scale(state.lightDir, -1)), 0]  // Directional: invert direction, w=0
                : [...state.lightPos, 1];                  // Point/spot/area: w=1
            
            const shadowMatrix = this.buildShadowMatrix(lightHomogeneous);
            
            // DEBUG: Log shadow calculation details
            if (window.__debugShadow) {
                console.log('[SHADOW DEBUG]', {
                    lightType: state.lightType,
                    lightPos: state.lightPos,
                    lightHomogeneous,
                    floorY: FLOOR_Y,
                    shadowMatrix: Array.from(shadowMatrix)
                });
            }
            
            // Render shadow using shadow program
            gl.useProgram(programs.shadow);
            gl.bindVertexArray(object.vao);
            
            // Get object's model matrix (use identity if not set)
            const objectModelMatrix = object.modelMatrix || mat4.identity();
            
            // Calculate shadow center (object position projected onto floor)
            const objPos = [objectModelMatrix[12], objectModelMatrix[13], objectModelMatrix[14]];
            const shadowCenter = [objPos[0], FLOOR_Y, objPos[2]];
            
            // Estimate shadow radius based on object bounds and light distance
            const objectRadius = 1.0; // Approximate radius of sphere/cube
            const lightHeight = state.lightType === 1 ? 10.0 : Math.abs(state.lightPos[1] - FLOOR_Y);
            const shadowRadius = objectRadius * (1.0 + (objectRadius / Math.max(0.1, lightHeight)));
            
            // Setup shadow rendering
            gl.uniformMatrix4fv(gl.getUniformLocation(programs.shadow, 'uModel'), false, objectModelMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(programs.shadow, 'uView'), false, viewMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(programs.shadow, 'uProj'), false, projMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(programs.shadow, 'uShadowMat'), false, shadowMatrix);
            gl.uniform1i(gl.getUniformLocation(programs.shadow, 'uUseShadowMat'), 1);
            gl.uniformMatrix3fv(gl.getUniformLocation(programs.shadow, 'uNormalMat'), false, normalMatrix);
            gl.uniform1f(gl.getUniformLocation(programs.shadow, 'uAlpha'), 0.5); // Shadow opacity
            gl.uniform3fv(gl.getUniformLocation(programs.shadow, 'uShadowCenter'), shadowCenter);
            gl.uniform1f(gl.getUniformLocation(programs.shadow, 'uShadowRadius'), shadowRadius);
            
            // Enable blending for semi-transparent shadow
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            // Use polygon offset to prevent z-fighting with floor
            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(1, 1);
            
            gl.drawElements(gl.TRIANGLES, object.count, gl.UNSIGNED_SHORT, 0);
            
            // Disable blending and polygon offset
            gl.disable(gl.POLYGON_OFFSET_FILL);
            gl.disable(gl.BLEND);
        }
        
        // ====================================
        // 3. Render main object
        // ====================================
        const objectModelMatrix = object.modelMatrix || mat4.identity();
        
        gl.bindVertexArray(object.vao);
        this.setUniforms(programs.main, {
            modelMatrix: objectModelMatrix,
            viewMatrix,
            projMatrix,
            normalMatrix,
            cameraPos,
            state,
        });
        gl.drawElements(gl.TRIANGLES, object.count, gl.UNSIGNED_SHORT, 0);
        
        // ====================================
        // 4. Render light source (if not directional)
        // ====================================
        if (state.lightType !== 1 && scene.lightSphere && programs.light) {
            // Create model matrix for light position
            const lightModelMatrix = [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                state.lightPos[0], state.lightPos[1], state.lightPos[2], 1
            ];
            
            gl.bindVertexArray(scene.lightSphere.vao);
            this.setUniforms(programs.light, {
                modelMatrix: lightModelMatrix,
                viewMatrix,
                projMatrix,
                normalMatrix,
                cameraPos,
                state,
                overrideColor: [1.0, 1.0, 1.0]
            });
            gl.drawElements(gl.TRIANGLES, scene.lightSphere.count, gl.UNSIGNED_SHORT, 0);
        }
    }
    
    /**
     * Resize viewport to match canvas size
     * Call this when canvas dimensions change
     * 
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.gl.viewport(0, 0, width, height);
    }
}
