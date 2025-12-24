// Cook-Torrance BRDF Demo - Main Application
import { initWebGL, createShaderProgram, createBuffer, setupAttribute, resizeCanvasToDisplaySize } from './webgl-utils.js';
import { 
    createIdentityMatrix, 
    createPerspectiveMatrix, 
    createLookAtMatrix, 
    multiplyMatrices,
    createRotationXMatrix,
    createRotationYMatrix,
    createTranslationMatrix,
    createScaleMatrix,
    createOrthographicMatrix,
    invertMatrix,
    transposeMatrix,
    degToRad
} from './matrix.js';
import { createSphere, createCube, createTorus, createPlane } from './geometry.js';
import { vertexShaderSource, fragmentShaderSource, previewVertexShader, previewFragmentShader, shadowVertexShader, shadowFragmentShader } from './shaders.js';
import { UIController, hexToRgb } from './controls.js';

class CookTorranceApp {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.previewCanvas = document.getElementById('previewCanvas');
        
        this.gl = initWebGL(this.canvas);
        if (!this.gl) {
            console.error('Failed to initialize WebGL');
            return;
        }
        
        // Preview GL context
        this.previewGL = this.previewCanvas ? initWebGL(this.previewCanvas) : null;
        
        this.program = createShaderProgram(this.gl, vertexShaderSource, fragmentShaderSource);
        if (!this.program) {
            console.error('Failed to create shader program');
            return;
        }
        
        // Preview shader
        if (this.previewGL) {
            this.previewProgram = createShaderProgram(this.previewGL, previewVertexShader, previewFragmentShader);
        }
        
        // Shadow shader
        this.shadowProgram = createShaderProgram(this.gl, shadowVertexShader, shadowFragmentShader);
        if (!this.shadowProgram) {
            console.error('Failed to create shadow shader program');
        }
        this.shadowUniformLocations = {};
        if (this.shadowProgram) {
            this.getShadowUniformLocations();
        }
        
        this.uniformLocations = {};
        this.getUniformLocations();
        
        if (this.previewGL && this.previewProgram) {
            this.previewUniformLocations = {};
            this.getPreviewUniformLocations();
        }
        
        this.geometry = null;
        this.buffers = {};
        this.previewBuffers = {};
        this.floorBuffers = {};
        
        // Shadow map settings
        this.shadowMapSize = 2048;
        this.shadowFramebuffer = null;
        this.shadowTexture = null;
        
        this.cameraPosition = [0, 0, 4];
        this.cameraTarget = [0, 0, 0];
        this.cameraUp = [0, 1, 0];
        
        this.rotationX = 0;
        this.rotationY = 0;
        this.baseLightPosition = [2.0, 2.0, 2.0];
        
        this.lastTime = 0;
        this.animating = true;
        
        this.params = {
            roughness: 0.3,
            metallic: 0.5,
            albedo: [1.0, 0.42, 0.42],
            lightType: 0,
            lightColor: [1.0, 1.0, 1.0],
            lightIntensity: 3.0,
            lightPosition: [2.0, 2.0, 2.0],
            lightDirection: [-1.0, -1.0, -1.0],
            spotAngle: 0.5,
            spotSoftness: 0.1,
            areaSize: [1.0, 1.0],
            autoRotate: true,
            shadowEnabled: true,
            shadowBias: 0.005
        };
        
        this.initShadowMap();
        this.initScene();
        this.initPreviewScene();
        this.initUI();
        this.initMouseControls();
        this.initHoverTooltip();
        
        // Trigger initial parameter sync
        this.onParamsChange(this.uiController.getParams());
        
        this.animate();
    }
    
    getUniformLocations() {
        const gl = this.gl;
        const program = this.program;
        
        const uniformNames = [
            'uModelMatrix', 'uViewMatrix', 'uProjectionMatrix', 'uNormalMatrix',
            'uLightSpaceMatrix',
            'uAlbedo', 'uRoughness', 'uMetallic',
            'uLightType', 'uLightPosition', 'uLightDirection', 'uLightColor', 
            'uLightIntensity', 'uSpotAngle', 'uSpotSoftness', 'uAreaSize',
            'uCameraPosition',
            'uShadowMap', 'uShadowEnabled', 'uShadowBias'
        ];
        
        uniformNames.forEach(name => {
            this.uniformLocations[name] = gl.getUniformLocation(program, name);
        });
    }
    
    getShadowUniformLocations() {
        const gl = this.gl;
        const program = this.shadowProgram;
        
        ['uModelMatrix', 'uLightSpaceMatrix'].forEach(name => {
            this.shadowUniformLocations[name] = gl.getUniformLocation(program, name);
        });
    }
    
    getPreviewUniformLocations() {
        const gl = this.previewGL;
        const program = this.previewProgram;
        
        ['uModelMatrix', 'uViewMatrix', 'uProjectionMatrix', 'uColor', 'uEmissive'].forEach(name => {
            this.previewUniformLocations[name] = gl.getUniformLocation(program, name);
        });
    }
    
    initShadowMap() {
        const gl = this.gl;
        const size = this.shadowMapSize;
        
        // Create depth texture
        this.shadowTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Create framebuffer
        this.shadowFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTexture, 0);
        
        // Check framebuffer status
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Shadow framebuffer not complete:', status);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    initScene() {
        this.setGeometry('sphere');
        this.initFloor();
        
        const gl = this.gl;
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.clearColor(0.05, 0.05, 0.1, 1.0);
    }
    
    initFloor() {
        const gl = this.gl;
        const floor = createPlane(8, 8);
        this.floorBuffers.position = createBuffer(gl, floor.positions, gl.ARRAY_BUFFER);
        this.floorBuffers.normal = createBuffer(gl, floor.normals, gl.ARRAY_BUFFER);
        this.floorBuffers.index = createBuffer(gl, floor.indices, gl.ELEMENT_ARRAY_BUFFER);
        this.floorBuffers.indexCount = floor.indices.length;
    }
    
    initPreviewScene() {
        if (!this.previewGL) return;
        
        const gl = this.previewGL;
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.clearColor(0.03, 0.03, 0.06, 1.0);
        
        // Create small sphere for object
        const objGeom = createSphere(0.3, 16, 16);
        this.previewBuffers.objPosition = createBuffer(gl, objGeom.positions, gl.ARRAY_BUFFER);
        this.previewBuffers.objNormal = createBuffer(gl, objGeom.normals, gl.ARRAY_BUFFER);
        this.previewBuffers.objIndex = createBuffer(gl, objGeom.indices, gl.ELEMENT_ARRAY_BUFFER);
        this.previewBuffers.objIndexCount = objGeom.indices.length;
        
        // Create small sphere for light
        const lightGeom = createSphere(0.08, 8, 8);
        this.previewBuffers.lightPosition = createBuffer(gl, lightGeom.positions, gl.ARRAY_BUFFER);
        this.previewBuffers.lightNormal = createBuffer(gl, lightGeom.normals, gl.ARRAY_BUFFER);
        this.previewBuffers.lightIndex = createBuffer(gl, lightGeom.indices, gl.ELEMENT_ARRAY_BUFFER);
        this.previewBuffers.lightIndexCount = lightGeom.indices.length;
    }
    
    setGeometry(type) {
        const gl = this.gl;
        
        switch (type) {
            case 'cube':
                this.geometry = createCube(1.2);
                break;
            case 'torus':
                this.geometry = createTorus(0.6, 0.25, 48, 32);
                break;
            case 'sphere':
            default:
                this.geometry = createSphere(1, 48, 48);
                break;
        }
        
        this.buffers.position = createBuffer(gl, this.geometry.positions, gl.ARRAY_BUFFER);
        this.buffers.normal = createBuffer(gl, this.geometry.normals, gl.ARRAY_BUFFER);
        this.buffers.index = createBuffer(gl, this.geometry.indices, gl.ELEMENT_ARRAY_BUFFER);
        this.indexCount = this.geometry.indices.length;
    }
    
    initUI() {
        this.uiController = new UIController(
            (params) => this.onParamsChange(params),
            (objectType) => this.setGeometry(objectType)
        );
    }
    
    onParamsChange(params) {
        this.params.roughness = params.roughness;
        this.params.metallic = params.metallic;
        this.params.albedo = hexToRgb(params.albedo);
        
        this.params.lightType = params.lightType;
        this.params.lightColor = hexToRgb(params.lightColor);
        this.params.lightIntensity = params.lightIntensity;
        this.baseLightPosition = [params.lightX, params.lightY, params.lightZ];
        
        // Light direction for directional/spot lights
        const lp = this.baseLightPosition;
        this.params.lightDirection = [-lp[0], -lp[1], -lp[2]];
        
        // Spot light params
        this.params.spotAngle = params.spotAngle || 0.5;
        this.params.spotSoftness = params.spotSoftness || 0.1;
        
        // Area light params
        this.params.areaSize = [params.areaWidth || 1.0, params.areaHeight || 1.0];
        
        this.params.autoRotate = params.autoRotate;
        this.params.shadowEnabled = params.shadowEnabled !== undefined ? params.shadowEnabled : true;
    }
    
    initMouseControls() {
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;
        
        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });
        
        this.canvas.addEventListener('mouseup', () => { isDragging = false; });
        this.canvas.addEventListener('mouseleave', () => { isDragging = false; });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;
            
            this.rotationY += deltaX * 0.01;
            this.rotationX += deltaY * 0.01;
            
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });
    }
    
    initHoverTooltip() {
        const tooltip = document.getElementById('vectorTooltip');
        if (!tooltip) return;
        
        const showTooltip = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = ((clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((clientY - rect.top) / rect.height) * 2 + 1;
            
            // Proper ray-sphere intersection from camera
            const aspect = this.canvas.width / this.canvas.height;
            const fov = degToRad(45);
            const tanHalfFov = Math.tan(fov / 2);
            
            // Ray direction in view space
            const rayDir = this.normalize([
                x * aspect * tanHalfFov,
                y * tanHalfFov,
                -1
            ]);
            
            // Ray origin is camera position
            const rayOrigin = this.cameraPosition;
            const sphereCenter = [0, 0, 0];
            const sphereRadius = 1.0;
            
            // Ray-sphere intersection: solve ||rayOrigin + t*rayDir - sphereCenter||^2 = radius^2
            const oc = this.subtract(rayOrigin, sphereCenter);
            const a = this.dot(rayDir, rayDir);
            const b = 2.0 * this.dot(oc, rayDir);
            const c = this.dot(oc, oc) - sphereRadius * sphereRadius;
            const discriminant = b * b - 4 * a * c;
            
            if (discriminant >= 0) {
                // Hit the sphere - find the closest intersection point
                const t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
                
                if (t > 0) {
                    // Calculate surface point
                    const surfacePoint = [
                        rayOrigin[0] + t * rayDir[0],
                        rayOrigin[1] + t * rayDir[1],
                        rayOrigin[2] + t * rayDir[2]
                    ];
                    
                    // For sphere centered at origin, normal = surfacePoint (already normalized by sphere equation)
                    const N = this.normalize(surfacePoint);
                    const L = this.normalize(this.subtract(this.params.lightPosition, surfacePoint));
                    const V = this.normalize(this.subtract(this.cameraPosition, surfacePoint));
                    const H = this.normalize(this.add(V, L));
                    
                    const NdotL = Math.max(0, this.dot(N, L));
                    const NdotH = Math.max(0, this.dot(N, H));
                    
                    document.getElementById('vecN').textContent = this.formatVec(N);
                    document.getElementById('vecL').textContent = this.formatVec(L);
                    document.getElementById('vecV').textContent = this.formatVec(V);
                    document.getElementById('vecH').textContent = this.formatVec(H);
                    document.getElementById('vecNdotL').textContent = NdotL.toFixed(3);
                    document.getElementById('vecNdotH').textContent = NdotH.toFixed(3);
                    
                    tooltip.style.display = 'block';
                    tooltip.style.left = (clientX - rect.left + 15) + 'px';
                    tooltip.style.top = (clientY - rect.top + 15) + 'px';
                    return true;
                }
            }
            
            tooltip.style.display = 'none';
            return false;
        };
        
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            showTooltip(e.clientX, e.clientY);
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
        
        // Touch events for mobile/tablet
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                e.preventDefault();
                showTooltip(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                e.preventDefault();
                showTooltip(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', () => {
            tooltip.style.display = 'none';
        });
    }
    
    // Vector utilities
    normalize(v) {
        const len = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
        return len > 0 ? v.map(x => x / len) : [0, 0, 0];
    }
    subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
    formatVec(v) { return `(${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)})`; }
    
    // Rotate light position with object
    getRotatedLightPosition() {
        const [x, y, z] = this.baseLightPosition;
        
        // Apply Y rotation
        const cosY = Math.cos(this.rotationY);
        const sinY = Math.sin(this.rotationY);
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        
        // Apply X rotation
        const cosX = Math.cos(this.rotationX);
        const sinX = Math.sin(this.rotationX);
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        
        return [x1, y1, z2];
    }
    
    animate(currentTime = 0) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        if (this.params.autoRotate) {
            this.rotationY += deltaTime * 0.5;
        }
        
        // Update light position with rotation
        this.params.lightPosition = this.getRotatedLightPosition();
        this.params.lightDirection = this.params.lightPosition.map(v => -v);
        
        this.renderShadowMap();
        this.render();
        this.renderPreview();
        
        requestAnimationFrame((time) => this.animate(time));
    }
    
    getLightSpaceMatrix() {
        const lp = this.params.lightPosition;
        const lightDir = this.normalize(lp.map(v => -v));
        
        // Light view matrix - looking at origin from light position
        const lightView = createLookAtMatrix(
            [lp[0] * 2, lp[1] * 2, lp[2] * 2],
            [0, 0, 0],
            [0, 1, 0]
        );
        
        // Orthographic projection for shadow map
        const lightProj = createOrthographicMatrix(-5, 5, -5, 5, 0.1, 20);
        
        return multiplyMatrices(lightProj, lightView);
    }
    
    renderShadowMap() {
        if (!this.shadowProgram || !this.shadowFramebuffer) return;
        
        const gl = this.gl;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(this.shadowProgram);
        
        const lightSpaceMatrix = this.getLightSpaceMatrix();
        gl.uniformMatrix4fv(this.shadowUniformLocations.uLightSpaceMatrix, false, lightSpaceMatrix);
        
        // Render main object to shadow map
        const rotX = createRotationXMatrix(this.rotationX);
        const rotY = createRotationYMatrix(this.rotationY);
        const modelMatrix = multiplyMatrices(rotY, rotX);
        
        gl.uniformMatrix4fv(this.shadowUniformLocations.uModelMatrix, false, modelMatrix);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        setupAttribute(gl, this.shadowProgram, 'aPosition', 3);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    render() {
        const gl = this.gl;
        
        resizeCanvasToDisplaySize(this.canvas);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(this.program);
        
        const aspect = this.canvas.width / this.canvas.height;
        const projectionMatrix = createPerspectiveMatrix(degToRad(45), aspect, 0.1, 100);
        const viewMatrix = createLookAtMatrix(this.cameraPosition, this.cameraTarget, this.cameraUp);
        const lightSpaceMatrix = this.getLightSpaceMatrix();
        
        // Bind shadow map
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
        gl.uniform1i(this.uniformLocations.uShadowMap, 0);
        gl.uniform1i(this.uniformLocations.uShadowEnabled, this.params.shadowEnabled ? 1 : 0);
        gl.uniform1f(this.uniformLocations.uShadowBias, this.params.shadowBias);
        
        // Common uniforms
        gl.uniformMatrix4fv(this.uniformLocations.uViewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(this.uniformLocations.uProjectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(this.uniformLocations.uLightSpaceMatrix, false, lightSpaceMatrix);
        
        gl.uniform1i(this.uniformLocations.uLightType, this.params.lightType);
        gl.uniform3fv(this.uniformLocations.uLightPosition, this.params.lightPosition);
        gl.uniform3fv(this.uniformLocations.uLightDirection, this.params.lightDirection);
        gl.uniform3fv(this.uniformLocations.uLightColor, this.params.lightColor);
        gl.uniform1f(this.uniformLocations.uLightIntensity, this.params.lightIntensity);
        gl.uniform1f(this.uniformLocations.uSpotAngle, this.params.spotAngle);
        gl.uniform1f(this.uniformLocations.uSpotSoftness, this.params.spotSoftness);
        gl.uniform2fv(this.uniformLocations.uAreaSize, this.params.areaSize);
        gl.uniform3fv(this.uniformLocations.uCameraPosition, this.cameraPosition);
        
        // Render main object
        const rotX = createRotationXMatrix(this.rotationX);
        const rotY = createRotationYMatrix(this.rotationY);
        const modelMatrix = multiplyMatrices(rotY, rotX);
        
        const inverseModel = invertMatrix(modelMatrix);
        const normalMatrix = transposeMatrix(inverseModel);
        const normalMatrix3x3 = new Float32Array([
            normalMatrix[0], normalMatrix[1], normalMatrix[2],
            normalMatrix[4], normalMatrix[5], normalMatrix[6],
            normalMatrix[8], normalMatrix[9], normalMatrix[10]
        ]);
        
        gl.uniformMatrix4fv(this.uniformLocations.uModelMatrix, false, modelMatrix);
        gl.uniformMatrix3fv(this.uniformLocations.uNormalMatrix, false, normalMatrix3x3);
        
        gl.uniform3fv(this.uniformLocations.uAlbedo, this.params.albedo);
        gl.uniform1f(this.uniformLocations.uRoughness, this.params.roughness);
        gl.uniform1f(this.uniformLocations.uMetallic, this.params.metallic);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        setupAttribute(gl, this.program, 'aPosition', 3);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
        setupAttribute(gl, this.program, 'aNormal', 3);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
        
        // Render floor
        this.renderFloor(viewMatrix, projectionMatrix, lightSpaceMatrix);
    }
    
    renderFloor(viewMatrix, projectionMatrix, lightSpaceMatrix) {
        const gl = this.gl;
        
        // Floor model matrix - translate down and scale
        const floorTranslate = createTranslationMatrix(0, -1.5, 0);
        const floorModel = floorTranslate;
        
        const inverseFloor = invertMatrix(floorModel);
        const floorNormalMat = transposeMatrix(inverseFloor);
        const floorNormal3x3 = new Float32Array([
            floorNormalMat[0], floorNormalMat[1], floorNormalMat[2],
            floorNormalMat[4], floorNormalMat[5], floorNormalMat[6],
            floorNormalMat[8], floorNormalMat[9], floorNormalMat[10]
        ]);
        
        gl.uniformMatrix4fv(this.uniformLocations.uModelMatrix, false, floorModel);
        gl.uniformMatrix3fv(this.uniformLocations.uNormalMatrix, false, floorNormal3x3);
        
        // Floor material - gray matte
        gl.uniform3fv(this.uniformLocations.uAlbedo, [0.3, 0.3, 0.35]);
        gl.uniform1f(this.uniformLocations.uRoughness, 0.9);
        gl.uniform1f(this.uniformLocations.uMetallic, 0.0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.floorBuffers.position);
        setupAttribute(gl, this.program, 'aPosition', 3);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.floorBuffers.normal);
        setupAttribute(gl, this.program, 'aNormal', 3);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.floorBuffers.index);
        gl.drawElements(gl.TRIANGLES, this.floorBuffers.indexCount, gl.UNSIGNED_SHORT, 0);
    }
    
    renderPreview() {
        if (!this.previewGL || !this.previewProgram) return;
        
        const gl = this.previewGL;
        
        resizeCanvasToDisplaySize(this.previewCanvas);
        gl.viewport(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(this.previewProgram);
        
        const aspect = this.previewCanvas.width / this.previewCanvas.height;
        const projectionMatrix = createPerspectiveMatrix(degToRad(45), aspect, 0.1, 100);
        const viewMatrix = createLookAtMatrix([0, 2, 4], [0, 0, 0], [0, 1, 0]);
        
        gl.uniformMatrix4fv(this.previewUniformLocations.uViewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(this.previewUniformLocations.uProjectionMatrix, false, projectionMatrix);
        
        // Draw object (gray sphere)
        const objMatrix = createIdentityMatrix();
        gl.uniformMatrix4fv(this.previewUniformLocations.uModelMatrix, false, objMatrix);
        gl.uniform3fv(this.previewUniformLocations.uColor, [0.5, 0.5, 0.5]);
        gl.uniform1f(this.previewUniformLocations.uEmissive, 0.0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.previewBuffers.objPosition);
        setupAttribute(gl, this.previewProgram, 'aPosition', 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.previewBuffers.objNormal);
        setupAttribute(gl, this.previewProgram, 'aNormal', 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.previewBuffers.objIndex);
        gl.drawElements(gl.TRIANGLES, this.previewBuffers.objIndexCount, gl.UNSIGNED_SHORT, 0);
        
        // Draw light (emissive sphere at light position)
        const lp = this.params.lightPosition;
        const lightMatrix = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            lp[0] * 0.5, lp[1] * 0.5, lp[2] * 0.3, 1
        ]);
        gl.uniformMatrix4fv(this.previewUniformLocations.uModelMatrix, false, lightMatrix);
        gl.uniform3fv(this.previewUniformLocations.uColor, this.params.lightColor);
        gl.uniform1f(this.previewUniformLocations.uEmissive, 1.0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.previewBuffers.lightPosition);
        setupAttribute(gl, this.previewProgram, 'aPosition', 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.previewBuffers.lightNormal);
        setupAttribute(gl, this.previewProgram, 'aNormal', 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.previewBuffers.lightIndex);
        gl.drawElements(gl.TRIANGLES, this.previewBuffers.lightIndexCount, gl.UNSIGNED_SHORT, 0);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Cook-Torrance Demo...');
    const app = new CookTorranceApp();
    window.cookTorranceApp = app;
});
