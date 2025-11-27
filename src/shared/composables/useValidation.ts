/**
 * Composable pour la validation de formulaires
 * Fournit des règles de validation réutilisables
 */

export type ValidationRule = (value: any) => string | true;

export function useValidation() {
  // Règles de validation basiques
  const required = (message = 'Ce champ est requis'): ValidationRule => {
    return (value: any) => {
      if (value === null || value === undefined || value === '') {
        return message;
      }
      if (Array.isArray(value) && value.length === 0) {
        return message;
      }
      return true;
    };
  };

  const email = (message = 'Email invalide'): ValidationRule => {
    return (value: string) => {
      if (!value) return true; // Skip validation if empty (use required() separately)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) || message;
    };
  };

  const phone = (message = 'Numéro de téléphone invalide'): ValidationRule => {
    return (value: string) => {
      if (!value) return true;
      // French phone format: 06 12 34 56 78 or 0612345678 or +33612345678
      const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
      return phoneRegex.test(value) || message;
    };
  };

  const minLength = (min: number, message?: string): ValidationRule => {
    return (value: string) => {
      if (!value) return true;
      const msg = message || `Minimum ${min} caractères`;
      return value.length >= min || msg;
    };
  };

  const maxLength = (max: number, message?: string): ValidationRule => {
    return (value: string) => {
      if (!value) return true;
      const msg = message || `Maximum ${max} caractères`;
      return value.length <= max || msg;
    };
  };

  const min = (minValue: number, message?: string): ValidationRule => {
    return (value: number) => {
      if (value === null || value === undefined) return true;
      const msg = message || `Valeur minimale: ${minValue}`;
      return Number(value) >= minValue || msg;
    };
  };

  const max = (maxValue: number, message?: string): ValidationRule => {
    return (value: number) => {
      if (value === null || value === undefined) return true;
      const msg = message || `Valeur maximale: ${maxValue}`;
      return Number(value) <= maxValue || msg;
    };
  };

  const pattern = (regex: RegExp, message = 'Format invalide'): ValidationRule => {
    return (value: string) => {
      if (!value) return true;
      return regex.test(value) || message;
    };
  };

  const numeric = (message = 'Doit être un nombre'): ValidationRule => {
    return (value: any) => {
      if (value === null || value === undefined || value === '') return true;
      return !isNaN(Number(value)) || message;
    };
  };

  const integer = (message = 'Doit être un nombre entier'): ValidationRule => {
    return (value: any) => {
      if (value === null || value === undefined || value === '') return true;
      return Number.isInteger(Number(value)) || message;
    };
  };

  const positive = (message = 'Doit être positif'): ValidationRule => {
    return (value: number) => {
      if (value === null || value === undefined) return true;
      return Number(value) > 0 || message;
    };
  };

  const positiveOrZero = (message = 'Doit être positif ou zéro'): ValidationRule => {
    return (value: number) => {
      if (value === null || value === undefined) return true;
      return Number(value) >= 0 || message;
    };
  };

  const url = (message = 'URL invalide'): ValidationRule => {
    return (value: string) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return message;
      }
    };
  };

  const date = (message = 'Date invalide'): ValidationRule => {
    return (value: string) => {
      if (!value) return true;
      const timestamp = Date.parse(value);
      return !isNaN(timestamp) || message;
    };
  };

  const dateBefore = (beforeDate: Date | string, message?: string): ValidationRule => {
    return (value: string) => {
      if (!value) return true;
      const inputDate = new Date(value);
      const compareDate = new Date(beforeDate);
      const msg = message || `Doit être avant le ${compareDate.toLocaleDateString('fr-FR')}`;
      return inputDate < compareDate || msg;
    };
  };

  const dateAfter = (afterDate: Date | string, message?: string): ValidationRule => {
    return (value: string) => {
      if (!value) return true;
      const inputDate = new Date(value);
      const compareDate = new Date(afterDate);
      const msg = message || `Doit être après le ${compareDate.toLocaleDateString('fr-FR')}`;
      return inputDate > compareDate || msg;
    };
  };

  const fileSize = (maxSizeInMB: number, message?: string): ValidationRule => {
    return (file: File) => {
      if (!file) return true;
      const msg = message || `Taille maximale: ${maxSizeInMB} MB`;
      const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
      return file.size <= maxSizeInBytes || msg;
    };
  };

  const fileType = (allowedTypes: string[], message?: string): ValidationRule => {
    return (file: File) => {
      if (!file) return true;
      const msg = message || `Types autorisés: ${allowedTypes.join(', ')}`;
      return allowedTypes.includes(file.type) || msg;
    };
  };

  // Fonction utilitaire pour valider une valeur contre plusieurs règles
  const validate = (value: any, rules: ValidationRule[]): string | true => {
    for (const rule of rules) {
      const result = rule(value);
      if (result !== true) {
        return result;
      }
    }
    return true;
  };

  // Fonction utilitaire pour valider un objet complet
  const validateForm = <T extends Record<string, any>>(
    formData: T,
    rules: Record<keyof T, ValidationRule[]>
  ): Record<keyof T, string | true> => {
    const errors: Record<string, string | true> = {};
    
    for (const field in rules) {
      const fieldRules = rules[field];
      const value = formData[field];
      errors[field] = validate(value, fieldRules);
    }
    
    return errors as Record<keyof T, string | true>;
  };

  // Fonction pour vérifier si un formulaire est valide
  const isFormValid = (errors: Record<string, string | true>): boolean => {
    return Object.values(errors).every(error => error === true);
  };

  return {
    // Règles de base
    required,
    email,
    phone,
    minLength,
    maxLength,
    min,
    max,
    pattern,
    numeric,
    integer,
    positive,
    positiveOrZero,
    url,
    date,
    dateBefore,
    dateAfter,
    fileSize,
    fileType,
    
    // Utilitaires
    validate,
    validateForm,
    isFormValid,
  };
}
