const Utils = {
    // Linear interpolation
    lerp: (start, end, t) => {
        return start + (end - start) * t;
    },

    // Ease in-out
    easeInOut: (t) => {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },

    // Random integer within range
    randomInt: (min, max) => {
        return Math.floor(Math.min(min, max) + Math.random() * (Math.abs(max - min) + 1));
    },

    // Choose random item from array
    randomChoice: (arr) => {
        return arr[Math.floor(Math.random() * arr.length)];
    }
};
