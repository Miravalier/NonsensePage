precision mediump float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;

uniform vec2 uViewport;      // e.g. [800 600] Size of the canvas
uniform vec2 uPitch;         // e.g. [512 512] Size of the grid squares
uniform vec2 uTranslation;   // e.g. [0 0] Shifts the grid by x, y pixels
uniform vec2 uScale;         // e.g. [1.0 1.0] 0.0 - 1.0, Scale percentage in x and y
uniform vec4 uColor;         // e.g. [0.1, 0.1, 0.1, 0.2] Color of the  grid

void main(void)
{
    float offX = (gl_FragCoord.x - uTranslation.x);
    float offY = (1.0 - (uViewport.y - (gl_FragCoord.y + uTranslation.y)));

    if (int(mod(offX, uPitch[0] * uScale[0])) == 0 ||
        int(mod(offY, uPitch[1] * uScale[1])) == 0) {
        finalColor = uColor;
    } else {
        finalColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
}
