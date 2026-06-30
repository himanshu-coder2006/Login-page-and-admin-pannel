const FormField = ({
  autoComplete,
  label,
  name,
  onChange,
  placeholder,
  type = 'text',
  value,
}) => (
  <label className="form-field">
    <span>{label}</span>
    <input
      autoComplete={autoComplete}
      name={name}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      value={value}
    />
  </label>
)

export default FormField
