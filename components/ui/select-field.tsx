import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function SelectField({ label, value, onChange, options, placeholder, className }: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-900",
          "focus:outline-none focus:border-accent-dark/50 focus:ring-1 focus:ring-accent-dark/20 transition-colors",
          "appearance-none cursor-pointer",
          !value && "text-gray-400",
          className
        )}
      >
        {placeholder && <option value="" className="bg-white">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-gray-900">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
