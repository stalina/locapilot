import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { db } from '@/db/database';
import type { ChargesAdjustmentRow, Tenant } from '@/db/types';

/**
 * Utilitaire pour charger un fichier en binaire
 */
async function loadBinary(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  return response.arrayBuffer();
}

/**
 * Joint une liste de chaînes avec des virgules, le dernier élément étant
 * séparé par « et » (ex: "A, B et C"). Les chaînes vides sont ignorées.
 */
function joinWithAnd(parts: string[]): string {
  const filtered = parts.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0]!;
  const last = filtered[filtered.length - 1]!;
  return `${filtered.slice(0, -1).join(', ')} et ${last}`;
}

/**
 * Informations agrégées de l'ensemble des locataires d'un bail.
 *
 * Un bail peut comporter plusieurs co-locataires (`tenantIds[]`). Les documents
 * générés (mandat, quittance, attestation, courrier de régularisation) doivent
 * lister TOUS les locataires, et non uniquement le premier.
 */
export interface ResolvedTenantsInfo {
  /** Noms complets de tous les locataires, ex: "M. Dupont Jean et Mme Martin Marie" */
  fullNames: string;
  /** Civilité + nom de famille de tous les locataires, ex: "M. Dupont et Mme Martin" */
  names: string;
  /** Emails de tous les locataires, séparés par des virgules */
  emails: string;
  /** Téléphones de tous les locataires, séparés par des virgules */
  phoneNumbers: string;
}

/**
 * Résout les informations agrégées de tous les locataires d'un bail à partir
 * de la liste de leurs identifiants.
 */
export async function resolveTenantsInfo(
  tenantIds: number[] | undefined
): Promise<ResolvedTenantsInfo> {
  const empty: ResolvedTenantsInfo = { fullNames: '', names: '', emails: '', phoneNumbers: '' };
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) return empty;

  const tenants = await db.tenants.bulkGet(tenantIds);
  const resolved = tenants.filter((t): t is Tenant => !!t);
  if (resolved.length === 0) return empty;

  const fullNamesList: string[] = [];
  const namesList: string[] = [];
  const emailsList: string[] = [];
  const phonesList: string[] = [];

  for (const tenant of resolved) {
    const civLabel = tenant.civility === 'mr' ? 'M.' : tenant.civility === 'mme' ? 'Mme' : '';
    const prefix = civLabel ? civLabel + ' ' : '';
    fullNamesList.push(`${prefix}${tenant.lastName} ${tenant.firstName}`.trim());
    namesList.push(`${prefix}${tenant.lastName}`.trim());
    if (tenant.email) emailsList.push(tenant.email);
    if (tenant.phone) phonesList.push(tenant.phone);
  }

  return {
    fullNames: joinWithAnd(fullNamesList),
    names: joinWithAnd(namesList),
    emails: emailsList.join(', '),
    phoneNumbers: phonesList.join(', '),
  };
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
  ownerEmail: string;
  ownerPhoneNumber: string;
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
  ownerEmail: string;
  ownerPhoneNumber: string;
  today: string;
}

/**
 * Interface pour les données de génération de quittance de loyer
 */
export interface RentReceiptData {
  ownerFullName: string;
  ownerAddress: string;
  ownerAddressInLine: string;
  ownerEmail?: string;
  ownerPhoneNumber?: string;
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
 * Interface pour les données de génération du courrier de révision de loyer (IRL)
 */
export interface RentRevisionLetterData {
  year: number;
  tenantName: string;
  tenantFullName: string;
  oldRent: string;
  newRent: string;
  previousIrlLabel: string;
  currentIrlLabel: string;
  previousIrl: string;
  currentIrl: string;
  charges: string;
  total: string;
  effectiveDate: string;
  today: string;
  // En-tête expéditeur (propriétaire) — aligné sur les autres templates
  ownerFullName: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerPhoneNumber: string;
  // Bloc bien loué
  propertyName: string;
  propertyAddress: string;
  propertyPostalCode: string;
  propertyTown: string;
}

/**
 * Données de la proposition de révision nécessaires à la génération du courrier.
 */
export interface RentRevisionInput {
  leaseId: number;
  year: number;
  referenceQuarter: 1 | 2 | 3 | 4;
  oldRent: number;
  newRent: number;
  currentIrl: number;
  previousIrl: number;
  charges: number;
  effectiveDate: Date;
}

/**
 * Prépare les données pour la génération du courrier de révision de loyer.
 */
export async function prepareRentRevisionLetterData(
  revision: RentRevisionInput
): Promise<RentRevisionLetterData> {
  let ownerFullName = '';
  let ownerAddress = '';
  let ownerEmail = '';
  let ownerPhoneNumber = '';
  try {
    const nameSetting = await db.settings.where('key').equals('senderName').first();
    if (nameSetting?.value) ownerFullName = String(nameSetting.value);
    const addressSetting = await db.settings.where('key').equals('senderAddress').first();
    if (addressSetting?.value) ownerAddress = String(addressSetting.value);
    const emailSetting = await db.settings.where('key').equals('senderEmail').first();
    if (emailSetting?.value) ownerEmail = String(emailSetting.value);
    const phoneSetting = await db.settings.where('key').equals('senderPhone').first();
    if (phoneSetting?.value) ownerPhoneNumber = String(phoneSetting.value);
  } catch {
    // Ignorer si les clés n'existent pas
  }

  let tenantName = '';
  let tenantFullName = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';
  try {
    const lease = await db.leases.get(revision.leaseId);
    if (lease) {
      const tenantsInfo = await resolveTenantsInfo(lease.tenantIds);
      tenantName = tenantsInfo.names;
      tenantFullName = tenantsInfo.fullNames;
      if (lease.propertyId) {
        const property = await db.properties.get(lease.propertyId);
        if (property) {
          propertyName = property.name || '';
          propertyAddress = property.address || '';
          propertyPostalCode = property.postalCode || '';
          propertyTown = property.town || '';
        }
      }
    }
  } catch (err) {
    console.error('Unable to resolve tenant/property for revision letter', err);
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR');
  const total = revision.newRent + revision.charges;

  return {
    year: revision.year,
    tenantName,
    tenantFullName,
    oldRent: fmt(revision.oldRent),
    newRent: fmt(revision.newRent),
    previousIrlLabel: `T${revision.referenceQuarter} ${revision.year - 1}`,
    currentIrlLabel: `T${revision.referenceQuarter} ${revision.year}`,
    previousIrl: fmt(revision.previousIrl),
    currentIrl: fmt(revision.currentIrl),
    charges: fmt(revision.charges),
    total: fmt(total),
    effectiveDate: new Date(revision.effectiveDate).toLocaleDateString('fr-FR'),
    today: new Date().toLocaleDateString('fr-FR'),
    ownerFullName,
    ownerAddress,
    ownerEmail,
    ownerPhoneNumber,
    propertyName,
    propertyAddress,
    propertyPostalCode,
    propertyTown,
  };
}

/**
 * Génère un courrier de révision de loyer (IRL) au format DOCX.
 */
export async function generateRentRevisionLetter(
  data: RentRevisionLetterData,
  templatePath: string = `${import.meta.env.BASE_URL}templateRevisionLoyer.docx`
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
    const filename = `${filenameDate}_revisionLoyer_${data.year}.docx`;

    return { blob: out, filename };
  } catch (error) {
    console.error('Erreur génération courrier de révision de loyer :', error);
    throw error;
  }
}

/**
 * Sauvegarde le courrier de révision de loyer dans la base documentaire.
 */
export async function saveRentRevisionLetterToDb(
  leaseId: number,
  year: number,
  blob: Blob,
  filename: string
): Promise<number> {
  const now = new Date();
  const documentId = await db.documents.add({
    name: filename,
    type: 'other',
    relatedEntityType: 'lease',
    relatedEntityId: leaseId,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: blob.size,
    data: blob,
    description: `Courrier révision loyer ${year}`,
    createdAt: now,
    updatedAt: now,
  } as any);

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
}

/**
 * Génère un courrier de régularisation des charges au format DOCX
 * @param data - Données à insérer dans le template
 * @param templatePath - Chemin vers le template DOCX (par défaut: /templateRegulCharge.docx)
 * @returns Promise qui se résout avec le Blob et le nom du fichier
 */
export async function generateRegulationLetter(
  data: RegulationLetterData,
  templatePath: string = `${import.meta.env.BASE_URL}templateRegulCharge.docx`
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
    const filename = `${filenameDate}_courrierInfoRegulCharge.docx`;

    return { blob: out, filename };
  } catch (error) {
    console.error('Erreur génération courrier régularisation :', error);
    throw error;
  }
}

/**
 * Sauvegarde le courrier de régularisation dans la base de données
 * @param leaseId - ID du bail
 * @param year - Année de régularisation
 * @param blob - Blob du document
 * @param filename - Nom du fichier
 * @returns Promise qui se résout avec l'ID du document créé
 */
export async function saveRegulationLetterToDb(
  leaseId: number,
  year: number,
  blob: Blob,
  filename: string
): Promise<number> {
  const now = new Date();
  const documentId = await db.documents.add({
    name: filename,
    type: 'other',
    relatedEntityType: 'lease',
    relatedEntityId: leaseId,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: blob.size,
    data: blob,
    description: `Courrier régularisation charges ${year}`,
    createdAt: now,
    updatedAt: now,
  } as any);

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
}

/**
 * Prépare les données pour la génération du courrier de régularisation
 * @param adjustmentRow - Ligne de régularisation des charges
 * @param computeTotalCharges - Fonction de calcul du total des charges réelles de l'année
 * @param computeRegulation - Fonction de calcul de la régularisation (provision − charges réelles)
 * @returns Promise contenant les données formatées pour le template
 */
export async function prepareRegulationLetterData(
  adjustmentRow: ChargesAdjustmentRow,
  computeTotalCharges: (row: ChargesAdjustmentRow) => number,
  computeRegulation: (row: ChargesAdjustmentRow) => number
): Promise<RegulationLetterData> {
  // Charger l'adresse de l'expéditeur depuis les settings
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

  // Résoudre les informations du locataire et de la propriété
  let tenantFullName = '';
  let tenantName = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';

  try {
    const lease = await db.leases.get(adjustmentRow.leaseId);
    if (lease) {
      const tenantsInfo = await resolveTenantsInfo((lease as any).tenantIds);
      tenantFullName = tenantsInfo.fullNames;
      tenantName = tenantsInfo.names;
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
    totalCharges: computeTotalCharges(adjustmentRow),
    regulation: computeRegulation(adjustmentRow),
    ownerAddress,
    ownerFullName,
    ownerEmail,
    ownerPhoneNumber,
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
  templatePath: string = `${import.meta.env.BASE_URL}templateAttestationRemiseDesCles.docx`
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

  // Résoudre les informations du locataire et de la propriété
  let tenantFullName = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';

  try {
    const lease = await db.leases.get(leaseId);
    if (lease) {
      const tenantsInfo = await resolveTenantsInfo((lease as any).tenantIds);
      tenantFullName = tenantsInfo.fullNames;
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
    ownerEmail,
    ownerPhoneNumber,
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
  templatePath: string = `${import.meta.env.BASE_URL}templateQuittanceDeLoyer.docx`
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
    // `totalPayedAmount` must represent the amount actually paid by the tenant.
    // Prefer explicit `paidAmount` when present. If not set but the rent status
    // indicates 'paid', fallback to the rent nominal amount + charges.
    if (typeof rent.paidAmount === 'number') {
      totalPayedAmount = rent.paidAmount;
    } else if (rent.status === 'paid') {
      totalPayedAmount = (rent.amount || 0) + (rent.charges || 0);
    } else {
      totalPayedAmount = 0;
    }

    // The `rentAmount` and `chargeAmount` used on the quittance should come from the
    // associated lease (mandat) when available. Use rent record as fallback.
    rentAmount = rent.amount || 0; // will be overwritten by lease.rent if lease exists
    chargeAmount = rent.charges || 0; // will be overwritten by lease.charges if lease exists

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
      // Prefer the contractual amounts from the lease (mandat)
      rentAmount = (lease as any).rent || rentAmount;
      chargeAmount = (lease as any).charges || chargeAmount;
      // Récupérer les locataires
      const tenantsInfo = await resolveTenantsInfo((lease as any).tenantIds);
      tenantFullName = tenantsInfo.fullNames;

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

  // Lire email et téléphone du propriétaire depuis les settings (optionnel)
  let ownerEmail = '';
  let ownerPhoneNumber = '';
  try {
    const emailSetting = await db.settings.where('key').equals('senderEmail').first();
    if (emailSetting?.value) ownerEmail = String(emailSetting.value);
    const phoneSetting = await db.settings.where('key').equals('senderPhone').first();
    if (phoneSetting?.value) ownerPhoneNumber = String(phoneSetting.value);
  } catch {
    // ignore
  }

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
    ownerEmail,
    ownerPhoneNumber,
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
  templatePath: string = `${import.meta.env.BASE_URL}templateMandatLocation.docx`
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

    // Récupérer les locataires
    const tenantsInfo = await resolveTenantsInfo((lease as any).tenantIds);
    tenantFullName = tenantsInfo.fullNames;
    tenantEmail = tenantsInfo.emails;
    tenantPhoneNumber = tenantsInfo.phoneNumbers;

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
