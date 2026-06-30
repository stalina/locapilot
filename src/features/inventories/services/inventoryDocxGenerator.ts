import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { db } from '@/db/database';
import type { Inventory, Property } from '@/db/types';
import { CONDITION_LABEL } from './inventoryComparison';
import { resolveTenantsInfo } from '@/shared/services/documentGenerator';

/**
 * Génération d'un document Word (.docx) d'état des lieux d'entrée / de sortie
 * (issue #46). Le document est construit programmatiquement en WordprocessingML
 * (OOXML) puis empaqueté avec PizZip — pas de template binaire à maintenir.
 *
 * La mise en page reprend la structure d'un constat d'état des lieux réel :
 * titre, parties, bien loué, un tableau par pièce (Élément / État / Commentaire),
 * légende des états, observations et signatures.
 */

export interface InventoryDocOwner {
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface InventoryDocProperty {
  name: string;
  address: string;
  postalCode: string;
  town: string;
  typeLabel: string;
}

export interface InventoryDocModel {
  type: 'checkin' | 'checkout';
  number: string;
  dateLabel: string;
  owner: InventoryDocOwner;
  tenantFullNames: string;
  tenantEmails: string;
  property: InventoryDocProperty | null;
  rooms: { name: string; items: { label: string; condition: string; notes?: string }[] }[];
  observations?: string;
  signature?: { landlordAccepted: boolean; tenantAccepted: boolean; acceptedAtLabel?: string };
}

const PROPERTY_TYPE_LABELS: Record<Property['type'], string> = {
  apartment: 'Appartement',
  house: 'Maison',
  studio: 'Studio',
  commercial: 'Local commercial',
  parking: 'Parking',
  other: 'Autre',
};

/** Échappe les caractères réservés XML (y compris guillemets, pour attributs). */
export function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Échappe le contenu textuel d'un nœud XML. Dans un nœud texte, seuls `& < >`
 * doivent être échappés ; les apostrophes/guillemets restent lisibles.
 */
function escapeText(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Transforme un texte (avec retours à la ligne) en runs OOXML. */
function runs(text: string, rPr = ''): string {
  const parts = String(text ?? '').split('\n');
  return parts
    .map((part, i) => {
      const br = i < parts.length - 1 ? '<w:br/>' : '';
      return `<w:r>${rPr}<w:t xml:space="preserve">${escapeText(part)}</w:t>${br}</w:r>`;
    })
    .join('');
}

interface ParagraphOpts {
  bold?: boolean;
  size?: number; // demi-points (24 = 12pt)
  align?: 'left' | 'center' | 'right';
  color?: string;
  spacingAfter?: number; // twips
}

function paragraph(text: string, opts: ParagraphOpts = {}): string {
  const rPrParts: string[] = [];
  if (opts.bold) rPrParts.push('<w:b/>');
  if (opts.size) rPrParts.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`);
  if (opts.color) rPrParts.push(`<w:color w:val="${opts.color}"/>`);
  const rPr = rPrParts.length ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';

  const pPrParts: string[] = [];
  if (opts.align) pPrParts.push(`<w:jc w:val="${opts.align}"/>`);
  if (opts.spacingAfter !== undefined) pPrParts.push(`<w:spacing w:after="${opts.spacingAfter}"/>`);
  const pPr = pPrParts.length ? `<w:pPr>${pPrParts.join('')}</w:pPr>` : '';

  return `<w:p>${pPr}${runs(text, rPr)}</w:p>`;
}

function emptyParagraph(): string {
  return '<w:p/>';
}

function tableCell(text: string, widthDxa: number, opts: { header?: boolean } = {}): string {
  const shd = opts.header ? '<w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/>' : '';
  const rPr = opts.header ? '<w:rPr><w:b/></w:rPr>' : '';
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/>${shd}</w:tcPr>` +
    `<w:p>${runs(text, rPr)}</w:p></w:tc>`
  );
}

const ROOM_COLS = [4500, 1800, 2726]; // Élément / État / Commentaire (somme = 9026 dxa)

function roomTable(room: InventoryDocModel['rooms'][number]): string {
  const borders =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`)
      .join('') +
    '</w:tblBorders>';

  const grid = ROOM_COLS.map(w => `<w:gridCol w:w="${w}"/>`).join('');

  const headerRow =
    '<w:tr>' +
    tableCell('Élément', ROOM_COLS[0]!, { header: true }) +
    tableCell('État', ROOM_COLS[1]!, { header: true }) +
    tableCell('Commentaire', ROOM_COLS[2]!, { header: true }) +
    '</w:tr>';

  const rows = room.items
    .map(item => {
      const condition =
        CONDITION_LABEL[item.condition as keyof typeof CONDITION_LABEL] ?? item.condition;
      return (
        '<w:tr>' +
        tableCell(item.label, ROOM_COLS[0]!) +
        tableCell(condition, ROOM_COLS[1]!) +
        tableCell(item.notes ?? '', ROOM_COLS[2]!) +
        '</w:tr>'
      );
    })
    .join('');

  return (
    '<w:tbl>' +
    `<w:tblPr><w:tblW w:w="9026" w:type="dxa"/>${borders}</w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>` +
    headerRow +
    rows +
    '</w:tbl>'
  );
}

/** Construit le contenu de word/document.xml pour un état des lieux. */
export function buildInventoryDocumentXml(model: InventoryDocModel): string {
  const isCheckin = model.type === 'checkin';
  const kindLabel = isCheckin ? 'ENTRANT' : 'SORTANT';

  const body: string[] = [];

  // En-tête
  body.push(
    paragraph(`CONSTAT D'ÉTAT DES LIEUX ${kindLabel} n°${model.number}`, {
      bold: true,
      size: 30,
      align: 'center',
    })
  );
  body.push(paragraph(`du ${model.dateLabel}`, { align: 'center', size: 24 }));
  body.push(
    paragraph("LOCAUX VIDES À USAGE D'HABITATION", { align: 'center', bold: true, size: 22 })
  );
  body.push(paragraph('Dressé contradictoirement entre les soussignés :', { spacingAfter: 120 }));

  // Parties
  body.push(paragraph(`Propriétaire : ${model.owner.name || '—'}`, { bold: true }));
  if (model.owner.address) body.push(paragraph(model.owner.address));
  body.push(paragraph(`Locataire : ${model.tenantFullNames || '—'}`, { bold: true }));
  if (model.tenantEmails) body.push(paragraph(model.tenantEmails));
  body.push(emptyParagraph());

  // I. Bien loué
  body.push(paragraph('I. Bien loué', { bold: true, size: 26 }));
  if (model.property) {
    body.push(paragraph(`Type : ${model.property.typeLabel}`));
    const addressLine = [
      model.property.name,
      model.property.address,
      [model.property.postalCode, model.property.town].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ');
    body.push(paragraph(`Adresse : ${addressLine || model.property.name}`));
  } else {
    body.push(paragraph('Adresse : —'));
  }
  body.push(emptyParagraph());

  // Pièces
  model.rooms.forEach((room, index) => {
    body.push(paragraph(`${index + 1}. ${room.name}`, { bold: true, size: 24 }));
    if (room.items.length > 0) {
      body.push(roomTable(room));
    } else {
      body.push(paragraph('Aucun élément renseigné.'));
    }
    body.push(emptyParagraph());
  });

  // Légende
  body.push(paragraph('Légende des états', { bold: true, size: 22 }));
  body.push(paragraph(Object.values(CONDITION_LABEL).join(' • '), { size: 20, color: '555555' }));
  body.push(emptyParagraph());

  // Observations
  if (model.observations) {
    body.push(paragraph('Observations générales', { bold: true, size: 22 }));
    body.push(paragraph(model.observations));
    body.push(emptyParagraph());
  }

  // Signatures
  body.push(paragraph('Signatures', { bold: true, size: 26 }));
  body.push(
    paragraph(
      "Les soussignés reconnaissent exactes les constatations sur l'état du logement et " +
        's’accordent pour y faire référence.',
      { spacingAfter: 120 }
    )
  );
  const sig = model.signature;
  body.push(
    paragraph(
      `Présent document accepté par le propriétaire : ${sig?.landlordAccepted ? 'Oui' : 'Non'}`
    )
  );
  body.push(
    paragraph(`Présent document accepté par le locataire : ${sig?.tenantAccepted ? 'Oui' : 'Non'}`)
  );
  if (sig?.acceptedAtLabel) {
    body.push(paragraph(`Acceptation horodatée le ${sig.acceptedAtLabel}`));
  }

  const sectPr =
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1440" w:bottom="1134" w:left="1440" ' +
    'w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body.join('')}${sectPr}</w:body></w:document>`
  );
}

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

/** Empaquette le modèle en une archive .docx (Blob). */
export function buildInventoryDocxBlob(model: InventoryDocModel): Blob {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', RELS_XML);
  zip.file('word/document.xml', buildInventoryDocumentXml(model));
  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}

function slug(value: string): string {
  return (value || 'logement')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Construit le modèle de document à partir d'un état des lieux en résolvant
 * le bail, la propriété, les locataires et les coordonnées du propriétaire.
 */
export async function prepareInventoryDocModel(inventory: Inventory): Promise<InventoryDocModel> {
  const owner: InventoryDocOwner = { name: '', address: '', email: '', phone: '' };
  try {
    const nameSetting = await db.settings.where('key').equals('senderName').first();
    if (nameSetting?.value) owner.name = String(nameSetting.value);
    const addressSetting = await db.settings.where('key').equals('senderAddress').first();
    if (addressSetting?.value) owner.address = String(addressSetting.value);
    const emailSetting = await db.settings.where('key').equals('senderEmail').first();
    if (emailSetting?.value) owner.email = String(emailSetting.value);
    const phoneSetting = await db.settings.where('key').equals('senderPhone').first();
    if (phoneSetting?.value) owner.phone = String(phoneSetting.value);
  } catch {
    // settings absents : on garde des valeurs vides
  }

  let tenantFullNames = '';
  let tenantEmails = '';
  let property: InventoryDocProperty | null = null;
  try {
    const lease = await db.leases.get(inventory.leaseId);
    if (lease) {
      const info = await resolveTenantsInfo(lease.tenantIds);
      tenantFullNames = info.fullNames;
      tenantEmails = info.emails;
      if (lease.propertyId) {
        const p = await db.properties.get(lease.propertyId);
        if (p) {
          property = {
            name: p.name || '',
            address: p.address || '',
            postalCode: p.postalCode || '',
            town: p.town || '',
            typeLabel: PROPERTY_TYPE_LABELS[p.type] ?? 'Autre',
          };
        }
      }
    }
  } catch (err) {
    console.error('Unable to resolve lease/property for inventory document', err);
  }

  const date = new Date(inventory.date);
  const dateLabel = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const number = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`;

  return {
    type: inventory.type,
    number,
    dateLabel,
    owner,
    tenantFullNames,
    tenantEmails,
    property,
    rooms: (inventory.rooms ?? []).map(r => ({
      name: r.name,
      items: r.items.map(i => ({ label: i.label, condition: i.condition, notes: i.notes })),
    })),
    ...(inventory.observations ? { observations: inventory.observations } : {}),
    ...(inventory.signature
      ? {
          signature: {
            landlordAccepted: inventory.signature.landlordAccepted,
            tenantAccepted: inventory.signature.tenantAccepted,
            ...(inventory.signature.acceptedAt
              ? {
                  acceptedAtLabel: new Date(inventory.signature.acceptedAt).toLocaleString('fr-FR'),
                }
              : {}),
          },
        }
      : {}),
  };
}

/** Génère et télécharge le document Word d'un état des lieux. */
export async function generateInventoryDocx(inventory: Inventory): Promise<void> {
  const model = await prepareInventoryDocModel(inventory);
  const blob = buildInventoryDocxBlob(model);

  const date = new Date(inventory.date);
  const filenameDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
  const kind = inventory.type === 'checkin' ? 'entree' : 'sortie';
  const propertySlug = slug(model.property?.name ?? '');
  saveAs(blob, `${filenameDate}_etatDesLieux_${kind}_${propertySlug}.docx`);
}
