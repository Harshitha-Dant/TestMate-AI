import { useState, type ReactNode } from "react";
import { errorMessage } from "../../api/client";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface Props {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}

/** Confirmation for destructive actions. Stays open and shows the error if the action fails. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={message}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-failure">
          {error}
        </p>
      ) : (
        <p className="text-sm text-muted">This can't be undone.</p>
      )}
    </Modal>
  );
}
