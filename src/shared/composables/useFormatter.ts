import { ref, computed } from 'vue'

/**
 * Composable pour formater différents types de valeurs
 * Dates, nombres, devises, téléphones, etc.
 */
export function useFormatter() {
  const locale = ref('fr-FR')
  const currency = ref('EUR')

  /**
   * Formate un montant en devise
   */
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '—'
    
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: currency.value,
    }).format(amount)
  }

  /**
   * Formate un nombre avec séparateurs de milliers
   */
  const formatNumber = (num: number | null | undefined, decimals = 0): string => {
    if (num === null || num === undefined) return '—'
    
    return new Intl.NumberFormat(locale.value, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num)
  }

  /**
   * Formate une date au format court (ex: 27/11/2025)
   */
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '—'
    
    const d = typeof date === 'string' ? new Date(date) : date
    
    return new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  }

  /**
   * Formate une date au format long (ex: 27 novembre 2025)
   */
  const formatDateLong = (date: Date | string | null | undefined): string => {
    if (!date) return '—'
    
    const d = typeof date === 'string' ? new Date(date) : date
    
    return new Intl.DateTimeFormat(locale.value, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  }

  /**
   * Formate une date avec heure (ex: 27/11/2025 à 14:30)
   */
  const formatDateTime = (date: Date | string | null | undefined): string => {
    if (!date) return '—'
    
    const d = typeof date === 'string' ? new Date(date) : date
    
    return new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }

  /**
   * Formate une date relative (ex: il y a 2 jours, dans 3 semaines)
   */
  const formatRelativeDate = (date: Date | string | null | undefined): string => {
    if (!date) return '—'
    
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Aujourd'hui"
    if (diffDays === 1) return 'Demain'
    if (diffDays === -1) return 'Hier'
    
    if (diffDays > 0) {
      if (diffDays < 7) return `Dans ${diffDays} jours`
      if (diffDays < 30) return `Dans ${Math.floor(diffDays / 7)} semaines`
      if (diffDays < 365) return `Dans ${Math.floor(diffDays / 30)} mois`
      return `Dans ${Math.floor(diffDays / 365)} ans`
    } else {
      const absDays = Math.abs(diffDays)
      if (absDays < 7) return `Il y a ${absDays} jours`
      if (absDays < 30) return `Il y a ${Math.floor(absDays / 7)} semaines`
      if (absDays < 365) return `Il y a ${Math.floor(absDays / 30)} mois`
      return `Il y a ${Math.floor(absDays / 365)} ans`
    }
  }

  /**
   * Formate un numéro de téléphone français
   */
  const formatPhone = (phone: string | null | undefined): string => {
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
  const formatSurface = (surface: number | null | undefined): string => {
    if (surface === null || surface === undefined) return '—'
    return `${formatNumber(surface)} m²`
  }

  /**
   * Formate un pourcentage
   */
  const formatPercent = (value: number | null | undefined, decimals = 0): string => {
    if (value === null || value === undefined) return '—'
    
    return new Intl.NumberFormat(locale.value, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value / 100)
  }

  /**
   * Capitalise la première lettre d'une chaîne
   */
  const capitalize = (str: string | null | undefined): string => {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  /**
   * Tronque une chaîne avec ellipse
   */
  const truncate = (str: string | null | undefined, maxLength = 50): string => {
    if (!str) return ''
    if (str.length <= maxLength) return str
    return str.slice(0, maxLength - 3) + '...'
  }

  return {
    // State
    locale: computed(() => locale.value),
    currency: computed(() => currency.value),
    
    // Methods
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateLong,
    formatDateTime,
    formatRelativeDate,
    formatPhone,
    formatSurface,
    formatPercent,
    capitalize,
    truncate,
  }
}
