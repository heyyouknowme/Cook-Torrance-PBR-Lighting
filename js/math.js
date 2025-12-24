/**
 * Math Utilities for 3D Graphics
 * 
 * This module provides essential vector and matrix operations for 3D rendering.
 * All matrices use column-major layout (like OpenGL/WebGL).
 */

// Constant for degree-to-radian conversion
const RAD = Math.PI / 180;

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export const degToRad = (degrees) => degrees * RAD;

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum bound
 * @param {number} max - Maximum bound
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * 3D Vector Operations
 * Vectors are represented as [x, y, z] arrays
 */
export const vec3 = {
    /**
     * Add two vectors
     * @param {Array<number>} a - First vector [x, y, z]
     * @param {Array<number>} b - Second vector [x, y, z]
     * @returns {Array<number>} Result a + b
     */
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],

    /**
     * Subtract two vectors
     * @param {Array<number>} a - First vector
     * @param {Array<number>} b - Second vector
     * @returns {Array<number>} Result a - b
     */
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],

    /**
     * Scale a vector by a scalar
     * @param {Array<number>} a - Vector to scale
     * @param {number} s - Scalar value
     * @returns {Array<number>} Scaled vector a * s
     */
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],

    /**
     * Compute dot product of two vectors
     * @param {Array<number>} a - First vector
     * @param {Array<number>} b - Second vector
     * @returns {number} Dot product a · b
     */
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],

    /**
     * Compute cross product of two vectors
     * Result is perpendicular to both input vectors
     * @param {Array<number>} a - First vector
     * @param {Array<number>} b - Second vector
     * @returns {Array<number>} Cross product a × b
     */
    cross: (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ],

    /**
     * Compute length (magnitude) of a vector
     * @param {Array<number>} a - Vector
     * @returns {number} Length ||a||
     */
    length: (a) => Math.hypot(a[0], a[1], a[2]),

    /**
     * Normalize a vector to unit length
     * @param {Array<number>} a - Vector to normalize
     * @returns {Array<number>} Unit vector in same direction
     */
    normalize: (a) => {
        const length = vec3.length(a) || 1; // Avoid division by zero
        return [a[0] / length, a[1] / length, a[2] / length];
    },
};

/**
 * 4x4 Matrix Operations
 * Matrices are stored in column-major order as flat arrays of 16 elements
 * Layout: [m0, m1, m2, m3, m4, m5, ..., m15]
 * Where column 0 = [m0, m1, m2, m3], column 1 = [m4, m5, m6, m7], etc.
 */
export const mat4 = {
    /**
     * Create an identity matrix (no transformation)
     * @returns {Array<number>} 4x4 identity matrix
     */
    identity: () => [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ],

    /**
     * Multiply two 4x4 matrices
     * Result = a * b (applies b transformation first, then a)
     * @param {Array<number>} a - Left matrix
     * @param {Array<number>} b - Right matrix
     * @returns {Array<number>} Product matrix
     */
    multiply: (a, b) => {
        const out = new Array(16);
        // Extract rows of matrix a
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

        // Multiply each column of b by matrix a
        let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
        out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
        out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
        out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
        out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
        return out;
    },

    /**
     * Multiply a 4x4 matrix by a 4D vector
     * @param {Array<number>} m - Matrix
     * @param {Array<number>} v - Vector [x, y, z, w]
     * @returns {Array<number>} Transformed vector
     */
    multiplyVec4: (m, v) => [
        m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
        m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
        m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
        m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
    ],

    /**
     * Create a perspective projection matrix
     * Used to simulate camera perspective (objects farther away appear smaller)
     * @param {number} fovy - Field of view in radians (vertical)
     * @param {number} aspect - Aspect ratio (width / height)
     * @param {number} near - Near clipping plane distance
     * @param {number} far - Far clipping plane distance
     * @returns {Array<number>} Perspective projection matrix
     */
    perspective: (fovy, aspect, near, far) => {
        const f = 1 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, (2 * far * near) * nf, 0,
        ];
    },

    /**
     * Create a view matrix (camera transformation)
     * Transforms world coordinates to camera/view space
     * @param {Array<number>} eye - Camera position [x, y, z]
     * @param {Array<number>} center - Point camera is looking at
     * @param {Array<number>} up - Up direction (usually [0, 1, 0])
     * @returns {Array<number>} View matrix
     */
    lookAt: (eye, center, up) => {
        // Calculate camera's local coordinate system
        const f = vec3.normalize(vec3.sub(center, eye)); // Forward direction
        const s = vec3.normalize(vec3.cross(f, up));      // Right direction
        const u = vec3.cross(s, f);                        // Up direction

        // Build view matrix (inverse of camera transform)
        return [
            s[0], u[0], -f[0], 0,
            s[1], u[1], -f[1], 0,
            s[2], u[2], -f[2], 0,
            -vec3.dot(s, eye), -vec3.dot(u, eye), vec3.dot(f, eye), 1,
        ];
    },

    /**
     * Invert a 4x4 matrix
     * Used for transformations like world-to-local space conversion
     * @param {Array<number>} m - Matrix to invert
     * @returns {Array<number>} Inverted matrix
     */
    invert: (m) => {
        const inv = new Array(16);
        const [
            a00, a01, a02, a03,
            a10, a11, a12, a13,
            a20, a21, a22, a23,
            a30, a31, a32, a33,
        ] = m;

        // Calculate matrix of minors and cofactors
        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;

        // Calculate determinant
        const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (!det) return mat4.identity(); // Return identity if not invertible
        const invDet = 1 / det;

        // Calculate inverse using adjugate method
        inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
        inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * invDet;
        inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
        inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * invDet;
        inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * invDet;
        inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
        inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * invDet;
        inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
        inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
        inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * invDet;
        inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
        inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * invDet;
        inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * invDet;
        inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
        inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * invDet;
        inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
        return inv;
    },

    /**
     * Transpose a 4x4 matrix (swap rows and columns)
     * @param {Array<number>} m - Matrix to transpose
     * @returns {Array<number>} Transposed matrix
     */
    transpose: (m) => [
        m[0], m[4], m[8], m[12],
        m[1], m[5], m[9], m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15],
    ],
};

/**
 * 3x3 Matrix Operations
 * Used primarily for normal transformations
 */
export const mat3 = {
    /**
     * Create identity 3x3 matrix
     * @returns {Array<number>} Identity matrix
     */
    identity: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],

    /**
     * Extract upper-left 3x3 portion from a 4x4 matrix
     * @param {Array<number>} m - 4x4 matrix
     * @returns {Array<number>} 3x3 matrix
     */
    fromMat4: (m) => [
        m[0], m[1], m[2],
        m[4], m[5], m[6],
        m[8], m[9], m[10],
    ],

    /**
     * Invert a 3x3 matrix
     * @param {Array<number>} m - Matrix to invert
     * @returns {Array<number>} Inverted matrix
     */
    invert: (m) => {
        const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = m;
        const b01 = a22 * a11 - a12 * a21;
        const b02 = -a22 * a10 + a12 * a20;
        const b03 = a21 * a10 - a11 * a20;
        let det = a00 * b01 + a01 * b02 + a02 * b03;
        if (!det) return mat3.identity();
        det = 1 / det;
        return [
            b01 * det,
            (-a22 * a01 + a02 * a21) * det,
            (a12 * a01 - a02 * a11) * det,
            b02 * det,
            (a22 * a00 - a02 * a20) * det,
            (-a12 * a00 + a02 * a10) * det,
            b03 * det,
            (-a21 * a00 + a01 * a20) * det,
            (a11 * a00 - a01 * a10) * det,
        ];
    },

    /**
     * Transpose a 3x3 matrix
     * @param {Array<number>} m - Matrix to transpose
     * @returns {Array<number>} Transposed matrix
     */
    transpose: (m) => [
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8],
    ],
};
