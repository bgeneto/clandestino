import { useState } from 'react';

type ContestDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  submitting?: boolean;
};

export function ContestDialog({ open, onClose, onSubmit, submitting = false }: ContestDialogProps) {
  const [reason, setReason] = useState('');

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Contestar resultado</h2>
        <p className="mt-2 text-sm text-slate-600">
          Informe brevemente o motivo da contestação (opcional).
        </p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ex.: o placar correto era 3×1"
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-[#1a1a2e] focus:ring-2"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmit(reason.trim())}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Contestar
          </button>
        </div>
      </div>
    </div>
  );
}
