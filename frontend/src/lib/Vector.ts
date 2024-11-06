export class Vector2 {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    static from(obj: [number, number] | { x: number, y: number }): Vector2 {
        if (Array.isArray(obj)) {
            return new Vector2(obj[0], obj[1]);
        }
        else {
            return new Vector2(obj.x, obj.y);
        }
    }

    get magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    copy(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    add(point: Vector2): Vector2 {
        return new Vector2(this.x + point.x, this.y + point.y);
    }

    applyAdd(point: Vector2) {
        this.x += point.x;
        this.y += point.y;
    }

    subtract(point: Vector2): Vector2 {
        return new Vector2(this.x - point.x, this.y - point.y);
    }

    applySubtract(point: Vector2) {
        this.x -= point.x;
        this.y -= point.y;
    }

    multiply(value: number): Vector2 {
        return new Vector2(this.x * value, this.y * value);
    }

    applyMultiply(value: number) {
        this.x *= value;
        this.y *= value;
    }

    divide(value: number): Vector2 {
        return new Vector2(this.x / value, this.y / value);
    }

    applyDivide(value: number) {
        this.x /= value;
        this.y /= value;
    }

    invert() {
        return new Vector2(-this.x, -this.y);
    }

    applyInvert() {
        this.x = -this.x;
        this.y = -this.y;
    }

    distance(vector: Vector2) {
        return Math.sqrt(Math.pow(vector.x - this.x, 2) + Math.pow(vector.y - this.y, 2));
    }

    round(value: number = 1) {
        return new Vector2(Math.round(this.x / value) * value, Math.round(this.y / value) * value);
    }

    applyRound(value: number = 1) {
        this.x = Math.round(this.x / value) * value;
        this.y = Math.round(this.y / value) * value;
    }
}
