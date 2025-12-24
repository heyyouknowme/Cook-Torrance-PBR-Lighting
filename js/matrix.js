/**
 * ============================================
 * Matrix Math Utilities Module
 * ============================================
 * 
 * This module provides matrix operations essential for 3D graphics:
 * - Matrix creation (identity, perspective, lookAt)
 * - Matrix transformations (translate, rotate, scale)
 * - Matrix multiplication
 * - Vector operations
 * 
 * All matrices are in column-major order (OpenGL/WebGL standard)
 * A 4x4 matrix is stored as a 16-element Float32Array
 */

/**
 * Create a 4x4 identity matrix
 * 
 * The identity matrix is the "neutral" matrix - multiplying by it
 * doesn't change anything. It looks like:
 * [1, 0, 0, 0]
 * [0, 1, 0, 0]
 * [0, 0, 1, 0]
 * [0, 0, 0, 1]
 * 
 * @returns {Float32Array} - A new identity matrix
 */
export function createIdentityMatrix() {
    return new Float32Array([
        1, 0, 0, 0,  // Column 1
        0, 1, 0, 0,  // Column 2
        0, 0, 1, 0,  // Column 3
        0, 0, 0, 1   // Column 4
    ]);
}

/**
 * Create a perspective projection matrix
 * 
 * This matrix transforms 3D coordinates into 2D screen coordinates
 * with perspective (objects farther away appear smaller).
 * 
 * @param {number} fov - Field of view in radians (vertical)
 * @param {number} aspect - Aspect ratio (width / height)
 * @param {number} near - Near clipping plane distance
 * @param {number} far - Far clipping plane distance
 * @returns {Float32Array} - The perspective matrix
 */
export function createPerspectiveMatrix(fov, aspect, near, far) {
    // Calculate the focal length based on field of view
    const f = 1.0 / Math.tan(fov / 2);
    
    // Calculate the depth range factor
    const rangeInv = 1.0 / (near - far);
    
    return new Float32Array([
        f / aspect, 0, 0, 0,                         // Column 1
        0, f, 0, 0,                                   // Column 2
        0, 0, (near + far) * rangeInv, -1,           // Column 3
        0, 0, near * far * rangeInv * 2, 0           // Column 4
    ]);
}

/**
 * Create a view matrix using the "look at" method
 * 
 * This matrix positions and orients the camera in the scene.
 * 
 * @param {Array} eye - Camera position [x, y, z]
 * @param {Array} center - Point the camera is looking at [x, y, z]
 * @param {Array} up - Up direction vector [x, y, z]
 * @returns {Float32Array} - The view matrix
 */
export function createLookAtMatrix(eye, center, up) {
    // Calculate the forward vector (from camera to target)
    const zAxis = normalize([
        eye[0] - center[0],
        eye[1] - center[1],
        eye[2] - center[2]
    ]);
    
    // Calculate the right vector (perpendicular to forward and up)
    const xAxis = normalize(cross(up, zAxis));
    
    // Calculate the true up vector (perpendicular to forward and right)
    const yAxis = cross(zAxis, xAxis);
    
    // Build the view matrix
    // This combines rotation (to align axes) and translation (to position camera)
    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1
    ]);
}

/**
 * Multiply two 4x4 matrices
 * 
 * Matrix multiplication is used to combine transformations.
 * Note: Order matters! A * B != B * A
 * 
 * @param {Float32Array} a - First matrix
 * @param {Float32Array} b - Second matrix
 * @returns {Float32Array} - Result of a * b
 */
export function multiplyMatrices(a, b) {
    const result = new Float32Array(16);
    
    // For each element in the result matrix
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            // Calculate the dot product of row from 'a' and column from 'b'
            let sum = 0;
            for (let k = 0; k < 4; k++) {
                // Remember: column-major order!
                // a[row + k*4] gets element at (row, k)
                // b[k + col*4] gets element at (k, col)
                sum += a[row + k * 4] * b[k + col * 4];
            }
            result[row + col * 4] = sum;
        }
    }
    
    return result;
}

/**
 * Create a translation matrix
 * 
 * This matrix moves objects in 3D space.
 * 
 * @param {number} x - Translation along X axis
 * @param {number} y - Translation along Y axis
 * @param {number} z - Translation along Z axis
 * @returns {Float32Array} - The translation matrix
 */
export function createTranslationMatrix(x, y, z) {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1  // Translation values in the last column
    ]);
}

/**
 * Create a rotation matrix around the X axis
 * 
 * @param {number} angle - Rotation angle in radians
 * @returns {Float32Array} - The rotation matrix
 */
export function createRotationXMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
    ]);
}

/**
 * Create a rotation matrix around the Y axis
 * 
 * @param {number} angle - Rotation angle in radians
 * @returns {Float32Array} - The rotation matrix
 */
export function createRotationYMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ]);
}

/**
 * Create a rotation matrix around the Z axis
 * 
 * @param {number} angle - Rotation angle in radians
 * @returns {Float32Array} - The rotation matrix
 */
export function createRotationZMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Float32Array([
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

/**
 * Create a scale matrix
 * 
 * This matrix resizes objects in 3D space.
 * 
 * @param {number} sx - Scale factor along X axis
 * @param {number} sy - Scale factor along Y axis
 * @param {number} sz - Scale factor along Z axis
 * @returns {Float32Array} - The scale matrix
 */
export function createScaleMatrix(sx, sy, sz) {
    return new Float32Array([
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        0, 0, 0, 1
    ]);
}

/**
 * Create an orthographic projection matrix
 * 
 * This matrix creates a parallel projection without perspective.
 * Used for shadow mapping.
 * 
 * @param {number} left - Left clipping plane
 * @param {number} right - Right clipping plane
 * @param {number} bottom - Bottom clipping plane
 * @param {number} top - Top clipping plane
 * @param {number} near - Near clipping plane
 * @param {number} far - Far clipping plane
 * @returns {Float32Array} - The orthographic projection matrix
 */
export function createOrthographicMatrix(left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    
    return new Float32Array([
        -2 * lr, 0, 0, 0,
        0, -2 * bt, 0, 0,
        0, 0, 2 * nf, 0,
        (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1
    ]);
}

/**
 * Calculate the inverse of a 4x4 matrix
 * 
 * The inverse matrix "undoes" a transformation.
 * Used for normal matrix calculation in lighting.
 * 
 * @param {Float32Array} m - The matrix to invert
 * @returns {Float32Array|null} - The inverse matrix, or null if not invertible
 */
export function invertMatrix(m) {
    const inv = new Float32Array(16);
    
    // Calculate cofactors
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] +
             m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] -
             m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] +
             m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] -
              m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] -
             m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] +
             m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] -
             m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] +
              m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] +
             m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] -
             m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] +
              m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] -
              m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] -
             m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] +
             m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] -
              m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] +
              m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    
    // Calculate determinant
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    
    if (det === 0) {
        console.warn('Matrix is not invertible');
        return null;
    }
    
    det = 1.0 / det;
    
    for (let i = 0; i < 16; i++) {
        inv[i] *= det;
    }
    
    return inv;
}

/**
 * Transpose a 4x4 matrix
 * 
 * Swaps rows and columns. Used for normal matrix calculation.
 * 
 * @param {Float32Array} m - The matrix to transpose
 * @returns {Float32Array} - The transposed matrix
 */
export function transposeMatrix(m) {
    return new Float32Array([
        m[0], m[4], m[8], m[12],
        m[1], m[5], m[9], m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15]
    ]);
}

// ============================================
// Vector Helper Functions
// ============================================

/**
 * Normalize a 3D vector (make it unit length)
 * 
 * @param {Array} v - The vector [x, y, z]
 * @returns {Array} - The normalized vector
 */
export function normalize(v) {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    
    if (length === 0) {
        return [0, 0, 0];
    }
    
    return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Calculate the cross product of two 3D vectors
 * 
 * The cross product gives a vector perpendicular to both inputs.
 * 
 * @param {Array} a - First vector
 * @param {Array} b - Second vector
 * @returns {Array} - The cross product a × b
 */
export function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

/**
 * Calculate the dot product of two 3D vectors
 * 
 * The dot product measures how aligned two vectors are.
 * 
 * @param {Array} a - First vector
 * @param {Array} b - Second vector
 * @returns {number} - The dot product a · b
 */
export function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Convert degrees to radians
 * 
 * @param {number} degrees - Angle in degrees
 * @returns {number} - Angle in radians
 */
export function degToRad(degrees) {
    return degrees * Math.PI / 180;
}
