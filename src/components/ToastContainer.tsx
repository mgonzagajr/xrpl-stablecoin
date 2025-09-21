'use client';

import ToastComponent, { Toast } from './Toast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex justify-end items-start px-4 py-6 pointer-events-none sm:p-6 z-50"
    >
      <div className="max-w-2xl flex flex-col items-end space-y-4">
        {toasts.map((toast) => (
          <ToastComponent
            key={toast.id}
            toast={toast}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
