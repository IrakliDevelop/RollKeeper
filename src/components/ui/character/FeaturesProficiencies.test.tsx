import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ToolProficienciesSection from './ToolProficienciesSection';
import Languages from './LanguagesAndProficiencies';
import type { ToolProficiency, Language } from '@/types/character';
import { useState } from 'react';

vi.mock('@/hooks/useToolsData', () => ({
  useToolsData: () => ({
    loading: false,
    categories: [
      {
        id: 'other',
        label: 'Other Tools & Kits',
        items: ["Thieves' Tools", 'Forgery Kit'],
      },
    ],
  }),
}));

afterEach(cleanup);

const tool: ToolProficiency = {
  id: 'tool-1',
  name: "Thieves' Tools",
  proficiencyLevel: 'proficient',
  isTemporary: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};
const language: Language = {
  id: 'lang-1',
  name: 'Elvish',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

function renderPanels(editing: boolean) {
  const actions = {
    onAddToolProficiency: vi.fn(),
    onUpdateToolProficiency: vi.fn(),
    onDeleteToolProficiency: vi.fn(),
    onAddLanguage: vi.fn(),
    onDeleteLanguage: vi.fn(),
  };
  render(
    <>
      <ToolProficienciesSection
        toolProficiencies={[tool]}
        proficiencyBonus={3}
        editing={editing}
        {...actions}
      />
      <Languages languages={[language]} editing={editing} {...actions} />
    </>
  );
  return actions;
}

describe('Features proficiencies', () => {
  it('explains empty tools and the temporary long-rest swap', () => {
    const { rerender } = render(
      <ToolProficienciesSection
        toolProficiencies={[]}
        proficiencyBonus={3}
        onAddToolProficiency={vi.fn()}
        onUpdateToolProficiency={vi.fn()}
        onDeleteToolProficiency={vi.fn()}
      />
    );
    expect(screen.getByText('No tool proficiencies.')).toBeInTheDocument();
    rerender(
      <ToolProficienciesSection
        toolProficiencies={[tool]}
        proficiencyBonus={3}
        onAddToolProficiency={vi.fn()}
        onUpdateToolProficiency={vi.fn()}
        onDeleteToolProficiency={vi.fn()}
      />
    );
    expect(screen.getByText('Swap on a long rest')).toBeInTheDocument();
  });

  it('shows tools and languages as plain display in play', () => {
    renderPanels(false);
    expect(screen.getByText("Thieves' Tools")).toBeInTheDocument();
    expect(screen.getByText('Elvish')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText('Temporary')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add language' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Custom' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Thieves.*Add expertise/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove language' })
    ).not.toBeInTheDocument();
  });

  it('keeps category cycling, temporary toggle and language edit in edit mode', () => {
    const actions = renderPanels(true);
    fireEvent.click(screen.getByRole('button', { name: 'Other Tools & Kits' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: /Thieves.*Add expertise/ })[0]
    );
    expect(actions.onUpdateToolProficiency).toHaveBeenCalledWith('tool-1', {
      proficiencyLevel: 'expertise',
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Temporary' })[0]);
    expect(actions.onUpdateToolProficiency).toHaveBeenCalledWith('tool-1', {
      isTemporary: false,
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Forgery Kit.*Make proficient/ })
    );
    expect(actions.onAddToolProficiency).toHaveBeenCalledWith({
      name: 'Forgery Kit',
      proficiencyLevel: 'proficient',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove language' }));
    expect(actions.onDeleteLanguage).toHaveBeenCalledWith('lang-1');
    fireEvent.click(screen.getByRole('button', { name: 'Add language' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Language' }), {
      target: { value: 'Draconic' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(actions.onAddLanguage).toHaveBeenCalledWith({ name: 'Draconic' });
  });
});

describe('proficiency remove buttons', () => {
  it('returns focus to Add controls after deleting a focused tool or language', () => {
    function Panels() {
      const [tools, setTools] = useState([tool]);
      const [languages, setLanguages] = useState([language]);
      return (
        <>
          <ToolProficienciesSection
            toolProficiencies={tools}
            proficiencyBonus={3}
            editing
            onAddToolProficiency={vi.fn()}
            onUpdateToolProficiency={vi.fn()}
            onDeleteToolProficiency={id =>
              setTools(current => current.filter(item => item.id !== id))
            }
          />
          <Languages
            languages={languages}
            editing
            onAddLanguage={vi.fn()}
            onDeleteLanguage={id =>
              setLanguages(current => current.filter(item => item.id !== id))
            }
          />
        </>
      );
    }
    render(<Panels />);
    const toolRemove = screen.getByRole('button', {
      name: 'Remove proficiency',
    });
    toolRemove.focus();
    fireEvent.click(toolRemove);
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveFocus();
    const languageRemove = screen.getByRole('button', {
      name: 'Remove language',
    });
    languageRemove.focus();
    fireEvent.click(languageRemove);
    expect(screen.getByRole('button', { name: 'Add language' })).toHaveFocus();
  });

  it('keeps both inline Add actions secondary when both forms are open', () => {
    renderPanels(true);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add language' }));
    expect(
      screen
        .getAllByRole('button', { name: 'Add' })
        .every(button => button.getAttribute('data-variant') === 'secondary')
    ).toBe(true);
  });

  it('describe each remove button with the row name', () => {
    render(
      <>
        <ToolProficienciesSection
          toolProficiencies={[tool]}
          proficiencyBonus={3}
          onAddToolProficiency={vi.fn()}
          onUpdateToolProficiency={vi.fn()}
          onDeleteToolProficiency={vi.fn()}
          editing
        />
        <Languages
          languages={[language]}
          onAddLanguage={vi.fn()}
          onDeleteLanguage={vi.fn()}
          editing
        />
      </>
    );
    expect(
      screen.getByRole('button', { name: 'Remove proficiency' })
    ).toHaveAccessibleDescription("Thieves' Tools");
    expect(
      screen.getByRole('button', { name: 'Remove language' })
    ).toHaveAccessibleDescription('Elvish');
    expect(
      screen.getByRole('button', { name: 'Temporary' })
    ).toHaveAccessibleDescription("Thieves' Tools");
    expect(
      screen.getByRole('button', { name: 'Add language' })
    ).toHaveTextContent('Add language');
  });

  it('labels the play-mode tool dot with its level only', () => {
    render(
      <ToolProficienciesSection
        toolProficiencies={[tool]}
        proficiencyBonus={3}
        onAddToolProficiency={vi.fn()}
        onUpdateToolProficiency={vi.fn()}
        onDeleteToolProficiency={vi.fn()}
      />
    );
    expect(screen.getByRole('img', { name: 'Proficient' })).toBeInTheDocument();
  });
});
