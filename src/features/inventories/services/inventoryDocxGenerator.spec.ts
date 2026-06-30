import { describe, it, expect } from 'vitest';
import PizZip from 'pizzip';
import {
  escapeXml,
  buildInventoryDocumentXml,
  buildInventoryDocxBlob,
  type InventoryDocModel,
} from './inventoryDocxGenerator';

function makeModel(overrides: Partial<InventoryDocModel> = {}): InventoryDocModel {
  return {
    type: 'checkin',
    number: '20260102',
    dateLabel: 'vendredi 2 janvier 2026',
    owner: {
      name: 'SCI Test',
      address: '1 rue des Tests',
      email: 'sci@test.fr',
      phone: '0102030405',
    },
    tenantFullNames: 'M. Dupont Jean',
    tenantEmails: 'jean@dupont.fr',
    property: {
      name: 'Studio Belleville',
      address: '12 rue de Belleville',
      postalCode: '75020',
      town: 'Paris',
      typeLabel: 'Studio',
    },
    rooms: [
      {
        name: 'Cuisine + séjour',
        items: [
          { label: 'Murs', condition: 'good', notes: 'RAS' },
          { label: 'Évier', condition: 'damaged', notes: 'Fissure' },
        ],
      },
    ],
    observations: 'Logement propre.',
    signature: {
      landlordAccepted: true,
      tenantAccepted: false,
      acceptedAtLabel: '02/01/2026 10:00',
    },
    ...overrides,
  };
}

describe('inventoryDocxGenerator', () => {
  describe('escapeXml', () => {
    it('escapes XML reserved characters', () => {
      expect(escapeXml('A & B < C > "D" \'E\'')).toBe(
        'A &amp; B &lt; C &gt; &quot;D&quot; &apos;E&apos;'
      );
    });
  });

  describe('buildInventoryDocumentXml', () => {
    it('produces a check-in document with the expected title and content', () => {
      const xml = buildInventoryDocumentXml(makeModel());
      expect(xml).toContain("CONSTAT D'ÉTAT DES LIEUX ENTRANT n°20260102");
      expect(xml).toContain('Propriétaire : SCI Test');
      expect(xml).toContain('Locataire : M. Dupont Jean');
      expect(xml).toContain('Studio Belleville');
      // room title + items
      expect(xml).toContain('1. Cuisine + séjour');
      expect(xml).toContain('Murs');
      expect(xml).toContain('Évier');
      // condition labels are translated
      expect(xml).toContain('Bon état');
      expect(xml).toContain('Détérioré');
      // signature
      expect(xml).toContain('Présent document accepté par le propriétaire : Oui');
      expect(xml).toContain('Présent document accepté par le locataire : Non');
      expect(xml).toContain('Acceptation horodatée le 02/01/2026 10:00');
    });

    it('uses SORTANT wording for a check-out document', () => {
      const xml = buildInventoryDocumentXml(makeModel({ type: 'checkout' }));
      expect(xml).toContain("CONSTAT D'ÉTAT DES LIEUX SORTANT n°20260102");
    });

    it('escapes special characters coming from user data', () => {
      const xml = buildInventoryDocumentXml(
        makeModel({
          rooms: [{ name: 'Salon & cie', items: [{ label: 'Mur <a>', condition: 'good' }] }],
        })
      );
      expect(xml).toContain('Salon &amp; cie');
      expect(xml).toContain('Mur &lt;a&gt;');
      expect(xml).not.toContain('<a>');
    });

    it('handles inventories without rooms', () => {
      const xml = buildInventoryDocumentXml(makeModel({ rooms: [] }));
      expect(xml).toContain("CONSTAT D'ÉTAT DES LIEUX");
      expect(xml).toContain('Signatures');
    });
  });

  describe('buildInventoryDocxBlob', () => {
    it('produces a valid docx archive containing the document part', async () => {
      const blob = buildInventoryDocxBlob(makeModel());
      expect(blob).toBeInstanceOf(Blob);

      const buffer = await blob.arrayBuffer();
      const zip = new PizZip(buffer);
      expect(zip.file('[Content_Types].xml')).toBeTruthy();
      expect(zip.file('_rels/.rels')).toBeTruthy();
      const docPart = zip.file('word/document.xml');
      expect(docPart).toBeTruthy();
      expect(docPart!.asText()).toContain("CONSTAT D'ÉTAT DES LIEUX ENTRANT");
    });
  });
});
