export class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static from(obj) {
        if (Array.isArray(obj)) {
            return new Vector2(obj[0], obj[1]);
        }
        else {
            return new Vector2(obj.x, obj.y);
        }
    }

    copy() {
        return new Vector2(this.x, this.y);
    }

    add(point) {
        return new Vector2(this.x + point.x, this.y + point.y);
    }

    applyAdd(point) {
        this.x += point.x;
        this.y += point.y;
    }

    subtract(point) {
        return new Vector2(this.x - point.x, this.y - point.y);
    }

    applySubtract(point) {
        this.x -= point.x;
        this.y -= point.y;
    }

    multiply(value) {
        return new Vector2(this.x * value, this.y * value);
    }

    applyMultiply(value) {
        this.x *= value;
        this.y *= value;
    }

    divide(value) {
        return new Vector2(this.x / value, this.y / value);
    }

    applyDivide(value) {
        this.x /= value;
        this.y /= value;
    }
}
