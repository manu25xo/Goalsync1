/**
 * Compute progress score based on UoM type
 */
function computeScore(uom, targetValue, actualValue) {
  if (actualValue === null || actualValue === undefined || actualValue === '') return null;
  const target = parseFloat(targetValue);
  const actual = parseFloat(actualValue);

  switch (uom) {
    case 'Numeric':
    case 'Min':
    case '%':
      if (!target) return null;
      return Math.min(100, parseFloat(((actual / target) * 100).toFixed(2)));
    case 'Max':
      if (!actual) return null;
      return Math.min(100, parseFloat(((target / actual) * 100).toFixed(2)));
    case 'Zero':
      return actual === 0 ? 100 : 0;
    case 'Timeline': {
      if (!targetValue || !actualValue) return null;
      const deadline = new Date(targetValue);
      const completion = new Date(actualValue);
      return completion <= deadline ? 100 : 0;
    }
    default:
      return null;
  }
}

module.exports = { computeScore };
