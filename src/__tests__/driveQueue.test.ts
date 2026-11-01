import {
  buildTeaserText,
  getDrivePhase,
  resetDriveQueue,
} from '../services/driveQueue';

describe('buildTeaserText', () => {
  it('includes eta, side, and title', () => {
    const text = buildTeaserText({
      title: 'Knossos',
      etaMin: 3,
      side: 'right',
    });
    expect(text).toContain('3');
    expect(text).toContain('Knossos');
    expect(text.toLowerCase()).toMatch(/right|desno/);
  });
});

describe('resetDriveQueue', () => {
  it('returns to idle', () => {
    resetDriveQueue();
    expect(getDrivePhase()).toBe('idle');
  });
});
