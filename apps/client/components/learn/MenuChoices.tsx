'use client';

interface MenuChoice {
  id: string;
  text: string;
}

interface MenuChoicesProps {
  choices: MenuChoice[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function MenuChoices({ choices, selectedId, onSelect, disabled }: MenuChoicesProps) {
  return (
    <div className="menu-choices">
      {choices.map((choice) => (
        <button
          key={choice.id}
          className={`menu-choices__btn ${selectedId === choice.id ? 'menu-choices__btn--selected' : ''}`}
          onClick={() => onSelect(choice.id)}
          disabled={disabled || !!selectedId}
          type="button"
        >
          {choice.text}
        </button>
      ))}
    </div>
  );
}
