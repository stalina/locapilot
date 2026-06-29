import { describe, it, expect } from 'vitest';
import {
  CONDITION_SCORE,
  CONDITION_LABEL,
  compareInventories,
  computeWearReport,
} from './inventoryComparison';
import type { Inventory, InventoryRoom } from '@/db/types';

function makeInventory(type: Inventory['type'], rooms: InventoryRoom[]): Inventory {
  return {
    leaseId: 1,
    type,
    date: new Date('2026-01-01'),
    rooms,
  };
}

describe('inventoryComparison', () => {
  describe('CONDITION_SCORE / CONDITION_LABEL', () => {
    it('orders conditions from best to worst', () => {
      expect(CONDITION_SCORE.excellent).toBeGreaterThan(CONDITION_SCORE.good);
      expect(CONDITION_SCORE.good).toBeGreaterThan(CONDITION_SCORE.fair);
      expect(CONDITION_SCORE.fair).toBeGreaterThan(CONDITION_SCORE.poor);
      expect(CONDITION_SCORE.poor).toBeGreaterThan(CONDITION_SCORE.damaged);
    });

    it('provides a French label for every condition', () => {
      expect(CONDITION_LABEL.good).toBe('Bon état');
      expect(CONDITION_LABEL.damaged).toBe('Détérioré');
    });
  });

  describe('compareInventories', () => {
    it('marks an unchanged item as unchanged', () => {
      const checkin = makeInventory('checkin', [
        { name: 'Séjour', items: [{ label: 'Murs', condition: 'good' }] },
      ]);
      const checkout = makeInventory('checkout', [
        { name: 'Séjour', items: [{ label: 'Murs', condition: 'good' }] },
      ]);

      const result = compareInventories(checkin, checkout);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.status).toBe('unchanged');
      expect(result.rows[0]!.delta).toBe(0);
      expect(result.hasDeterioration).toBe(false);
    });

    it('treats a single-level drop as normal wear', () => {
      const checkin = makeInventory('checkin', [
        { name: 'Séjour', items: [{ label: 'Sol', condition: 'excellent' }] },
      ]);
      const checkout = makeInventory('checkout', [
        { name: 'Séjour', items: [{ label: 'Sol', condition: 'good' }] },
      ]);

      const result = compareInventories(checkin, checkout);
      expect(result.rows[0]!.status).toBe('normal-wear');
      expect(result.rows[0]!.delta).toBe(-1);
      expect(result.hasDeterioration).toBe(false);
    });

    it('flags a two-level drop as deterioration', () => {
      const checkin = makeInventory('checkin', [
        { name: 'Cuisine', items: [{ label: 'Évier', condition: 'good' }] },
      ]);
      const checkout = makeInventory('checkout', [
        { name: 'Cuisine', items: [{ label: 'Évier', condition: 'poor' }] },
      ]);

      const result = compareInventories(checkin, checkout);
      expect(result.rows[0]!.status).toBe('deterioration');
      expect(result.rows[0]!.delta).toBe(-2);
      expect(result.hasDeterioration).toBe(true);
      expect(result.counts.deterioration).toBe(1);
    });

    it('marks an improvement as improved', () => {
      const checkin = makeInventory('checkin', [
        { name: 'Séjour', items: [{ label: 'Murs', condition: 'poor' }] },
      ]);
      const checkout = makeInventory('checkout', [
        { name: 'Séjour', items: [{ label: 'Murs', condition: 'good' }] },
      ]);

      const result = compareInventories(checkin, checkout);
      expect(result.rows[0]!.status).toBe('improved');
      expect(result.rows[0]!.delta).toBe(2);
    });

    it('detects items added at checkout and removed since checkin', () => {
      const checkin = makeInventory('checkin', [
        { name: 'Séjour', items: [{ label: 'Murs', condition: 'good' }] },
      ]);
      const checkout = makeInventory('checkout', [
        { name: 'Séjour', items: [{ label: 'Climatisation', condition: 'good' }] },
      ]);

      const result = compareInventories(checkin, checkout);
      const removed = result.rows.find(r => r.item === 'Murs');
      const added = result.rows.find(r => r.item === 'Climatisation');
      expect(removed!.status).toBe('removed');
      expect(added!.status).toBe('added');
    });

    it('matches items case-insensitively and trims whitespace', () => {
      const checkin = makeInventory('checkin', [
        { name: 'Séjour', items: [{ label: ' Murs ', condition: 'excellent' }] },
      ]);
      const checkout = makeInventory('checkout', [
        { name: 'séjour', items: [{ label: 'murs', condition: 'damaged' }] },
      ]);

      const result = compareInventories(checkin, checkout);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.status).toBe('deterioration');
    });

    it('handles inventories without rooms gracefully', () => {
      const checkin = makeInventory('checkin', []);
      const checkout = makeInventory('checkout', []);
      const result = compareInventories(checkin, checkout);
      expect(result.rows).toHaveLength(0);
      expect(result.hasDeterioration).toBe(false);
    });
  });

  describe('computeWearReport', () => {
    it('keeps only abnormal deteriorations, sorted by severity', () => {
      const checkin = makeInventory('checkin', [
        {
          name: 'Cuisine',
          items: [
            { label: 'Évier', condition: 'good' }, // -> poor : drop 2
            { label: 'Murs', condition: 'excellent' }, // -> good : drop 1 (normal)
            { label: 'Sol', condition: 'excellent' }, // -> damaged : drop 4
          ],
        },
      ]);
      const checkout = makeInventory('checkout', [
        {
          name: 'Cuisine',
          items: [
            { label: 'Évier', condition: 'poor' },
            { label: 'Murs', condition: 'good' },
            { label: 'Sol', condition: 'damaged' },
          ],
        },
      ]);

      const report = computeWearReport(checkin, checkout);
      expect(report.deterioratedCount).toBe(2);
      expect(report.totalItems).toBe(3);
      expect(report.items[0]!.item).toBe('Sol'); // biggest drop first
      expect(report.items[0]!.drop).toBe(4);
      expect(report.items[1]!.item).toBe('Évier');
    });

    it('returns an empty report when there is no abnormal wear', () => {
      const checkin = makeInventory('checkin', [
        { name: 'Séjour', items: [{ label: 'Murs', condition: 'good' }] },
      ]);
      const checkout = makeInventory('checkout', [
        { name: 'Séjour', items: [{ label: 'Murs', condition: 'good' }] },
      ]);

      const report = computeWearReport(checkin, checkout);
      expect(report.deterioratedCount).toBe(0);
      expect(report.items).toEqual([]);
    });
  });
});
