"use client";

export interface EditorNotesTabProps {
  notes: string;
  onChangeNotes: (notes: string) => void;
}

export function EditorNotesTab({ notes, onChangeNotes }: EditorNotesTabProps) {
  return (
    <div className="notesPanel">
      <div className="notesHeader">
        <strong>Alinhamento Interno (Designer ⇄ Social Media)</strong>
        <p>Observações privadas da equipe sobre este card.</p>
      </div>
      <textarea
        value={notes || ""}
        onChange={(e) => onChangeNotes(e.target.value)}
        placeholder="Digite feedbacks, links de assets no Figma, ou notas entre designer e social media..."
        rows={8}
      />
    </div>
  );
}
