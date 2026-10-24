// tests/db.test.js - unit tests for toVectorLiteral & cosineDistance helpers
'use strict';

const { toVectorLiteral, cosineDistance } = require('../src/config/db');

describe('toVectorLiteral', () => {
    test('simple array', () => {
        expect(toVectorLiteral([1, 2, 3])).toBe('[1,2,3]');
    });
    test('floats', () => {
        const out = toVectorLiteral([0.1, 0.234, 0.5]);
        expect(out).toBe('[0.1,0.234,0.5]');
    });
    test('empty array', () => {
        expect(toVectorLiteral([])).toBe('[]');
    });
    test('throws on non-array', () => {
        expect(() => toVectorLiteral('foo')).toThrow();
    });
});

describe('cosineDistance', () => {
    test('identical vectors have distance 0', () => {
        const v = [0.1, 0.2, 0.3];
        expect(cosineDistance(v, v)).toBeCloseTo(0, 5);
    });
    test('orthogonal vectors have distance 1', () => {
        const v1 = [1, 0, 0];
        const v2 = [0, 1, 0];
        expect(cosineDistance(v1, v2)).toBeCloseTo(1, 5);
    });
    test('opposite vectors have distance 2', () => {
        const v1 = [1, 0, 0];
        const v2 = [-1, 0, 0];
        expect(cosineDistance(v1, v2)).toBeCloseTo(2, 5);
    });
    test('handles mismatch length gracefully', () => {
        expect(cosineDistance([1, 2], [1, 2, 3])).toBe(1.0);
    });
});
