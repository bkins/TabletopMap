(function (root) {
  'use strict';
  function randomDie(sides) {
    const range = 4294967296;
    const limit = range - range % sides;
    const buffer = new Uint32Array(1);
    do { root.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % sides + 1;
  }
  function parse(expression) {
    const source = expression.replace(/\s+/g, '').toLowerCase();
    if (!source || source.length > 200) throw new Error('Enter a roll like 1d20 + 5 or 2d6 + 1d8 + 3.');
    const matches = source.match(/[+-]?(?:\d*d\d+|\d+)/g);
    if (!matches || matches.join('') !== source) throw new Error('Use dice and whole-number modifiers joined with + or − (for example, 2d6 + 3).');
    let diceCount = 0;
    const terms = matches.map((token, index) => {
      if (index > 0 && !/^[+-]/.test(token)) throw new Error('Separate each dice group or modifier with + or −.');
      const sign = token.startsWith('-') ? -1 : 1;
      const value = token.replace(/^[+-]/, '');
      if (value.includes('d')) {
        const [countString, sidesString] = value.split('d');
        const count = countString === '' ? 1 : Number(countString);
        const sides = Number(sidesString);
        if (!Number.isSafeInteger(count) || count < 1 || count > 100 || !Number.isSafeInteger(sides) || sides < 2 || sides > 1000) throw new Error('Use 1–100 dice per group, with 2–1,000 sides.');
        diceCount += count;
        return { sign, count, sides };
      }
      const modifier = Number(value);
      if (!Number.isSafeInteger(modifier) || modifier > 10000) throw new Error('Each modifier must be between −10,000 and +10,000.');
      return { sign, modifier };
    });
    if (!diceCount || diceCount > 100) throw new Error('Include at least one die, and no more than 100 dice in a roll.');
    return terms;
  }
  function roll(expression, mode = 'normal', random = randomDie) {
    const terms = parse(expression);
    const diceTerms = terms.filter(term => term.sides);
    const eligible = diceTerms.length === 1 && diceTerms[0].count === 1 && diceTerms[0].sides === 20 && diceTerms[0].sign === 1;
    if (!['normal', 'advantage', 'disadvantage'].includes(mode)) throw new Error('Choose a valid roll mode.');
    if (mode !== 'normal' && !eligible) throw new Error('Advantage and disadvantage require a single d20, plus any modifiers.');
    let total = 0;
    const groups = terms.map(term => {
      if (!term.sides) { total += term.sign * term.modifier; return { ...term }; }
      const values = Array.from({ length: mode === 'normal' ? term.count : 2 }, () => random(term.sides));
      const kept = mode === 'normal' ? null : values.indexOf(mode === 'advantage' ? Math.max(...values) : Math.min(...values));
      const subtotal = kept === null ? values.reduce((a, b) => a + b, 0) : values[kept];
      total += term.sign * subtotal;
      return { ...term, values, kept };
    });
    return { expression: expression.trim(), mode, groups, total, natural: eligible ? groups.find(g => g.sides).values[groups.find(g => g.sides).kept ?? 0] : null };
  }
  root.ArcanaDice = { parse, roll };
  if (typeof module !== 'undefined') module.exports = root.ArcanaDice;
})(typeof globalThis !== 'undefined' ? globalThis : window);
