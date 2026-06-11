import { Plus } from 'lucide-react';
import { Button } from '@/components/Button';

export function AddLink({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={Plus}
      onClick={onClick}
      disabled={disabled}
      className="h-auto px-0 py-0 font-normal hover:bg-transparent"
    >
      {label}
    </Button>
  );
}
