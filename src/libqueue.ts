export default class Queue<T = unknown> {
    private readonly __array: T[] = [];
    add(input: T) {
        this.__array.push(input);
    }
    remove(): T | undefined {
        return this.__array.shift();
    }
}