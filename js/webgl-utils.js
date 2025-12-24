/**
 * ============================================
 * WebGL Utilities Module
 * ============================================
 * 
 * This module contains utility functions for:
 * - WebGL context initialization
 * - Shader compilation and program linking
 * - Buffer creation and management
 * 
 * These are fundamental operations needed for any WebGL application.
 */

/**
 * Initialize WebGL context from a canvas element
 * 
 * @param {HTMLCanvasElement} canvas - The canvas element to get context from
 * @returns {WebGLRenderingContext|null} - The WebGL context or null if failed
 */
export function initWebGL(canvas) {
    // Try to get WebGL2 context first (more features)
    let gl = canvas.getContext('webgl2');
    
    // Fall back to WebGL1 if WebGL2 is not available
    if (!gl) {
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        console.warn('WebGL2 not available, falling back to WebGL1');
    }
    
    // Check if WebGL is supported at all
    if (!gl) {
        console.error('WebGL is not supported in this browser');
        alert('Your browser does not support WebGL. Please use a modern browser.');
        return null;
    }
    
    return gl;
}

/**
 * Compile a shader from source code
 * 
 * Shaders are small programs that run on the GPU:
 * - Vertex Shader: Processes each vertex (position, transform)
 * - Fragment Shader: Processes each pixel (color, lighting)
 * 
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {number} type - The shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
 * @param {string} source - The GLSL shader source code
 * @returns {WebGLShader|null} - The compiled shader or null if compilation failed
 */
export function compileShader(gl, type, source) {
    // Create a new shader object
    const shader = gl.createShader(type);
    
    // Attach the source code to the shader
    gl.shaderSource(shader, source);
    
    // Compile the shader
    gl.compileShader(shader);
    
    // Check for compilation errors
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        // Get the error message
        const errorMsg = gl.getShaderInfoLog(shader);
        console.error(`Shader compilation error: ${errorMsg}`);
        
        // Clean up the failed shader
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

/**
 * Create a shader program by linking vertex and fragment shaders
 * 
 * A shader program combines vertex and fragment shaders into
 * a complete pipeline that the GPU can execute.
 * 
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {string} vertexSource - Vertex shader source code
 * @param {string} fragmentSource - Fragment shader source code
 * @returns {WebGLProgram|null} - The linked shader program or null if failed
 */
export function createShaderProgram(gl, vertexSource, fragmentSource) {
    // Compile the vertex shader
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    if (!vertexShader) return null;
    
    // Compile the fragment shader
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragmentShader) {
        gl.deleteShader(vertexShader);
        return null;
    }
    
    // Create the shader program
    const program = gl.createProgram();
    
    // Attach both shaders to the program
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    
    // Link the program (connects vertex shader outputs to fragment shader inputs)
    gl.linkProgram(program);
    
    // Check for linking errors
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const errorMsg = gl.getProgramInfoLog(program);
        console.error(`Shader program linking error: ${errorMsg}`);
        
        // Clean up
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return null;
    }
    
    // Shaders can be deleted after linking (they're now part of the program)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    return program;
}

/**
 * Create a WebGL buffer and fill it with data
 * 
 * Buffers store vertex data (positions, normals, etc.) on the GPU
 * for efficient rendering.
 * 
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {Float32Array|Uint16Array} data - The data to store in the buffer
 * @param {number} bufferType - Buffer type (gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER)
 * @returns {WebGLBuffer} - The created buffer
 */
export function createBuffer(gl, data, bufferType = gl.ARRAY_BUFFER) {
    // Create a new buffer object
    const buffer = gl.createBuffer();
    
    // Bind the buffer (make it the active buffer for subsequent operations)
    gl.bindBuffer(bufferType, buffer);
    
    // Upload the data to the GPU
    // STATIC_DRAW means the data won't change frequently
    gl.bufferData(bufferType, data, gl.STATIC_DRAW);
    
    return buffer;
}

/**
 * Set up a vertex attribute pointer
 * 
 * This tells WebGL how to read data from a buffer for a specific attribute
 * (like position, normal, or texture coordinate).
 * 
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {WebGLProgram} program - The shader program
 * @param {string} attributeName - Name of the attribute in the shader
 * @param {number} size - Number of components per vertex (1-4)
 * @param {number} stride - Bytes between consecutive vertices (0 for tightly packed)
 * @param {number} offset - Offset in bytes to the first component
 */
export function setupAttribute(gl, program, attributeName, size, stride = 0, offset = 0) {
    // Get the attribute location in the shader program
    const location = gl.getAttribLocation(program, attributeName);
    
    if (location === -1) {
        console.warn(`Attribute '${attributeName}' not found in shader program`);
        return -1;
    }
    
    // Enable the attribute array
    gl.enableVertexAttribArray(location);
    
    // Specify how to read the buffer data
    // - location: which attribute to configure
    // - size: components per vertex (e.g., 3 for xyz position)
    // - gl.FLOAT: data type
    // - false: don't normalize
    // - stride: bytes between vertices
    // - offset: starting offset
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    
    return location;
}

/**
 * Get the location of a uniform variable in a shader program
 * 
 * Uniforms are global variables in shaders that stay the same for all vertices/fragments
 * (e.g., transformation matrices, light position, material properties).
 * 
 * @param {WebGLRenderingContext} gl - The WebGL context
 * @param {WebGLProgram} program - The shader program
 * @param {string} uniformName - Name of the uniform in the shader
 * @returns {WebGLUniformLocation|null} - The uniform location
 */
export function getUniformLocation(gl, program, uniformName) {
    const location = gl.getUniformLocation(program, uniformName);
    
    if (location === null) {
        console.warn(`Uniform '${uniformName}' not found in shader program`);
    }
    
    return location;
}

/**
 * Resize the canvas to match its display size
 * 
 * This is important for proper rendering resolution and aspect ratio.
 * 
 * @param {HTMLCanvasElement} canvas - The canvas to resize
 * @returns {boolean} - True if the canvas was resized
 */
export function resizeCanvasToDisplaySize(canvas) {
    // Get the display size of the canvas (CSS pixels)
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // Check if the canvas drawing buffer size differs from display size
    const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
    
    if (needResize) {
        // Resize the canvas drawing buffer to match display size
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
    
    return needResize;
}
