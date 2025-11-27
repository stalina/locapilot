/**
 * Utilitaires pour la manipulation de dates
 */

/**
 * Ajoute un nombre de jours à une date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Ajoute un nombre de mois à une date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Ajoute un nombre d'années à une date
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + years)
  return result
}

/**
 * Calcule la différence en jours entre deux dates
 */
export function diffInDays(date1: Date, date2: Date): number {
  const oneDay = 1000 * 60 * 60 * 24
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  return Math.ceil(diffTime / oneDay)
}

/**
 * Calcule la différence en mois entre deux dates
 */
export function diffInMonths(date1: Date, date2: Date): number {
  const years = date2.getFullYear() - date1.getFullYear()
  const months = date2.getMonth() - date1.getMonth()
  return years * 12 + months
}

/**
 * Retourne le premier jour du mois
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Retourne le dernier jour du mois
 */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * Retourne le premier jour de l'année
 */
export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

/**
 * Retourne le dernier jour de l'année
 */
export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31)
}

/**
 * Vérifie si une date est dans le passé
 */
export function isPast(date: Date): boolean {
  return date < new Date()
}

/**
 * Vérifie si une date est dans le futur
 */
export function isFuture(date: Date): boolean {
  return date > new Date()
}

/**
 * Vérifie si une date est aujourd'hui
 */
export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * Vérifie si deux dates sont le même jour
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

/**
 * Vérifie si deux dates sont dans le même mois
 */
export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

/**
 * Vérifie si une date est entre deux autres dates
 */
export function isBetween(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

/**
 * Formate une date en ISO string (YYYY-MM-DD)
 */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Parse une date ISO string (YYYY-MM-DD)
 */
export function fromISODate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00')
}

/**
 * Retourne le nombre de jours dans un mois
 */
export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Retourne le nom du mois en français
 */
export function getMonthName(date: Date, short = false): string {
  const months = short
    ? ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
    : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  
  return months[date.getMonth()]
}

/**
 * Retourne le nom du jour en français
 */
export function getDayName(date: Date, short = false): string {
  const days = short
    ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    : ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  
  return days[date.getDay()]
}

/**
 * Retourne un tableau de dates pour un mois donné
 */
export function getMonthDates(date: Date): Date[] {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const dates: Date[] = []
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d))
  }
  
  return dates
}

/**
 * Calcule l'âge à partir d'une date de naissance
 */
export function calculateAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
}

/**
 * Vérifie si une année est bissextile
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}
