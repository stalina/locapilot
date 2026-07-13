import { saveAs } from 'file-saver';
import { db } from '@/db/database';
import type {
  ChargesAdjustmentRow,
  Inventory,
  InventoryCondition,
  ReminderLevel,
  Tenant,
} from '@/db/types';

/**
 * Utilitaire pour charger un fichier en binaire
 */
async function loadBinary(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  return response.arrayBuffer();
}

/**
 * Rend un template DOCX avec les données fournies et renvoie le Blob résultant.
 *
 * `pizzip` et `docxtemplater` sont chargés dynamiquement (dynamic `import()`)
 * uniquement lors du premier appel : ils sont ainsi code-splittés dans un chunk
 * séparé, hors du bundle initial, et ne sont téléchargés qu'au moment de générer
 * un document. Le chunk reste précaché par le service worker Workbox
 * (globPatterns inclut les fichiers JS), donc la génération fonctionne hors ligne.
 */
async function renderDocxTemplate(content: ArrayBuffer, data: unknown): Promise<Blob> {
  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
    import('pizzip'),
    import('docxtemplater'),
  ]);

  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  doc.render(data);

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
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
    const out = await renderDocxTemplate(content, data);

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
  });

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
    const out = await renderDocxTemplate(content, data);

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
  });

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
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
      const tenantsInfo = await resolveTenantsInfo(lease.tenantIds);
      tenantFullName = tenantsInfo.fullNames;
      tenantName = tenantsInfo.names;
    }

    // Résoudre les détails de la propriété
    if (lease && lease.propertyId) {
      const property = await db.properties.get(lease.propertyId);
      if (property) {
        propertyName = property.name || '';
        propertyAddress = property.address || '';
        propertyPostalCode = property.postalCode || '';
        propertyTown = property.town || '';
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
    const out = await renderDocxTemplate(content, data);

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
  });

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
      const tenantsInfo = await resolveTenantsInfo(lease.tenantIds);
      tenantFullName = tenantsInfo.fullNames;
    }

    // Résoudre les détails de la propriété
    if (lease && lease.propertyId) {
      const property = await db.properties.get(lease.propertyId);
      if (property) {
        propertyName = property.name || '';
        propertyAddress = property.address || '';
        propertyPostalCode = property.postalCode || '';
        propertyTown = property.town || '';
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
    const out = await renderDocxTemplate(content, data);

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
      rentAmount = lease.rent || rentAmount;
      chargeAmount = lease.charges || chargeAmount;
      // Récupérer les locataires
      const tenantsInfo = await resolveTenantsInfo(lease.tenantIds);
      tenantFullName = tenantsInfo.fullNames;

      // Récupérer la propriété
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
  data: Record<string, unknown>,
  filename: string
): Promise<void> {
  try {
    const content = await loadBinary(templatePath);
    const out = await renderDocxTemplate(content, data);

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
    const out = await renderDocxTemplate(content, data);

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
  });

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
    const tenantsInfo = await resolveTenantsInfo(lease.tenantIds);
    tenantFullName = tenantsInfo.fullNames;
    tenantEmail = tenantsInfo.emails;
    tenantPhoneNumber = tenantsInfo.phoneNumbers;

    // Récupérer la propriété
    if (lease.propertyId) {
      const property = await db.properties.get(lease.propertyId);
      if (property) {
        propertyName = property.name || '';
        propertyAddress = property.address || '';
        propertyPostalCode = property.postalCode || '';
        propertyTown = property.town || '';
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

// ========== Dépôt de garantie : réception & restitution — issue #104 ==========

/** Charge les coordonnées du propriétaire (expéditeur) depuis les settings. */
async function loadOwnerInfo(): Promise<{
  ownerFullName: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerPhoneNumber: string;
}> {
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
  return { ownerFullName, ownerAddress, ownerEmail, ownerPhoneNumber };
}

const EUR = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Données du reçu de dépôt de garantie + 1er loyer. */
export interface DepositReceptionData {
  ownerFullName: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerPhoneNumber: string;
  tenantFullName: string;
  propertyName: string;
  propertyAddress: string;
  propertyPostalCode: string;
  propertyTown: string;
  depositAmount: string;
  firstMonthRent: string;
  charges: string;
  totalReceived: string;
  totalReceivedInLetterUppercase: string;
  receptionDate: string;
  today: string;
}

/** Données du document de restitution de dépôt de garantie. */
export interface DepositRestitutionData {
  ownerFullName: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerPhoneNumber: string;
  tenantFullName: string;
  propertyName: string;
  propertyAddress: string;
  propertyPostalCode: string;
  propertyTown: string;
  originalDeposit: string;
  returnedAmount: string;
  returnedAmountInLetterUppercase: string;
  deductions: string;
  restitutionDate: string;
  today: string;
}

/**
 * Prépare les données du reçu de dépôt de garantie + 1er loyer à partir d'un bail.
 * Le montant total reçu = dépôt + loyer + charges (1er mois).
 */
export async function prepareDepositReceptionData(leaseId: number): Promise<DepositReceptionData> {
  const owner = await loadOwnerInfo();

  let tenantFullName = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';
  let depositAmount = 0;
  let firstMonthRent = 0;
  let charges = 0;
  let receptionDate = '';

  const lease = await db.leases.get(leaseId);
  if (!lease) throw new Error('Lease not found');

  depositAmount = lease.deposit || 0;
  firstMonthRent = lease.rent || 0;
  charges = lease.charges || 0;
  if (lease.depositReceivedDate) {
    receptionDate = new Date(lease.depositReceivedDate).toLocaleDateString('fr-FR');
  }

  const tenantsInfo = await resolveTenantsInfo(lease.tenantIds);
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

  const total = depositAmount + firstMonthRent + charges;

  return {
    ownerFullName: owner.ownerFullName,
    ownerAddress: owner.ownerAddress,
    ownerEmail: owner.ownerEmail,
    ownerPhoneNumber: owner.ownerPhoneNumber,
    tenantFullName,
    propertyName,
    propertyAddress,
    propertyPostalCode,
    propertyTown,
    depositAmount: EUR(depositAmount),
    firstMonthRent: EUR(firstMonthRent),
    charges: EUR(charges),
    totalReceived: EUR(total),
    totalReceivedInLetterUppercase: numberToLetters(total).toUpperCase(),
    receptionDate,
    today: new Date().toLocaleDateString('fr-FR'),
  };
}

/**
 * Prépare les données du document de restitution du dépôt de garantie à partir
 * d'un bail. Les déductions = dépôt d'origine − montant restitué (jamais négatif).
 */
export async function prepareDepositRestitutionData(
  leaseId: number
): Promise<DepositRestitutionData> {
  const owner = await loadOwnerInfo();

  let tenantFullName = '';
  let propertyName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';
  let originalDeposit = 0;
  let returnedAmount = 0;
  let restitutionDate = '';

  const lease = await db.leases.get(leaseId);
  if (!lease) throw new Error('Lease not found');

  originalDeposit = lease.deposit || 0;
  returnedAmount =
    typeof lease.depositReturnedAmount === 'number' ? lease.depositReturnedAmount : 0;
  if (lease.depositReturnedDate) {
    restitutionDate = new Date(lease.depositReturnedDate).toLocaleDateString('fr-FR');
  }

  const tenantsInfo = await resolveTenantsInfo(lease.tenantIds);
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

  const deductions = Math.max(0, originalDeposit - returnedAmount);

  return {
    ownerFullName: owner.ownerFullName,
    ownerAddress: owner.ownerAddress,
    ownerEmail: owner.ownerEmail,
    ownerPhoneNumber: owner.ownerPhoneNumber,
    tenantFullName,
    propertyName,
    propertyAddress,
    propertyPostalCode,
    propertyTown,
    originalDeposit: EUR(originalDeposit),
    returnedAmount: EUR(returnedAmount),
    returnedAmountInLetterUppercase: numberToLetters(returnedAmount).toUpperCase(),
    deductions: EUR(deductions),
    restitutionDate,
    today: new Date().toLocaleDateString('fr-FR'),
  };
}

/**
 * Génère le reçu de dépôt de garantie + 1er loyer au format DOCX à partir du
 * template `templateReceptionDepot.docx`.
 */
export async function generateDepositReceptionReceipt(
  data: DepositReceptionData,
  templatePath: string = `${import.meta.env.BASE_URL}templateReceptionDepot.docx`
): Promise<{ blob: Blob; filename: string }> {
  try {
    const content = await loadBinary(templatePath);
    const out = await renderDocxTemplate(content, data);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filenameDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const filename = `${filenameDate}_recuDepotGarantie.docx`;

    return { blob: out, filename };
  } catch (error) {
    console.error('Erreur génération reçu dépôt de garantie :', error);
    throw error;
  }
}

/** Sauvegarde le reçu de dépôt de garantie dans la base documentaire, associé au bail. */
export async function saveDepositReceptionToDb(
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
    description: 'Reçu dépôt de garantie et 1er loyer',
    createdAt: now,
    updatedAt: now,
  });

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
}

/**
 * Génère le document de restitution du dépôt de garantie au format DOCX à partir
 * du template `templateRestitutionDepot.docx`.
 */
export async function generateDepositRestitutionDocument(
  data: DepositRestitutionData,
  templatePath: string = `${import.meta.env.BASE_URL}templateRestitutionDepot.docx`
): Promise<{ blob: Blob; filename: string }> {
  try {
    const content = await loadBinary(templatePath);
    const out = await renderDocxTemplate(content, data);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filenameDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const filename = `${filenameDate}_restitutionDepotGarantie.docx`;

    return { blob: out, filename };
  } catch (error) {
    console.error('Erreur génération restitution dépôt de garantie :', error);
    throw error;
  }
}

/** Sauvegarde le document de restitution du dépôt dans la base, associé au bail. */
export async function saveDepositRestitutionToDb(
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
    description: 'Restitution dépôt de garantie',
    createdAt: now,
    updatedAt: now,
  });

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
}

// ========== État des lieux (entrée / sortie) — issue #46 ==========

/**
 * Libellés français des conditions, alignés sur
 * `features/inventories/services/inventoryComparison.ts` (source de vérité).
 */
const INVENTORY_CONDITION_LABELS: Record<InventoryCondition, string> = {
  excellent: 'Excellent',
  good: 'Bon état',
  fair: 'État moyen',
  poor: 'Mauvais état',
  damaged: 'Détérioré',
};

export interface EtatDesLieuxData {
  type: 'checkin' | 'checkout';
  kindLabel: string; // ENTRANT | SORTANT
  number: string;
  dateLabel: string;
  ownerName: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerPhone: string;
  tenantFullNames: string;
  tenantEmails: string;
  propertyType: string;
  propertyAddress: string;
  rooms: { name: string; items: { label: string; condition: string; notes: string }[] }[];
  legend: string;
  observations: string;
  landlordAccepted: string; // Oui | Non
  tenantAccepted: string; // Oui | Non
  hasAcceptedAt: boolean;
  acceptedAtLabel: string;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  studio: 'Studio',
  commercial: 'Local commercial',
  parking: 'Parking',
  other: 'Autre',
};

/**
 * Prépare les données du template d'état des lieux à partir d'un état des lieux
 * (résout bail, locataires, propriété et coordonnées du propriétaire).
 */
export async function prepareEtatDesLieuxData(inventory: Inventory): Promise<EtatDesLieuxData> {
  let ownerName = '';
  let ownerAddress = '';
  let ownerEmail = '';
  let ownerPhone = '';
  try {
    const nameSetting = await db.settings.where('key').equals('senderName').first();
    if (nameSetting?.value) ownerName = String(nameSetting.value);
    const addressSetting = await db.settings.where('key').equals('senderAddress').first();
    if (addressSetting?.value) ownerAddress = String(addressSetting.value);
    const emailSetting = await db.settings.where('key').equals('senderEmail').first();
    if (emailSetting?.value) ownerEmail = String(emailSetting.value);
    const phoneSetting = await db.settings.where('key').equals('senderPhone').first();
    if (phoneSetting?.value) ownerPhone = String(phoneSetting.value);
  } catch {
    // settings absents : valeurs vides
  }

  let tenantFullNames = '';
  let tenantEmails = '';
  let propertyType = '';
  let propertyAddress = '';
  try {
    const lease = await db.leases.get(inventory.leaseId);
    if (lease) {
      const info = await resolveTenantsInfo(lease.tenantIds);
      tenantFullNames = info.fullNames;
      tenantEmails = info.emails;
      if (lease.propertyId) {
        const property = await db.properties.get(lease.propertyId);
        if (property) {
          propertyType = PROPERTY_TYPE_LABELS[property.type] ?? 'Autre';
          propertyAddress = [
            property.name,
            property.address,
            [property.postalCode, property.town].filter(Boolean).join(' '),
          ]
            .filter(Boolean)
            .join(', ');
        }
      }
    }
  } catch (err) {
    console.error('Unable to resolve lease/property for inventory document', err);
  }

  const date = new Date(inventory.date);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateLabel = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const number = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;

  const rooms = (inventory.rooms ?? []).map(room => ({
    name: room.name,
    items: room.items.map(item => ({
      label: item.label,
      condition: INVENTORY_CONDITION_LABELS[item.condition] ?? item.condition,
      notes: item.notes ?? '',
    })),
  }));

  const sig = inventory.signature;

  return {
    type: inventory.type,
    kindLabel: inventory.type === 'checkin' ? 'ENTRANT' : 'SORTANT',
    number,
    dateLabel,
    ownerName,
    ownerAddress,
    ownerEmail,
    ownerPhone,
    tenantFullNames,
    tenantEmails,
    propertyType,
    propertyAddress,
    rooms,
    legend: Object.values(INVENTORY_CONDITION_LABELS).join(' • '),
    observations: inventory.observations ?? '',
    landlordAccepted: sig?.landlordAccepted ? 'Oui' : 'Non',
    tenantAccepted: sig?.tenantAccepted ? 'Oui' : 'Non',
    hasAcceptedAt: !!sig?.acceptedAt,
    acceptedAtLabel: sig?.acceptedAt ? new Date(sig.acceptedAt).toLocaleString('fr-FR') : '',
  };
}

/**
 * Génère le document d'état des lieux (entrée/sortie) au format DOCX à partir
 * du template `templateEtatDesLieux.docx`.
 */
export async function generateEtatDesLieux(
  data: EtatDesLieuxData,
  templatePath: string = `${import.meta.env.BASE_URL}templateEtatDesLieux.docx`
): Promise<{ blob: Blob; filename: string }> {
  try {
    const content = await loadBinary(templatePath);
    const out = await renderDocxTemplate(content, data);

    const kind = data.type === 'checkin' ? 'entree' : 'sortie';
    const filename = `${data.number}_etatDesLieux_${kind}.docx`;

    return { blob: out, filename };
  } catch (error) {
    console.error('Erreur génération état des lieux :', error);
    throw error;
  }
}

/** Sauvegarde le document d'état des lieux dans la base, associé au bail. */
export async function saveEtatDesLieuxToDb(
  leaseId: number,
  blob: Blob,
  filename: string,
  type: 'checkin' | 'checkout'
): Promise<number> {
  const now = new Date();
  const description = type === 'checkin' ? "État des lieux d'entrée" : 'État des lieux de sortie';
  const documentId = await db.documents.add({
    name: filename,
    type: 'inventory',
    relatedEntityType: 'lease',
    relatedEntityId: leaseId,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: blob.size,
    data: blob,
    description,
    createdAt: now,
    updatedAt: now,
  });

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
}

/**
 * Interface pour les données de génération d'un courrier de relance d'impayé
 */
export interface ReminderLetterData {
  levelLabel: string;
  ownerFullName: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerPhoneNumber: string;
  date: string;
  tenantFullName: string;
  propertyAddress: string;
  propertyPostalCode: string;
  propertyTown: string;
  dueDate: string;
  rentPeriodLabel: string;
  amountDue: string;
  daysLate: number;
}

/** Libellé humain + fichier de template par défaut, pour chaque niveau de relance */
const REMINDER_LEVEL_INFO: Record<ReminderLevel, { label: string; template: string }> = {
  amiable: { label: 'Relance amiable', template: 'templateRelanceAmiable.docx' },
  recommandee: { label: 'Relance recommandée', template: 'templateRelanceRecommandee.docx' },
  'mise-en-demeure': { label: 'Mise en demeure', template: 'templateMiseEnDemeure.docx' },
};

/**
 * Prépare les données pour la génération d'un courrier de relance d'impayé
 * @param rentId - ID du loyer impayé
 * @param level - Niveau de relance (amiable, recommandée, mise en demeure)
 */
export async function prepareReminderLetterData(
  rentId: number,
  level: ReminderLevel
): Promise<ReminderLetterData> {
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

  let tenantFullName = '';
  let propertyAddress = '';
  let propertyPostalCode = '';
  let propertyTown = '';
  let dueDate = '';
  let rentPeriodLabel = '';
  let amountDue = '';
  let daysLate = 0;

  const rent = await db.rents.get(rentId);
  if (!rent) throw new Error('Rent not found');

  try {
    const lease = await db.leases.get(rent.leaseId);
    if (lease) {
      const tenantsInfo = await resolveTenantsInfo(lease.tenantIds);
      tenantFullName = tenantsInfo.fullNames;
      if (lease.propertyId) {
        const property = await db.properties.get(lease.propertyId);
        if (property) {
          propertyAddress = property.address || '';
          propertyPostalCode = property.postalCode || '';
          propertyTown = property.town || '';
        }
      }
    }
  } catch (err) {
    console.error('Unable to resolve tenant/property for reminder letter', err);
  }

  const due = new Date(rent.dueDate);
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
  rentPeriodLabel = `${monthNames[due.getMonth()] || 'janvier'} ${due.getFullYear()}`;
  dueDate = due.toLocaleDateString('fr-FR');

  const now = new Date();
  daysLate = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));

  const remaining = (rent.amount || 0) + (rent.charges || 0) - (rent.paidAmount || 0);
  amountDue = remaining.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    levelLabel: REMINDER_LEVEL_INFO[level].label,
    ownerFullName,
    ownerAddress,
    ownerEmail,
    ownerPhoneNumber,
    date: now.toLocaleDateString('fr-FR'),
    tenantFullName,
    propertyAddress,
    propertyPostalCode,
    propertyTown,
    dueDate,
    rentPeriodLabel,
    amountDue,
    daysLate,
  };
}

/**
 * Génère un courrier de relance d'impayé (amiable / recommandée / mise en demeure) au format DOCX.
 *
 * Le texte des 3 modèles est une rédaction de bon effort et ne constitue pas un
 * conseil juridique — à faire relire avant tout envoi réel, en particulier pour
 * la mise en demeure.
 */
export async function generateReminderLetter(
  data: ReminderLetterData,
  level: ReminderLevel,
  templatePath: string = `${import.meta.env.BASE_URL}${REMINDER_LEVEL_INFO[level].template}`
): Promise<{ blob: Blob; filename: string }> {
  try {
    const content = await loadBinary(templatePath);
    const out = await renderDocxTemplate(content, data);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filenameDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const filename = `${filenameDate}_relance_${level}.docx`;

    return { blob: out, filename };
  } catch (error) {
    console.error('Erreur génération courrier de relance :', error);
    throw error;
  }
}

/**
 * Sauvegarde le courrier de relance dans la base documentaire.
 */
export async function saveReminderLetterToDb(
  rentId: number,
  level: ReminderLevel,
  blob: Blob,
  filename: string
): Promise<number> {
  const now = new Date();
  const documentId = await db.documents.add({
    name: filename,
    type: 'other',
    relatedEntityType: 'rent',
    relatedEntityId: rentId,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: blob.size,
    data: blob,
    description: REMINDER_LEVEL_INFO[level].label,
    createdAt: now,
    updatedAt: now,
  });

  if (!documentId) {
    throw new Error('Failed to save document to database');
  }

  return documentId;
}
