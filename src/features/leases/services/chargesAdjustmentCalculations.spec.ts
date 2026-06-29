import { describe, it, expect } from 'vitest';
import {
  computeCustomTotal,
  computeTotalCharges,
  computeRegulation,
} from './chargesAdjustmentCalculations';

describe('chargesAdjustmentCalculations', () => {
  describe('computeCustomTotal', () => {
    it('returns 0 when there are no custom charges', () => {
      expect(computeCustomTotal({ customCharges: undefined })).toBe(0);
      expect(computeCustomTotal({ customCharges: {} })).toBe(0);
    });

    it('sums all custom charge columns', () => {
      expect(computeCustomTotal({ customCharges: { Eau: 240, Chauffage: 810 } })).toBe(1050);
    });

    it('ignores non-numeric values', () => {
      expect(
        computeCustomTotal({ customCharges: { Eau: 100, Bad: NaN as unknown as number } })
      ).toBe(100);
    });
  });

  describe('computeTotalCharges', () => {
    it('uses the directly entered annualCharges when there is no breakdown', () => {
      expect(computeTotalCharges({ annualCharges: 1050, customCharges: {} }, false)).toBe(1050);
    });

    it('uses the sum of custom columns when a breakdown is used', () => {
      expect(
        computeTotalCharges(
          { annualCharges: 999, customCharges: { Eau: 240, Chauffage: 810 } },
          true
        )
      ).toBe(1050);
    });

    it('treats a missing annualCharges as 0', () => {
      expect(computeTotalCharges({ customCharges: {} }, false)).toBe(0);
    });
  });

  describe('computeRegulation', () => {
    // Spec scenario: provision 960 €, actual charges 1050 € → balance −90 € (tenant owes 90 €)
    it('returns a negative balance when the tenant owes additional charges', () => {
      expect(
        computeRegulation(
          { chargesProvisionPaid: 960, annualCharges: 1050, customCharges: {} },
          false
        )
      ).toBe(-90);
    });

    it('returns a positive balance (refund) when provisions exceed actual charges', () => {
      expect(
        computeRegulation(
          { chargesProvisionPaid: 1000, annualCharges: 800, customCharges: {} },
          false
        )
      ).toBe(200);
    });

    it('computes the balance from custom columns when a breakdown is used', () => {
      expect(
        computeRegulation(
          {
            chargesProvisionPaid: 960,
            annualCharges: 0,
            customCharges: { Eau: 240, Chauffage: 810 },
          },
          true
        )
      ).toBe(-90);
    });

    it('returns 0 when provisions exactly match charges', () => {
      expect(
        computeRegulation(
          { chargesProvisionPaid: 1050, annualCharges: 1050, customCharges: {} },
          false
        )
      ).toBe(0);
    });
  });
});
