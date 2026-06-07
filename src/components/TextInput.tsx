interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}

export function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder,
}: TextInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-8 px-3 text-[13px] border border-border rounded bg-background outline-none focus:border-primary"
    />
  );
}
