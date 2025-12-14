import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { db } from '@/db/database';
import type { ChargesAdjustmentRow } from '@/db/types';

/**
 * Utilitaire pour charger un fichier en binaire
 */
async function loadBinary(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  return response.arrayBuffer();
}

/**
 * Interface pour les données de génération du courrier de régularisation
 */
export interface RegulationLetterData {
  year: number;
  provisionPaid: number;
  totalCharges: number;
  regulation: number;
  ownerAddress: string;
  date: string;
  tenantFullName: string;
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  propertyPostalCode: string;
  propertyTown: string;
}

/**
 * Interface pour les données de génération de l'attestation de remise des clés
 */
export interface KeyHandoverAttestationData {
  tenantFullName: string;
  propertyName: string;
  propertyAddress: string;
  propertyPostalCode: string;
  propertyTown: string;
  ownerAddress: string;
  ownerFullName: string;
  today: string;
}

/**
 * Génère un courrier de régularisation des charges au format DOCX
 * @param data - Données à insérer dans le template
 * @param templatePath - Chemin vers le template DOCX (par défaut: /templateRegulCharge.docx)
 * @returns Promise qui se résout une fois le fichier téléchargé
 */
export async function generateRegulationLetter(
  data: RegulationLetterData,
  templatePath: string = '/templateRegulCharge.docx'
): Promise<void> {
  try {
    const content = await loadBinary(templatePath);
    const zip = new PizZip(content as any);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render(data);

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filenameDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const filename = `${filenameDate}_courrierInfoRegulCharge.docx`;

    saveAs(out, filename);
  } catch (error) {
    console.error('Erreur génération courrier régularisation :', error);
    throw error;
  }
}

/**
 * Prépare les données pour la génération du courrier de régularisation
 * @param adjustmentRow - Ligne de régularisation des charges
 * @param computeCustomTotal - Fonction de calcul du total des charges personnalisées
 * @param computeRegulation - Fonction de calcul de la régularisation
 * @returns Promise contenant les données formatées pour le template
 */
export async function prepareRegulationLetterData(
  adjustmentRow: ChargesAdjustmentRow,
  computeCustomTotal: (row: ChargesAdjustmentRow) => number,
  computeRegulation: (row: ChargesAdjustmentRow) => number
): Promise<RegulationLetterData> {
  // Charger l'adresse de l'expéditeur depuis les settings
  let ownerAddress = '';
  let ownerFullName = '';
  try {
    const addressSetting = await db.settings.where('key').equals('senderAddress').first();
    if (addressSetting?.value) {
      ownerAddress = String(addressSetting.value);
    }
    const nameSetting = await db.settings.where('key').equals('senderName').first();
    if (nameSetting?.value) {
      ownerFullName = String(nameSetting.value);
    }
  } catch {
    // Ignorer si les clés n'existent pas
  }

  // Résoudre les informations du locataire et de la propriété
  let tenantFullName = '';
  let tenantName = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';

  try {
    const lease = await db.leases.get(adjustmentRow.leaseId);
    if (lease && Array.isArray((lease as any).tenantIds) && (lease as any).tenantIds.length > 0) {
      const tenantId = (lease as any).tenantIds[0];
      const tenant = await db.tenants.get(tenantId);
      if (tenant) {
        const civLabel = tenant.civility === 'mr' ? 'M.' : tenant.civility === 'mme' ? 'Mme' : '';
        tenantFullName =
          `${civLabel ? civLabel + ' ' : ''}${tenant.lastName} ${tenant.firstName}`.trim();
        tenantName = `${civLabel ? civLabel + ' ' : ''}${tenant.lastName}`.trim();
      }
    }

    // Résoudre les détails de la propriété
    if (lease && (lease as any).propertyId) {
      const property = await db.properties.get((lease as any).propertyId);
      if (property) {
        propertyName = property.name || '';
        propertyAddress = property.address || '';
        propertyPostalCode = (property as any).postalCode || '';
        propertyTown = (property as any).town || '';
      }
    }
  } catch (err) {
    console.error('Unable to resolve tenant/property for document generation', err);
  }

  return {
    year: adjustmentRow.year,
    provisionPaid: Number(adjustmentRow.chargesProvisionPaid) || 0,
    totalCharges: computeCustomTotal(adjustmentRow),
    regulation: computeRegulation(adjustmentRow),
    ownerAddress,
    ownerFullName,
    date: new Date().toLocaleDateString('fr-FR'),
    tenantFullName,
    tenantName,
    propertyName,
    propertyAddress,
    propertyPostalCode,
    propertyTown,
  };
}

/**
 * Génère une attestation de remise des clés au format DOCX
 * @param data - Données à insérer dans le template
 * @param templatePath - Chemin vers le template DOCX (par défaut: /templateAttestationRemiseDesCles.docx)
 * @returns Promise qui se résout une fois le fichier téléchargé
 */
export async function generateKeyHandoverAttestation(
  data: KeyHandoverAttestationData,
  templatePath: string = '/templateAttestationRemiseDesCles.docx'
): Promise<void> {
  try {
    const content = await loadBinary(templatePath);
    const zip = new PizZip(content as any);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render(data);

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filenameDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const filename = `${filenameDate}_attestationRemiseDesCles.docx`;

    saveAs(out, filename);
  } catch (error) {
    console.error('Erreur génération attestation remise des clés :', error);
    throw error;
  }
}

/**
 * Prépare les données pour la génération de l'attestation de remise des clés
 * @param leaseId - ID du bail
 * @returns Promise contenant les données formatées pour le template
 */
export async function prepareKeyHandoverAttestationData(
  leaseId: number
): Promise<KeyHandoverAttestationData> {
  // Charger l'adresse de l'expéditeur depuis les settings
  let ownerAddress = '';
  let ownerFullName = '';
  try {
    const addressSetting = await db.settings.where('key').equals('senderAddress').first();
    if (addressSetting?.value) {
      ownerAddress = String(addressSetting.value);
    }
    const nameSetting = await db.settings.where('key').equals('senderName').first();
    if (nameSetting?.value) {
      ownerFullName = String(nameSetting.value);
    }
  } catch {
    // Ignorer si les clés n'existent pas
  }

  // Résoudre les informations du locataire et de la propriété
  let tenantFullName = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';

  try {
    const lease = await db.leases.get(leaseId);
    if (lease && Array.isArray((lease as any).tenantIds) && (lease as any).tenantIds.length > 0) {
      const tenantId = (lease as any).tenantIds[0];
      const tenant = await db.tenants.get(tenantId);
      if (tenant) {
        const civLabel = tenant.civility === 'mr' ? 'M.' : tenant.civility === 'mme' ? 'Mme' : '';
        tenantFullName =
          `${civLabel ? civLabel + ' ' : ''}${tenant.lastName} ${tenant.firstName}`.trim();
      }
    }

    // Résoudre les détails de la propriété
    if (lease && (lease as any).propertyId) {
      const property = await db.properties.get((lease as any).propertyId);
      if (property) {
        propertyName = property.name || '';
        propertyAddress = property.address || '';
        propertyPostalCode = (property as any).postalCode || '';
        propertyTown = (property as any).town || '';
      }
    }
  } catch (err) {
    console.error('Unable to resolve tenant/property for attestation generation', err);
  }

  return {
    tenantFullName,
    propertyName,
    propertyAddress,
    propertyPostalCode,
    propertyTown,
    ownerAddress,
    ownerFullName,
    today: new Date().toLocaleDateString('fr-FR'),
  };
}

/**
 * Génère un document DOCX générique à partir d'un template
 * @param templatePath - Chemin vers le template DOCX
 * @param data - Données à insérer dans le template
 * @param filename - Nom du fichier généré
 * @returns Promise qui se résout une fois le fichier téléchargé
 */
export async function generateDocument(
  templatePath: string,
  data: Record<string, any>,
  filename: string
): Promise<void> {
  try {
    const content = await loadBinary(templatePath);
    const zip = new PizZip(content as any);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render(data);

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    saveAs(out, filename);
  } catch (error) {
    console.error(`Erreur génération document ${filename} :`, error);
    throw error;
  }
}
