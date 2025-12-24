/**
 * Ray-Object Intersection Module
 * 
 * Provides ray casting functions for mouse picking.
 * Used to detect when the mouse hovers over 3D objects.
 */

import { vec3 } from './math.js';

/**
 * Ray-sphere intersection test
 * Uses quadratic formula to solve for intersection points
 * 
 * @param {Array<number>} rayOrigin - Ray starting point
 * @param {Array<number>} rayDir - Ray direction (normalized)
 * @param {Array<number>} sphereCenter - Sphere center position
 * @param {number} sphereRadius - Sphere radius
 * @returns {Object|null} Hit info {point, normal} or null if no hit
 */
export function intersectSphere(rayOrigin, rayDir, sphereCenter, sphereRadius) {
    // Vector from sphere center to ray origin
    const oc = vec3.sub(rayOrigin, sphereCenter);
    
    // Quadratic equation coefficients: at² + bt + c = 0
    const a = vec3.dot(rayDir, rayDir);
    const b = 2 * vec3.dot(rayDir, oc);
    const c = vec3.dot(oc, oc) - sphereRadius * sphereRadius;
    
    // Calculate discriminant
    const discriminant = b * b - 4 * a * c;
    
    // No intersection if discriminant is negative
    if (discriminant < 0) return null;
    
    // Calculate nearest intersection point
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    
    // Reject if intersection is behind ray origin
    if (t < 0) return null;
    
    // Calculate hit point and normal
    const point = vec3.add(rayOrigin, vec3.scale(rayDir, t));
    const normal = vec3.normalize(vec3.sub(point, sphereCenter));
    
    return { point, normal };
}

/**
 * Ray-AABB (axis-aligned bounding box) intersection test
 * Uses slab method for efficient intersection testing
 * 
 * @param {Array<number>} rayOrigin - Ray starting point
 * @param {Array<number>} rayDir - Ray direction (normalized)
 * @param {Array<number>} boxCenter - Box center position
 * @param {number} boxHalfSize - Half-size of the cube (0.6 for our cube)
 * @returns {Object|null} Hit info {point, normal} or null if no hit
 */
export function intersectCube(rayOrigin, rayDir, boxCenter, boxHalfSize) {
    // Calculate box min and max corners
    const min = vec3.sub(boxCenter, [boxHalfSize, boxHalfSize, boxHalfSize]);
    const max = vec3.add(boxCenter, [boxHalfSize, boxHalfSize, boxHalfSize]);
    
    // Test X-axis slab
    let tmin = (min[0] - rayOrigin[0]) / rayDir[0];
    let tmax = (max[0] - rayOrigin[0]) / rayDir[0];
    if (tmin > tmax) [tmin, tmax] = [tmax, tmin]; // Swap if needed
    
    // Test Y-axis slab
    let tymin = (min[1] - rayOrigin[1]) / rayDir[1];
    let tymax = (max[1] - rayOrigin[1]) / rayDir[1];
    if (tymin > tymax) [tymin, tymax] = [tymax, tymin];
    
    // Check if slabs overlap
    if ((tmin > tymax) || (tymin > tmax)) return null;
    
    // Update intersection range
    if (tymin > tmin) tmin = tymin;
    if (tymax < tmax) tmax = tymax;
    
    // Test Z-axis slab
    let tzmin = (min[2] - rayOrigin[2]) / rayDir[2];
    let tzmax = (max[2] - rayOrigin[2]) / rayDir[2];
    if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];
    
    // Check if all slabs overlap
    if ((tmin > tzmax) || (tzmin > tmax)) return null;
    
    if (tzmin > tmin) tmin = tzmin;
    
    // Reject if intersection is behind ray
    if (tmin < 0) return null;
    
    // Calculate hit point
    const point = vec3.add(rayOrigin, vec3.scale(rayDir, tmin));
    
    // Determine which face was hit by finding the axis with largest component
    const local = vec3.sub(point, boxCenter);
    const absLocal = local.map(Math.abs);
    const maxAxis = Math.max(absLocal[0], absLocal[1], absLocal[2]);
    
    // Set normal based on which face was hit
    let normal = [0, 0, 0];
    if (maxAxis === absLocal[0]) {
        normal = [Math.sign(local[0]), 0, 0];
    } else if (maxAxis === absLocal[1]) {
        normal = [0, Math.sign(local[1]), 0];
    } else {
        normal = [0, 0, Math.sign(local[2])];
    }
    
    return { point, normal };
}

/**
 * Test ray intersection with current object type
 * 
 * @param {Array<number>} rayOrigin - Ray starting point
 * @param {Array<number>} rayDir - Ray direction
 * @param {string} objectType - 'sphere' or 'cube'
 * @param {Array<number>} objectCenter - Object center [x, y, z]
 * @param {number} objectSize - Object size (0.6 for our objects)
 * @returns {Object|null} Hit info {point, normal} or null
 */
export function intersectObject(rayOrigin, rayDir, objectType, objectCenter = [0, 0, 0], objectSize = 0.6) {
    if (objectType === 'sphere') {
        return intersectSphere(rayOrigin, rayDir, objectCenter, objectSize);
    } else {
        return intersectCube(rayOrigin, rayDir, objectCenter, objectSize);
    }
}
