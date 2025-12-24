/**
 * Geometry Generation Module
 * 
 * Creates 3D geometry (vertices, normals, UVs, indices) for common shapes.
 * Vertex data layout: [x, y, z, nx, ny, nz, u, v] per vertex
 * - Position (x, y, z): 3D coordinates in model space
 * - Normal (nx, ny, nz): Surface normal for lighting calculations
 * - UV (u, v): Texture coordinates (0-1 range)
 */

// Floor height constant - shadows will be projected onto this plane
export const FLOOR_Y = -0.75;

/**
 * Create a cube geometry
 * The cube is centered at origin with size 1.2 units
 * Each face has its own vertices for correct per-face normals
 * @returns {{data: Float32Array, indices: Uint16Array}} Vertex data and indices
 */
export function createCube() {
    const halfSize = 0.6; // Cube extends from -0.6 to +0.6
    const positions = [
        // Front face (z = +0.6)
        -halfSize, -halfSize,  halfSize,  0, 0, 1,  0, 0, // Bottom-left
         halfSize, -halfSize,  halfSize,  0, 0, 1,  1, 0, // Bottom-right
         halfSize,  halfSize,  halfSize,  0, 0, 1,  1, 1, // Top-right
        -halfSize,  halfSize,  halfSize,  0, 0, 1,  0, 1, // Top-left
        
        // Back face (z = -0.6)
        -halfSize, -halfSize, -halfSize,  0, 0, -1,  1, 0,
        -halfSize,  halfSize, -halfSize,  0, 0, -1,  1, 1,
         halfSize,  halfSize, -halfSize,  0, 0, -1,  0, 1,
         halfSize, -halfSize, -halfSize,  0, 0, -1,  0, 0,
        
        // Left face (x = -0.6)
        -halfSize, -halfSize, -halfSize, -1, 0, 0,  0, 0,
        -halfSize, -halfSize,  halfSize, -1, 0, 0,  1, 0,
        -halfSize,  halfSize,  halfSize, -1, 0, 0,  1, 1,
        -halfSize,  halfSize, -halfSize, -1, 0, 0,  0, 1,
        
        // Right face (x = +0.6)
         halfSize, -halfSize, -halfSize,  1, 0, 0,  1, 0,
         halfSize,  halfSize, -halfSize,  1, 0, 0,  1, 1,
         halfSize,  halfSize,  halfSize,  1, 0, 0,  0, 1,
         halfSize, -halfSize,  halfSize,  1, 0, 0,  0, 0,
        
        // Top face (y = +0.6)
        -halfSize,  halfSize,  halfSize,  0, 1, 0,  0, 0,
         halfSize,  halfSize,  halfSize,  0, 1, 0,  1, 0,
         halfSize,  halfSize, -halfSize,  0, 1, 0,  1, 1,
        -halfSize,  halfSize, -halfSize,  0, 1, 0,  0, 1,
        
        // Bottom face (y = -0.6)
        -halfSize, -halfSize,  halfSize,  0, -1, 0,  1, 0,
        -halfSize, -halfSize, -halfSize,  0, -1, 0,  1, 1,
         halfSize, -halfSize, -halfSize,  0, -1, 0,  0, 1,
         halfSize, -halfSize,  halfSize,  0, -1, 0,  0, 0,
    ];

    // Two triangles per face (6 faces × 2 triangles = 12 triangles)
    const indices = [
        0, 1, 2,   0, 2, 3,     // Front
        4, 5, 6,   4, 6, 7,     // Back
        8, 9, 10,  8, 10, 11,   // Left
        12, 13, 14, 12, 14, 15, // Right
        16, 17, 18, 16, 18, 19, // Top
        20, 21, 22, 20, 22, 23, // Bottom
    ];

    return {
        data: new Float32Array(positions),
        indices: new Uint16Array(indices)
    };
}

/**
 * Create a UV sphere geometry
 * Generates a sphere by subdividing latitude and longitude lines
 * @param {number} segments - Number of subdivisions (higher = smoother sphere)
 * @returns {{data: Float32Array, indices: Uint16Array}} Vertex data and indices
 */
export function createSphere(segments = 32) {
    const positions = [];
    const indices = [];
    const radius = 0.6;

    // Generate vertices
    // Iterate over latitude (y-axis) and longitude (around y-axis)
    for (let latIndex = 0; latIndex <= segments; latIndex++) {
        const v = latIndex / segments; // Vertical UV coordinate [0, 1]
        const theta = v * Math.PI;     // Latitude angle [0, π]
        
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lonIndex = 0; lonIndex <= segments; lonIndex++) {
            const u = lonIndex / segments;    // Horizontal UV coordinate [0, 1]
            const phi = u * Math.PI * 2;      // Longitude angle [0, 2π]
            
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            // Calculate position on unit sphere, then scale by radius
            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;

            // Position
            positions.push(x * radius, y * radius, z * radius);
            // Normal (for sphere at origin, normal = normalized position)
            positions.push(x, y, z);
            // UV coordinates
            positions.push(u, v);
        }
    }

    // Generate triangle indices
    // Connect vertices in a grid pattern to form triangles
    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const current = lat * (segments + 1) + lon;
            const next = current + segments + 1;

            // Two triangles per quad
            // Triangle 1: current, next, current+1
            indices.push(current, next, current + 1);
            // Triangle 2: next, next+1, current+1
            indices.push(next, next + 1, current + 1);
        }
    }

    return {
        data: new Float32Array(positions),
        indices: new Uint16Array(indices)
    };
}

/**
 * Create a ground plane geometry
 * A flat horizontal surface used as the floor for shadow projection
 * @param {number} size - Half-width of the plane (total size = size × 2)
 * @returns {{data: Float32Array, indices: Uint16Array}} Vertex data and indices
 */
export function createPlane(size = 5) {
    const positions = [
        // Four corners of the plane, all at FLOOR_Y height
        // Normal points upward (0, 1, 0)
        -size, FLOOR_Y, -size,  0, 1, 0,  0, 0, // Bottom-left
         size, FLOOR_Y, -size,  0, 1, 0,  1, 0, // Bottom-right
         size, FLOOR_Y,  size,  0, 1, 0,  1, 1, // Top-right
        -size, FLOOR_Y,  size,  0, 1, 0,  0, 1, // Top-left
    ];

    // Two triangles forming a quad
    const indices = [0, 1, 2, 0, 2, 3];

    return {
        data: new Float32Array(positions),
        indices: new Uint16Array(indices)
    };
}

/**
 * Create a small sphere for light source visualization
 * @param {number} segments - Number of subdivisions
 * @returns {{data: Float32Array, indices: Uint16Array}} Vertex data and indices
 */
export function createLightSphere(segments = 8) {
    const positions = [];
    const indices = [];
    const radius = 0.1; // Small sphere for light

    // Generate vertices
    for (let latIndex = 0; latIndex <= segments; latIndex++) {
        const v = latIndex / segments;
        const theta = v * Math.PI;
        
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lonIndex = 0; lonIndex <= segments; lonIndex++) {
            const u = lonIndex / segments;
            const phi = u * Math.PI * 2;
            
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;

            positions.push(x * radius, y * radius, z * radius);
            positions.push(x, y, z);
            positions.push(u, v);
        }
    }

    // Generate triangle indices
    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const current = lat * (segments + 1) + lon;
            const next = current + segments + 1;

            indices.push(current, next, current + 1);
            indices.push(next, next + 1, current + 1);
        }
    }

    return {
        data: new Float32Array(positions),
        indices: new Uint16Array(indices)
    };
}

/**
 * Create a Vertex Array Object (VAO) from geometry data
 * VAOs store vertex attribute configuration for efficient rendering
 * @param {WebGL2RenderingContext} gl - WebGL context
 * @param {{data: Float32Array, indices: Uint16Array}} geo - Geometry data
 * @returns {{vao: WebGLVertexArrayObject, count: number}} VAO and index count
 */
export function createVAO(gl, geo) {
    // Create and bind VAO
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Create and populate vertex buffer (VBO)
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, geo.data, gl.STATIC_DRAW);

    // Create and populate index buffer (EBO/IBO)
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

    // Configure vertex attributes
    // Each vertex has 8 floats: 3 position + 3 normal + 2 UV
    const stride = 8 * 4; // 8 floats × 4 bytes per float

    // Attribute 0: Position (vec3)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);

    // Attribute 1: Normal (vec3)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);

    // Attribute 2: UV coordinates (vec2)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);

    // Unbind VAO to prevent accidental modification
    gl.bindVertexArray(null);

    return {
        vao,
        count: geo.indices.length
    };
}
