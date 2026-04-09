/**
 * ActionButton - ?≪ 踰??怨듯?而댄щ??
 */

interface ActionButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ghost-filled';
  size?: 'sm' | 'md';
  disabled?: boolean;
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

export function ActionButton({
  label,
  onClick,
  variant = 'secondary',
  size = 'sm',
  disabled = false,
  icon,
  style,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn ${VARIANT_CLASS[variant]} ${size === 'sm' ? 'btn-sm' : 'btn-md'}`}
      style={style}
    >
      {icon && <span style={{ display: 'inline-flex', marginRight: 4 }}>{icon}</span>}
      {label}
    </button>
  );
}
