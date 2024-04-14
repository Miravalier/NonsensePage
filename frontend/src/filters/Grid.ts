import * as PIXI from "pixi.js";
import { Filter, GlProgram } from 'pixi.js';
import vertex from '../shaders/Grid.vert?raw';
import fragment from '../shaders/Grid.frag?raw';
import { Vector2 } from "../lib/Vector.ts";


export class GridFilter extends Filter {
    uniforms: {
        uViewport: PIXI.Point,
        uPitch: PIXI.Point,
        uTranslation: PIXI.Point,
        uScale: PIXI.Point,
        uColor: PIXI.Color,
    };

    constructor(width: number, height: number, squareSize: number, translation: Vector2, scale: number, color: PIXI.Color) {
        const glProgram = GlProgram.from({
            vertex,
            fragment,
            name: 'grid-filter',
        });

        super({
            glProgram,
            resources: {
                gridUniforms: {
                    uViewport: { value: new PIXI.Point(width, height), type: 'vec2<f32>' },
                    uPitch: { value: new PIXI.Point(squareSize, squareSize), type: 'vec2<f32>' },
                    uTranslation: { value: new PIXI.Point(translation.x, translation.y), type: 'vec2<f32>' },
                    uScale: { value: new PIXI.Point(scale, scale), type: 'vec2<f32>' },
                    uColor: { value: color, type: 'vec4<f32>' },
                },
            },
        });

        this.uniforms = this.resources.gridUniforms.uniforms;
    }
}
