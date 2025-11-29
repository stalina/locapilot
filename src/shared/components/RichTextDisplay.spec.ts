import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextDisplay from './RichTextDisplay.vue';

describe('RichTextDisplay', () => {
  it('affiche du contenu HTML sanitisé', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '<p>Texte <strong>en gras</strong></p>',
      },
    });

    expect(wrapper.html()).toContain('<p>Texte <strong>en gras</strong></p>');
  });

  it('supprime les balises dangereuses', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '<p>Texte</p><script>alert("XSS")</script>',
      },
    });

    expect(wrapper.html()).not.toContain('<script>');
    expect(wrapper.html()).toContain('<p>Texte</p>');
  });

  it('supprime les attributs dangereux', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '<p onclick="alert(\'XSS\')">Texte</p>',
      },
    });

    expect(wrapper.html()).not.toContain('onclick');
  });

  it('autorise les liens avec target="_blank"', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '<a href="https://exemple.com" target="_blank" rel="noopener noreferrer">Lien</a>',
      },
    });

    expect(wrapper.html()).toContain('href="https://exemple.com"');
    expect(wrapper.html()).toContain('target="_blank"');
  });

  it('affiche un message pour contenu vide', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '',
      },
    });

    expect(wrapper.text()).toContain('Aucune description');
  });

  it('affiche un message pour contenu avec uniquement des balises vides', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '<p></p><br>',
      },
    });

    expect(wrapper.text()).toContain('Aucune description');
  });

  it('autorise les titres H2 et H3', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '<h2>Titre 2</h2><h3>Titre 3</h3>',
      },
    });

    expect(wrapper.html()).toContain('<h2>Titre 2</h2>');
    expect(wrapper.html()).toContain('<h3>Titre 3</h3>');
  });

  it('autorise les listes', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '<ul><li>Item 1</li><li>Item 2</li></ul>',
      },
    });

    expect(wrapper.html()).toContain('<ul>');
    expect(wrapper.html()).toContain('<li>Item 1</li>');
  });

  it('autorise le formatage de texte', () => {
    const wrapper = mount(RichTextDisplay, {
      props: {
        content: '<p><strong>Gras</strong> <em>Italique</em> <s>Barré</s></p>',
      },
    });

    expect(wrapper.html()).toContain('<strong>Gras</strong>');
    expect(wrapper.html()).toContain('<em>Italique</em>');
    expect(wrapper.html()).toContain('<s>Barré</s>');
  });
});
