// Runnable scratch check for applyUnifiedDiff.
// Compile with tsc then run: node out/test/unifiedDiff.test.js
import { applyUnifiedDiff, extractDiff, UnifiedDiffError } from '../unifiedDiff';

function assert(condition: boolean, message: string): void {
    if (!condition) { throw new Error(`FAIL: ${message}`); }
}

function assertEqual(actual: string, expected: string, message: string): void {
    if (actual !== expected) {
        throw new Error(`FAIL: ${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}

// --- Test 1: multi-hunk diff with @@ ... @@ headers ---
const source1 = [
    'def greet(name):',
    '    print("Hello, " + name)',
    '',
    'def farewell(name):',
    '    print("Goodbye, " + name)',
    '',
].join('\n');

const diff1 = [
    '```diff',
    '@@ -1,2 +1,2 @@',
    ' def greet(name):',
    '-    print("Hello, " + name)',
    '+    print(f"Hello, {name}")',
    '@@ -4,2 +4,2 @@',
    ' def farewell(name):',
    '-    print("Goodbye, " + name)',
    '+    print(f"Goodbye, {name}")',
    '```',
].join('\n');

const expected1 = [
    'def greet(name):',
    '    print(f"Hello, {name}")',
    '',
    'def farewell(name):',
    '    print(f"Goodbye, {name}")',
    '',
].join('\n');

const diffText1 = extractDiff(diff1);
assert(diffText1 !== null, 'extractDiff should find a diff block');
const result1 = applyUnifiedDiff(source1, diffText1!);
assertEqual(result1, expected1, 'multi-hunk diff applied correctly');

// --- Test 2: UnifiedDiffError thrown when hunk context does not match ---
const source2 = 'x = 1\ny = 2\n';
const badDiff = [
    '```diff',
    '@@ -1,1 +1,1 @@',
    ' z = 99',   // this line does not exist in source2
    '-x = 1',
    '+x = 10',
    '```',
].join('\n');

const diffText2 = extractDiff(badDiff);
assert(diffText2 !== null, 'extractDiff should find the bad diff block');
let threw = false;
try {
    applyUnifiedDiff(source2, diffText2!);
} catch (e) {
    assert(e instanceof UnifiedDiffError, 'should throw UnifiedDiffError');
    threw = true;
}
assert(threw, 'applyUnifiedDiff should throw when hunk does not match');

console.log('All unifiedDiff tests passed.');
