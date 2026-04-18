export default function InputField({
  label,
  icon,
  error,
  as = 'input',
  className = '',
  ...props
}) {
  const Element = as;

  return (
    <label className="field-group">
      <span className="field-label">
        {icon && <span className="field-icon">{icon}</span>}
        {label}
      </span>
      <Element className={`field-control ${error ? 'field-error' : ''} ${className}`.trim()} {...props} />
      {error && <span className="field-feedback">{error}</span>}
    </label>
  );
}
