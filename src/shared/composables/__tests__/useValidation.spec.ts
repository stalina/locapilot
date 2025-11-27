import { describe, it, expect } from 'vitest';
import { useValidation } from '../useValidation';

describe('useValidation', () => {
  const validation = useValidation();

  describe('required', () => {
    it('devrait valider les valeurs présentes', () => {
      const rule = validation.required();
      expect(rule('hello')).toBe(true);
      expect(rule(123)).toBe(true);
      expect(rule(['item'])).toBe(true);
    });

    it('devrait rejeter les valeurs vides', () => {
      const rule = validation.required();
      expect(rule('')).toBe('Ce champ est requis');
      expect(rule(null)).toBe('Ce champ est requis');
      expect(rule(undefined)).toBe('Ce champ est requis');
      expect(rule([])).toBe('Ce champ est requis');
    });

    it('devrait accepter un message personnalisé', () => {
      const rule = validation.required('Champ obligatoire');
      expect(rule('')).toBe('Champ obligatoire');
    });
  });

  describe('email', () => {
    it('devrait valider les emails valides', () => {
      const rule = validation.email();
      expect(rule('test@example.com')).toBe(true);
      expect(rule('user.name+tag@example.co.uk')).toBe(true);
    });

    it('devrait rejeter les emails invalides', () => {
      const rule = validation.email();
      expect(rule('not-an-email')).toBe('Email invalide');
      expect(rule('missing@domain')).toBe('Email invalide');
      expect(rule('@example.com')).toBe('Email invalide');
    });

    it('devrait accepter les valeurs vides', () => {
      const rule = validation.email();
      expect(rule('')).toBe(true);
    });
  });

  describe('phone', () => {
    it('devrait valider les numéros français valides', () => {
      const rule = validation.phone();
      expect(rule('0612345678')).toBe(true);
      expect(rule('06 12 34 56 78')).toBe(true);
      expect(rule('+33612345678')).toBe(true);
      expect(rule('01 23 45 67 89')).toBe(true);
    });

    it('devrait rejeter les numéros invalides', () => {
      const rule = validation.phone();
      expect(rule('123')).toBe('Numéro de téléphone invalide');
      expect(rule('00 12 34 56 78')).toBe('Numéro de téléphone invalide');
    });
  });

  describe('minLength', () => {
    it('devrait valider les chaînes assez longues', () => {
      const rule = validation.minLength(5);
      expect(rule('hello')).toBe(true);
      expect(rule('hello world')).toBe(true);
    });

    it('devrait rejeter les chaînes trop courtes', () => {
      const rule = validation.minLength(5);
      expect(rule('hi')).toBe('Minimum 5 caractères');
    });
  });

  describe('maxLength', () => {
    it('devrait valider les chaînes assez courtes', () => {
      const rule = validation.maxLength(10);
      expect(rule('hello')).toBe(true);
    });

    it('devrait rejeter les chaînes trop longues', () => {
      const rule = validation.maxLength(10);
      expect(rule('hello world test')).toBe('Maximum 10 caractères');
    });
  });

  describe('min', () => {
    it('devrait valider les nombres >= minimum', () => {
      const rule = validation.min(10);
      expect(rule(10)).toBe(true);
      expect(rule(20)).toBe(true);
    });

    it('devrait rejeter les nombres < minimum', () => {
      const rule = validation.min(10);
      expect(rule(5)).toBe('Valeur minimale: 10');
    });
  });

  describe('max', () => {
    it('devrait valider les nombres <= maximum', () => {
      const rule = validation.max(100);
      expect(rule(50)).toBe(true);
      expect(rule(100)).toBe(true);
    });

    it('devrait rejeter les nombres > maximum', () => {
      const rule = validation.max(100);
      expect(rule(150)).toBe('Valeur maximale: 100');
    });
  });

  describe('numeric', () => {
    it('devrait valider les nombres', () => {
      const rule = validation.numeric();
      expect(rule(123)).toBe(true);
      expect(rule('123')).toBe(true);
      expect(rule('123.45')).toBe(true);
    });

    it('devrait rejeter les non-nombres', () => {
      const rule = validation.numeric();
      expect(rule('abc')).toBe('Doit être un nombre');
    });
  });

  describe('integer', () => {
    it('devrait valider les entiers', () => {
      const rule = validation.integer();
      expect(rule(123)).toBe(true);
      expect(rule('123')).toBe(true);
    });

    it('devrait rejeter les décimaux', () => {
      const rule = validation.integer();
      expect(rule(123.45)).toBe('Doit être un nombre entier');
      expect(rule('123.45')).toBe('Doit être un nombre entier');
    });
  });

  describe('positive', () => {
    it('devrait valider les nombres positifs', () => {
      const rule = validation.positive();
      expect(rule(1)).toBe(true);
      expect(rule(100)).toBe(true);
    });

    it('devrait rejeter zéro et les négatifs', () => {
      const rule = validation.positive();
      expect(rule(0)).toBe('Doit être positif');
      expect(rule(-1)).toBe('Doit être positif');
    });
  });

  describe('positiveOrZero', () => {
    it('devrait valider les nombres >= 0', () => {
      const rule = validation.positiveOrZero();
      expect(rule(0)).toBe(true);
      expect(rule(1)).toBe(true);
    });

    it('devrait rejeter les négatifs', () => {
      const rule = validation.positiveOrZero();
      expect(rule(-1)).toBe('Doit être positif ou zéro');
    });
  });

  describe('url', () => {
    it('devrait valider les URLs valides', () => {
      const rule = validation.url();
      expect(rule('https://example.com')).toBe(true);
      expect(rule('http://example.com/path')).toBe(true);
    });

    it('devrait rejeter les URLs invalides', () => {
      const rule = validation.url();
      expect(rule('not-a-url')).toBe('URL invalide');
    });
  });

  describe('date', () => {
    it('devrait valider les dates valides', () => {
      const rule = validation.date();
      expect(rule('2024-01-01')).toBe(true);
      expect(rule('2024-12-31T23:59:59')).toBe(true);
    });

    it('devrait rejeter les dates invalides', () => {
      const rule = validation.date();
      expect(rule('not-a-date')).toBe('Date invalide');
    });
  });

  describe('validate', () => {
    it('devrait valider avec plusieurs règles', () => {
      const rules = [
        validation.required(),
        validation.minLength(3),
        validation.maxLength(10),
      ];
      
      expect(validation.validate('hello', rules)).toBe(true);
    });

    it('devrait retourner le premier message d\'erreur', () => {
      const rules = [
        validation.required(),
        validation.minLength(10),
      ];
      
      expect(validation.validate('hi', rules)).toBe('Minimum 10 caractères');
    });
  });

  describe('validateForm', () => {
    it('devrait valider un formulaire entier', () => {
      const formData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };
      
      const rules = {
        name: [validation.required(), validation.minLength(2)],
        email: [validation.required(), validation.email()],
        age: [validation.required(), validation.min(18)],
      };
      
      const errors = validation.validateForm(formData, rules);
      
      expect(errors.name).toBe(true);
      expect(errors.email).toBe(true);
      expect(errors.age).toBe(true);
    });

    it('devrait retourner les erreurs pour chaque champ', () => {
      const formData = {
        name: '',
        email: 'invalid-email',
        age: 10,
      };
      
      const rules = {
        name: [validation.required()],
        email: [validation.email()],
        age: [validation.min(18)],
      };
      
      const errors = validation.validateForm(formData, rules);
      
      expect(errors.name).toBe('Ce champ est requis');
      expect(errors.email).toBe('Email invalide');
      expect(errors.age).toBe('Valeur minimale: 18');
    });
  });

  describe('isFormValid', () => {
    it('devrait retourner true si tous les champs sont valides', () => {
      const errors: Record<string, string | true> = {
        name: true,
        email: true,
        age: true,
      };
      
      expect(validation.isFormValid(errors)).toBe(true);
    });

    it('devrait retourner false si au moins un champ est invalide', () => {
      const errors: Record<string, string | true> = {
        name: true,
        email: 'Email invalide',
        age: true,
      };
      
      expect(validation.isFormValid(errors)).toBe(false);
    });
  });
});
