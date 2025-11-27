/**
 * Fonctions de formatage réutilisables
 */

/**
 * Formate un montant en devise (sans utiliser de composable)
 */
export function formatCurrency(amount: number | null | undefined, locale = 'fr-FR', currency = 'EUR'): string {
  if (amount === null || amount === undefined) return '—'
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Formate un nombre avec séparateurs de milliers
 */
export function formatNumber(num: number | null | undefined, decimals = 0, locale = 'fr-FR'): string {
  if (num === null || num === undefined) return '—'
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

/**
 * Formate une date au format court (ex: 27/11/2025)
 */
export function formatDate(date: Date | string | null | undefined, locale = 'fr-FR'): string {
  if (!date) return '—'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * Formate une date au format long (ex: 27 novembre 2025)
 */
export function formatDateLong(date: Date | string | null | undefined, locale = 'fr-FR'): string {
  if (!date) return '—'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/**
 * Formate une date avec heure (ex: 27/11/2025 à 14:30)
 */
export function formatDateTime(date: Date | string | null | undefined, locale = 'fr-FR'): string {
  if (!date) return '—'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Formate un numéro de téléphone français
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  
  // Nettoie le numéro
  const cleaned = phone.replace(/\D/g, '')
  
  // Format français: 06 12 34 56 78
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  }
  
  // Format international
  if (cleaned.length > 10) {
    return '+' + cleaned.slice(0, 2) + ' ' + cleaned.slice(2).replace(/(\d{2})/g, '$1 ').trim()
  }
  
  return phone
}

/**
 * Formate une surface en m²
 */
export function formatSurface(surface: number | null | undefined): string {
  if (surface === null || surface === undefined) return '—'
  return `${formatNumber(surface)} m²`
}

/**
 * Formate un pourcentage
 */
export function formatPercent(value: number | null | undefined, decimals = 0, locale = 'fr-FR'): string {
  if (value === null || value === undefined) return '—'
  
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100)
}

/**
 * Capitalise la première lettre d'une chaîne
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Tronque une chaîne avec ellipse
 */
export function truncate(str: string | null | undefined, maxLength = 50): string {
  if (!str) return ''
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Formate une taille de fichier
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Formate une adresse email (masque partiel)
 */
export function formatEmailPartial(email: string | null | undefined): string {
  if (!email) return '—'
  
  const [local, domain] = email.split('@')
  if (!domain) return email
  
  const maskedLocal = local.length > 3
    ? local.slice(0, 3) + '***'
    : local
  
  return `${maskedLocal}@${domain}`
}

/**
 * Formate un nom complet (Prénom NOM)
 */
export function formatFullName(firstName: string, lastName: string): string {
  return `${capitalize(firstName)} ${lastName.toUpperCase()}`
}

/**
 * Formate des initiales (ex: Jean Dupont => JD)
 */
export function formatInitials(firstName: string, lastName: string): string {
  const f = firstName?.charAt(0)?.toUpperCase() || ''
  const l = lastName?.charAt(0)?.toUpperCase() || ''
  return f + l
}

/**
 * Formate une durée en secondes vers format lisible (ex: 125 => "2m 5s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}
