/**
 * ============================================
 * 3D Geometry Generation Module
 * ============================================
 * 
 * This module generates vertex data for 3D objects:
 * - Sphere (UV sphere with configurable segments)
 * - Cube (with proper normals for each face)
 * - Torus (donut shape)
 * 
 * Each object includes:
 * - Positions: vertex coordinates (x, y, z)
 * - Normals: surface direction vectors (for lighting calculations)
 * - Indices: how vertices connect to form triangles
 */

/**
 * Generate a UV sphere
 * 
 * A UV sphere is created by dividing latitude and longitude lines.
 * Good for demonstrating lighting because of smooth surface normals.
 * 
 * @param {number} radius - Radius of the sphere
 * @param {number} latSegments - Number of horizontal divisions
 * @param {number} lonSegments - Number of vertical divisions
 * @returns {Object} - Object containing positions, normals, and indices arrays
 */
export function createSphere(radius = 1, latSegments = 32, lonSegments = 32) {
    const positions = [];
    const normals = [];
    const indices = [];
    
    // Generate vertices by iterating through latitude and longitude
    for (let lat = 0; lat <= latSegments; lat++) {
        // Theta goes from 0 to PI (top to bottom of sphere)
        const theta = (lat * Math.PI) / latSegments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        
        for (let lon = 0; lon <= lonSegments; lon++) {
            // Phi goes from 0 to 2*PI (around the sphere)
            const phi = (lon * 2 * Math.PI) / lonSegments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            
            // Calculate vertex position using spherical coordinates
            // x = r * sin(theta) * cos(phi)
            // y = r * cos(theta)
            // z = r * sin(theta) * sin(phi)
            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;
            
            // For a sphere centered at origin, the normal equals the normalized position
            // (pointing outward from the center)
            normals.push(x, y, z);
            positions.push(radius * x, radius * y, radius * z);
        }
    }
    
    // Generate indices to connect vertices into triangles
    for (let lat = 0; lat < latSegments; lat++) {
        for (let lon = 0; lon < lonSegments; lon++) {
            // Calculate vertex indices for current quad
            const first = lat * (lonSegments + 1) + lon;
            const second = first + lonSegments + 1;
            
            // Create two triangles for each quad
            // Triangle 1
            indices.push(first, second, first + 1);
            // Triangle 2
            indices.push(second, second + 1, first + 1);
        }
    }
    
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices)
    };
}

/**
 * Generate a cube with proper face normals
 * 
 * Each face has its own set of vertices so that each face
 * can have correct normals for flat shading.
 * 
 * @param {number} size - Size of the cube (edge length)
 * @returns {Object} - Object containing positions, normals, and indices arrays
 */
export function createCube(size = 1) {
    const s = size / 2;  // Half-size for centering the cube at origin
    
    // Define vertices for each face separately
    // This allows each face to have proper flat normals
    const positions = new Float32Array([
        // Front face (z = +s, normal = 0, 0, 1)
        -s, -s,  s,   s, -s,  s,   s,  s,  s,  -s,  s,  s,
        // Back face (z = -s, normal = 0, 0, -1)
        -s, -s, -s,  -s,  s, -s,   s,  s, -s,   s, -s, -s,
        // Top face (y = +s, normal = 0, 1, 0)
        -s,  s, -s,  -s,  s,  s,   s,  s,  s,   s,  s, -s,
        // Bottom face (y = -s, normal = 0, -1, 0)
        -s, -s, -s,   s, -s, -s,   s, -s,  s,  -s, -s,  s,
        // Right face (x = +s, normal = 1, 0, 0)
         s, -s, -s,   s,  s, -s,   s,  s,  s,   s, -s,  s,
        // Left face (x = -s, normal = -1, 0, 0)
        -s, -s, -s,  -s, -s,  s,  -s,  s,  s,  -s,  s, -s
    ]);
    
    // Define normals for each vertex (each face has 4 vertices with same normal)
    const normals = new Float32Array([
        // Front face - pointing towards viewer
        0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
        // Back face - pointing away from viewer
        0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1,
        // Top face - pointing up
        0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
        // Bottom face - pointing down
        0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
        // Right face - pointing right
        1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
        // Left face - pointing left
        -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0
    ]);
    
    // Define indices for triangles (two triangles per face)
    const indices = new Uint16Array([
        0,  1,  2,   0,  2,  3,    // Front
        4,  5,  6,   4,  6,  7,    // Back
        8,  9,  10,  8,  10, 11,   // Top
        12, 13, 14,  12, 14, 15,   // Bottom
        16, 17, 18,  16, 18, 19,   // Right
        20, 21, 22,  20, 22, 23    // Left
    ]);
    
    return { positions, normals, indices };
}

/**
 * Generate a torus (donut shape)
 * 
 * A torus is created by revolving a circle around an axis.
 * Parameters:
 * - outerRadius: distance from center to middle of tube
 * - innerRadius: radius of the tube itself
 * 
 * @param {number} outerRadius - Distance from center to tube center
 * @param {number} innerRadius - Radius of the tube
 * @param {number} radialSegments - Segments around the main ring
 * @param {number} tubularSegments - Segments around the tube
 * @returns {Object} - Object containing positions, normals, and indices arrays
 */
export function createTorus(outerRadius = 0.7, innerRadius = 0.3, radialSegments = 32, tubularSegments = 24) {
    const positions = [];
    const normals = [];
    const indices = [];
    
    // Generate vertices
    for (let j = 0; j <= radialSegments; j++) {
        // Angle around the main ring
        const u = (j / radialSegments) * Math.PI * 2;
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);
        
        for (let i = 0; i <= tubularSegments; i++) {
            // Angle around the tube
            const v = (i / tubularSegments) * Math.PI * 2;
            const cosV = Math.cos(v);
            const sinV = Math.sin(v);
            
            // Calculate position on torus surface
            // The center of the tube is at (outerRadius * cosU, 0, outerRadius * sinU)
            // We add the tube offset using innerRadius
            const x = (outerRadius + innerRadius * cosV) * cosU;
            const y = innerRadius * sinV;
            const z = (outerRadius + innerRadius * cosV) * sinU;
            
            positions.push(x, y, z);
            
            // Calculate normal (points outward from tube center)
            // Tube center at this point
            const centerX = outerRadius * cosU;
            const centerZ = outerRadius * sinU;
            
            // Normal is direction from tube center to surface point
            const nx = (x - centerX);
            const ny = y;
            const nz = (z - centerZ);
            
            // Normalize the normal vector
            const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
            normals.push(nx / length, ny / length, nz / length);
        }
    }
    
    // Generate indices
    for (let j = 0; j < radialSegments; j++) {
        for (let i = 0; i < tubularSegments; i++) {
            // Calculate vertex indices for current quad
            const a = j * (tubularSegments + 1) + i;
            const b = a + tubularSegments + 1;
            const c = a + 1;
            const d = b + 1;
            
            // Create two triangles for each quad
            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }
    
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices)
    };
}

/**
 * Generate a flat plane (floor)
 * 
 * A horizontal plane useful for showing shadows.
 * 
 * @param {number} width - Width of the plane
 * @param {number} depth - Depth of the plane
 * @returns {Object} - Object containing positions, normals, and indices arrays
 */
export function createPlane(width = 4, depth = 4) {
    const hw = width / 2;
    const hd = depth / 2;
    
    const positions = new Float32Array([
        -hw, 0, -hd,
         hw, 0, -hd,
         hw, 0,  hd,
        -hw, 0,  hd
    ]);
    
    const normals = new Float32Array([
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0
    ]);
    
    const indices = new Uint16Array([
        0, 2, 1,
        0, 3, 2
    ]);
    
    return { positions, normals, indices };
}

/**
 * Calculate vertex count from geometry data
 * 
 * @param {Object} geometry - Geometry object with positions array
 * @returns {number} - Number of vertices
 */
export function getVertexCount(geometry) {
    return geometry.positions.length / 3;
}

/**
 * Calculate triangle count from geometry data
 * 
 * @param {Object} geometry - Geometry object with indices array
 * @returns {number} - Number of triangles
 */
export function getTriangleCount(geometry) {
    return geometry.indices.length / 3;
}
