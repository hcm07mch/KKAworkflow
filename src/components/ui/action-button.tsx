/**
 * ActionButton - ?≪ 踰??怨듯?而댄щ??
 */

interface ActionButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ghost-filled';
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

const VARIANT_CLASS: Record<string, string> = {
  primary:        'btn-primary',
  secondary:      'btn-secondary',
  danger:         'btn-danger',
  ghost:          'btn-ghost',
  'ghost-filled': 'btn-ghost-filled',
};

function Spinner({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'btn-spin 0.8s linear infinite', display: 'inline-block', marginRight: 4 }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ActionButton({
  label,
  onClick,
  variant = 'secondary',
  size = 'sm',
  disabled = false,
  loading = false,
  icon,
  style,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn ${VARIANT_CLASS[variant]} ${size === 'sm' ? 'btn-sm' : 'btn-md'}`}
      style={style}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 13 : 15} />
      ) : (
        icon && <span style={{ display: 'inline-flex', marginRight: 4 }}>{icon}</span>
      )}
      {label}
    </button>
  );
}
