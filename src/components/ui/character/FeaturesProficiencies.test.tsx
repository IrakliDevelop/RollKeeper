import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ToolProficienciesSection from './ToolProficienciesSection';
import Languages from './LanguagesAndProficiencies';
import type { ToolProficiency, Language } from '@/types/character';

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
