class Input {
    constructor() {
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            w: false,
            s: false,
            a: false,
            d: false,
            Enter: false
        };

        this.addEventListeners();
    }

    addEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = false;
            }
        });
    }

    get throttle() {
        return this.keys.ArrowUp || this.keys.w;
    }

    get brake() {
        return this.keys.ArrowDown || this.keys.s;
    }

    get left() {
        return this.keys.ArrowLeft || this.keys.a;
    }

    get right() {
        return this.keys.ArrowRight || this.keys.d;
    }
    
    get start() {
        return this.keys.Enter;
    }
}
