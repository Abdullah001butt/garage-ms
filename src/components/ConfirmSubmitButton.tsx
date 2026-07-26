"use client";

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  className = "text-xs text-red-500 hover:underline",
}: {
  children: React.ReactNode;
  confirmMessage: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
