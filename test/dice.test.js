import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../dice/dice.js'; const { parse, roll } = globalThis.ArcanaDice;
test('mixed dice groups and signed modifiers add correctly', () => { const values = [3, 4, 8]; const result = roll('2d6 + 1d8 - 3', 'normal', () => values.shift()); assert.equal(result.total, 12); });
test('advantage keeps higher d20 and applies modifier once', () => { const values = [4, 19]; const result = roll('d20 + 5', 'advantage', () => values.shift()); assert.equal(result.total, 24); assert.equal(result.groups[0].kept, 1); assert.equal(result.natural, 19); });
test('disadvantage keeps lower d20', () => { const values = [20, 1]; const result = roll('1d20 - 2', 'disadvantage', () => values.shift()); assert.equal(result.total, -1); assert.equal(result.natural, 1); });
test('invalid expressions and excessive dice are rejected', () => { for (const expression of ['', '5', '0d20', '101d6', '1d1', 'd1001', '2d6 + alert(1)', '2d6++3', '1d6 1d8', '1d6+10001', '99d6+2d8']) assert.throws(() => parse(expression), expression); });
test('advantage cannot be used for mixed or multiple dice', () => { assert.throws(() => roll('2d20', 'advantage')); assert.throws(() => roll('1d20+1d6', 'advantage')); });
test('random dice stay within their bounds', () => { for (const sides of [4,6,8,10,12,20,100]) { const result = roll(`100d${sides}`); assert.ok(result.groups[0].values.every(n => n >= 1 && n <= sides)); } });
