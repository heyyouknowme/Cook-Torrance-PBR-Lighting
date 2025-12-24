/**
 * Debug Visualization Module
 * 
 * Utilities for rendering debug vectors (N, L, V, H) at a point on the surface
 */

import { vec3 } from './math.js';

/**
 * Simple vertex shader for debug lines
 */
export const debugVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPos;

uniform mat4 uView;
uniform mat4 uProj;

void main() {
    gl_Position = uProj * uView * vec4(aPos, 1.0);
}
`;

/**
 * Simple fragment shader for debug lines (solid color)
 */
export const debugFragmentShader = `#version 300 es
precision highp float;

uniform vec3 uColor;
out vec4 fragColor;

void main() {
    fragColor = vec4(uColor, 1.0);
}
`;

/**
 * Create line geometry for a vector
 * @param {Array<number>} origin - Starting point [x, y, z]
 * @param {Array<number>} direction - Direction vector [x, y, z]
 * @param {number} length - Length of the arrow
 * @returns {Float32Array} Line vertices
 */
export function createArrowLine(origin, direction, length = 0.5) {
    const end = vec3.add(origin, vec3.scale(direction, length));
    
    // Arrow line (2 vertices)
    const vertices = [
        ...origin,  // Start
        ...end      // End
    ];
    
    return new Float32Array(vertices);
}

/**
 * Debug Vector Renderer
 * Renders N, L, V, H vectors at a point on the surface
 */
export class DebugVectorRenderer {
    constructor(gl, program) {
        this.gl = gl;
        this.program = program;
        
        // Create VAO and buffer for dynamic line rendering
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        
        // Position attribute
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindVertexArray(null);
    }
    
    /**
     * Render debug vectors at a hit point
     * @param {Object} hitInfo - Hit information with point, normal, and vectors
     * @param {Object} vectors - { N, L, V, H } vectors to render
     * @param {Array<number>} viewMatrix - Camera view matrix
     * @param {Array<number>} projMatrix - Projection matrix
     */
    render(hitInfo, vectors, viewMatrix, projMatrix) {
        const { gl, program, vao, vbo } = this;
        const { point, normal } = hitInfo;
        const { N, L, V, H } = vectors;
        
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        
        // Upload matrices
        const viewLoc = gl.getUniformLocation(program, 'uView');
        const projLoc = gl.getUniformLocation(program, 'uProj');
        const colorLoc = gl.getUniformLocation(program, 'uColor');
        
        gl.uniformMatrix4fv(viewLoc, false, viewMatrix);
        gl.uniformMatrix4fv(projLoc, false, projMatrix);
        
        // Increase line width
        gl.lineWidth(3);
        
        // Define vector colors
        const vectorConfigs = [
            { vector: N, color: [0, 1, 0], name: 'N' },     // Green - Normal
            { vector: L, color: [1, 1, 0], name: 'L' },     // Yellow - Light
            { vector: V, color: [0, 0.5, 1], name: 'V' },   // Cyan - View
            { vector: H, color: [1, 0, 1], name: 'H' }      // Magenta - Half
        ];
        
        // Render each vector
        for (const config of vectorConfigs) {
            const lineData = createArrowLine(point, config.vector, 0.4);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.DYNAMIC_DRAW);
            
            gl.uniform3fv(colorLoc, config.color);
            gl.drawArrays(gl.LINES, 0, 2);
        }
        
        gl.bindVertexArray(null);
        gl.lineWidth(1);
    }
}
