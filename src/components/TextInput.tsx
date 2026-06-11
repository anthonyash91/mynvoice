interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
}: TextInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full h-8 px-3 text-[13px] border border-border rounded bg-background outline-none focus:border-primary disabled:opacity-50"
    />
  );
}
