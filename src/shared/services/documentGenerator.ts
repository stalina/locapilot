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
 * Convertit un nombre en lettres (en français)
 */
function numberToLetters(num: number): string {
  if (num === 0) return 'zéro';

  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = [
    'dix',
    'onze',
    'douze',
    'treize',
    'quatorze',
    'quinze',
    'seize',
    'dix-sept',
    'dix-huit',
    'dix-neuf',
  ];
  const tens = [
    '',
    '',
    'vingt',
    'trente',
    'quarante',
    'cinquante',
    'soixante',
    'soixante',
    'quatre-vingt',
    'quatre-vingt',
  ];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';

    let result = '';

    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;

    if (hundreds > 0) {
      if (hundreds === 1) {
        result += 'cent';
      } else {
        result += units[hundreds] + ' cent';
      }
      if (remainder === 0 && hundreds > 1) result += 's';
    }

    if (remainder > 0) {
      if (result) result += ' ';

      if (remainder < 10) {
        result += units[remainder];
      } else if (remainder < 20) {
        result += teens[remainder - 10];
      } else {
        const tensDigit = Math.floor(remainder / 10);
        const unitsDigit = remainder % 10;

        if (tensDigit === 7 || tensDigit === 9) {
          result += tens[tensDigit];
          if (remainder >= 70 && remainder < 80) {
            result += '-' + teens[unitsDigit];
          } else if (remainder >= 90) {
            result += '-' + teens[unitsDigit];
          }
        } else {
          result += tens[tensDigit];
          if (unitsDigit === 1 && tensDigit !== 8) {
            result += ' et un';
          } else if (unitsDigit > 1) {
            result += '-' + units[unitsDigit];
          } else if (unitsDigit === 0 && tensDigit === 8) {
            result += 's';
          }
        }
      }
    }

    return result;
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = '';

  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    result += convertLessThanThousand(millions) + ' million';
    if (millions > 1) result += 's';
  }

  const remainder = integerPart % 1000000;
  if (remainder >= 1000) {
    if (result) result += ' ';
    const thousands = Math.floor(remainder / 1000);
    if (thousands === 1) {
      result += 'mille';
    } else {
      result += convertLessThanThousand(thousands) + ' mille';
    }
  }

  const lastPart = remainder % 1000;
  if (lastPart > 0) {
    if (result) result += ' ';
    result += convertLessThanThousand(lastPart);
  }

  result += ' euro';
  if (integerPart > 1) result += 's';

  if (decimalPart > 0) {
    result += ' et ' + convertLessThanThousand(decimalPart) + ' centime';
    if (decimalPart > 1) result += 's';
  }

  return result;
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
  ownerFullName: string;
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
 * Interface pour les données de génération de quittance de loyer
 */
export interface RentReceiptData {
  ownerFullName: string;
  ownerAddress: string;
  ownerAddressInLine: string;
  tenantFullName: string;
  propertyName: string;
  propertyAddress: string;
  propertyPostalCode: string;
  propertyTown: string;
  month: string;
  year: number;
  totalPayedAmount: number;
  totalPayedAmountInLetterUppercase: string;
  rentAmount: number;
  chargeAmount: number;
  paymentDate: string;
  today: string;
}

/**
 * Interface pour les données de génération du mandat de location
 */
export interface MandatLocationData {
  ownerFullName: string;
  ownerAddress: string;
  ownerAddressInLine: string;
  ownerEmail: string;
  ownerPhoneNumber: string;
  tenantFullName: string;
  tenantEmail: string;
  tenantPhoneNumber: string;
  propertyName: string;
  propertyAddress: string;
  propertyPostalCode: string;
  propertyTown: string;
  propertySurface: number;
  propertyNumberOfRooms: number;
  month: string;
  year: number;
  totalPayedAmount: number;
  totalPayedAmountInLetterUppercase: string;
  rentAmount: number;
  chargeAmount: number;
  paymentDate: string;
  rentStart: string;
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
 * @returns Promise qui se résout avec le Blob et le nom du fichier
 */
export async function generateKeyHandoverAttestation(
  data: KeyHandoverAttestationData,
  templatePath: string = '/templateAttestationRemiseDesCles.docx'
): Promise<{ blob: Blob; filename: string }> {
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

    return { blob: out, filename };
  } catch (error) {
    console.error('Erreur génération attestation remise des clés :', error);
    throw error;
  }
}

/**
 * Sauvegarde l'attestation de remise des clés dans la base de données
 * @param leaseId - ID du bail
 * @param blob - Blob du document
 * @param filename - Nom du fichier
 * @returns Promise qui se résout avec l'ID du document créé
 */
export async function saveKeyHandoverAttestationToDb(
  leaseId: number,
  blob: Blob,
  filename: string
): Promise<number> {
  const now = new Date();
  const documentId = await db.documents.add({
    name: filename,
    type: 'lease',
    relatedEntityType: 'lease',
    relatedEntityId: leaseId,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: blob.size,
    data: blob,
    description: 'Attestation de remise des clés',
    createdAt: now,
    updatedAt: now,
  } as any);

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
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
 * Génère une quittance de loyer au format DOCX
 * @param data - Données à insérer dans le template
 * @param templatePath - Chemin vers le template DOCX (par défaut: /templateQuittanceDeLoyer.docx)
 * @returns Promise qui se résout une fois le fichier téléchargé
 */
export async function generateRentReceipt(
  data: RentReceiptData,
  templatePath: string = '/templateQuittanceDeLoyer.docx'
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
    const filename = `${filenameDate}_quittanceLoyer.docx`;

    saveAs(out, filename);
  } catch (error) {
    console.error('Erreur génération quittance de loyer :', error);
    throw error;
  }
}

/**
 * Prépare les données pour la génération de quittance de loyer
 * @param rentId - ID du loyer
 * @returns Promise contenant les données formatées pour le template
 */
export async function prepareRentReceiptData(rentId: number): Promise<RentReceiptData> {
  // Charger les informations du propriétaire depuis les settings
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

  // Résoudre les informations du loyer, locataire et propriété
  let tenantFullName = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';
  let month = '';
  let year = 0;
  let totalPayedAmount = 0;
  let rentAmount = 0;
  let chargeAmount = 0;
  let paymentDate = '';

  try {
    const rent = await db.rents.get(rentId);
    if (!rent) throw new Error('Rent not found');

    // Montants
    totalPayedAmount = rent.paidAmount || rent.amount + (rent.charges || 0);
    rentAmount = rent.amount || 0;
    chargeAmount = rent.charges || 0;

    // Date de paiement
    if (rent.paidDate) {
      paymentDate = new Date(rent.paidDate).toLocaleDateString('fr-FR');
    }

    // Mois et année du loyer
    const dueDate = new Date(rent.dueDate);
    year = dueDate.getFullYear();
    const monthNames = [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ];
    month = monthNames[dueDate.getMonth()] || 'janvier';

    // Récupérer le bail
    const lease = await db.leases.get(rent.leaseId);
    if (lease) {
      // Récupérer le locataire
      if (Array.isArray((lease as any).tenantIds) && (lease as any).tenantIds.length > 0) {
        const tenantId = (lease as any).tenantIds[0];
        const tenant = await db.tenants.get(tenantId);
        if (tenant) {
          const civLabel = tenant.civility === 'mr' ? 'M.' : tenant.civility === 'mme' ? 'Mme' : '';
          tenantFullName =
            `${civLabel ? civLabel + ' ' : ''}${tenant.lastName} ${tenant.firstName}`.trim();
        }
      }

      // Récupérer la propriété
      if ((lease as any).propertyId) {
        const property = await db.properties.get((lease as any).propertyId);
        if (property) {
          propertyName = property.name || '';
          propertyAddress = property.address || '';
          propertyPostalCode = (property as any).postalCode || '';
          propertyTown = (property as any).town || '';
        }
      }
    }
  } catch (err) {
    console.error('Unable to resolve rent/tenant/property for receipt generation', err);
    throw err;
  }

  // Adresse en ligne (remplacer les retours à la ligne par des espaces)
  const ownerAddressInLine = ownerAddress.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Montant en lettres majuscules
  const totalPayedAmountInLetterUppercase = numberToLetters(totalPayedAmount).toUpperCase();

  return {
    ownerFullName,
    ownerAddress,
    ownerAddressInLine,
    tenantFullName,
    propertyName,
    propertyAddress,
    propertyPostalCode,
    propertyTown,
    month,
    year,
    totalPayedAmount,
    totalPayedAmountInLetterUppercase,
    rentAmount,
    chargeAmount,
    paymentDate,
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

/**
 * Génère un mandat de location au format DOCX
 * @param data - Données à insérer dans le template
 * @param templatePath - Chemin vers le template DOCX (par défaut: /templateMandatLocation.docx)
 * @returns Promise qui se résout avec le Blob et le nom du fichier
 */
export async function generateMandatLocation(
  data: MandatLocationData,
  templatePath: string = '/templateMandatLocation.docx'
): Promise<{ blob: Blob; filename: string }> {
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
    const filename = `${filenameDate}_mandatLocation.docx`;

    return { blob: out, filename };
  } catch (error) {
    console.error('Erreur génération mandat de location :', error);
    throw error;
  }
}

/**
 * Sauvegarde le mandat de location dans la base de données
 * @param leaseId - ID du bail
 * @param blob - Blob du document
 * @param filename - Nom du fichier
 * @returns Promise qui se résout avec l'ID du document créé
 */
export async function saveMandatLocationToDb(
  leaseId: number,
  blob: Blob,
  filename: string
): Promise<number> {
  const now = new Date();
  const documentId = await db.documents.add({
    name: filename,
    type: 'lease',
    relatedEntityType: 'lease',
    relatedEntityId: leaseId,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: blob.size,
    data: blob,
    description: 'Mandat de location',
    createdAt: now,
    updatedAt: now,
  } as any);

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
}

/**
 * Télécharge un blob sur le poste client
 * @param blob - Blob à télécharger
 * @param filename - Nom du fichier
 */
export function downloadBlob(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}

/**
 * Prépare les données pour la génération du mandat de location
 * @param leaseId - ID du bail
 * @returns Promise contenant les données formatées pour le template
 */
export async function prepareMandatLocationData(leaseId: number): Promise<MandatLocationData> {
  // Charger les informations du propriétaire depuis les settings
  let ownerAddress = '';
  let ownerFullName = '';
  let ownerEmail = '';
  let ownerPhoneNumber = '';

  try {
    const addressSetting = await db.settings.where('key').equals('senderAddress').first();
    if (addressSetting?.value) {
      ownerAddress = String(addressSetting.value);
    }
    const nameSetting = await db.settings.where('key').equals('senderName').first();
    if (nameSetting?.value) {
      ownerFullName = String(nameSetting.value);
    }
    const emailSetting = await db.settings.where('key').equals('senderEmail').first();
    if (emailSetting?.value) {
      ownerEmail = String(emailSetting.value);
    }
    const phoneSetting = await db.settings.where('key').equals('senderPhone').first();
    if (phoneSetting?.value) {
      ownerPhoneNumber = String(phoneSetting.value);
    }
  } catch {
    // Ignorer si les clés n'existent pas
  }

  // Résoudre les informations du bail, locataire et propriété
  let tenantFullName = '';
  let tenantEmail = '';
  let tenantPhoneNumber = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';
  let propertySurface = 0;
  let propertyNumberOfRooms = 0;
  let month = '';
  let year = 0;
  let totalPayedAmount = 0;
  let rentAmount = 0;
  let chargeAmount = 0;
  let paymentDate = '';
  let rentStart = '';

  try {
    const lease = await db.leases.get(leaseId);
    if (!lease) throw new Error('Lease not found');

    // Montants du loyer
    rentAmount = lease.rent || 0;
    chargeAmount = lease.charges || 0;
    totalPayedAmount = rentAmount + chargeAmount;

    // Date de début du bail
    if (lease.startDate) {
      rentStart = new Date(lease.startDate).toLocaleDateString('fr-FR');
    }

    // Jour de paiement
    paymentDate = String(lease.paymentDay || 1);

    // Mois et année actuels pour le document
    const now = new Date();
    year = now.getFullYear();
    const monthNames = [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ];
    month = monthNames[now.getMonth()] || 'janvier';

    // Récupérer le locataire
    if (Array.isArray((lease as any).tenantIds) && (lease as any).tenantIds.length > 0) {
      const tenantId = (lease as any).tenantIds[0];
      const tenant = await db.tenants.get(tenantId);
      if (tenant) {
        const civLabel = tenant.civility === 'mr' ? 'M.' : tenant.civility === 'mme' ? 'Mme' : '';
        tenantFullName =
          `${civLabel ? civLabel + ' ' : ''}${tenant.lastName} ${tenant.firstName}`.trim();
        tenantEmail = tenant.email || '';
        tenantPhoneNumber = tenant.phone || '';
      }
    }

    // Récupérer la propriété
    if ((lease as any).propertyId) {
      const property = await db.properties.get((lease as any).propertyId);
      if (property) {
        propertyName = property.name || '';
        propertyAddress = property.address || '';
        propertyPostalCode = (property as any).postalCode || '';
        propertyTown = (property as any).town || '';
        propertySurface = property.surface || 0;
        propertyNumberOfRooms = property.rooms || 0;
      }
    }
  } catch (err) {
    console.error('Unable to resolve lease/tenant/property for mandat generation', err);
    throw err;
  }

  // Adresse en ligne (remplacer les retours à la ligne par des espaces)
  const ownerAddressInLine = ownerAddress.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Montant en lettres majuscules
  const totalPayedAmountInLetterUppercase = numberToLetters(totalPayedAmount).toUpperCase();

  return {
    ownerFullName,
    ownerAddress,
    ownerAddressInLine,
    ownerEmail,
    ownerPhoneNumber,
    tenantFullName,
    tenantEmail,
    tenantPhoneNumber,
    propertyName,
    propertyAddress,
    propertyPostalCode,
    propertyTown,
    propertySurface,
    propertyNumberOfRooms,
    month,
    year,
    totalPayedAmount,
    totalPayedAmountInLetterUppercase,
    rentAmount,
    chargeAmount,
    paymentDate,
    rentStart,
    today: new Date().toLocaleDateString('fr-FR'),
  };
}
