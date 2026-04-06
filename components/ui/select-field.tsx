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
        <label className="block text-xs text-white/40 uppercase tracking-wider font-medium">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white",
          "focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors",
          "appearance-none cursor-pointer",
          !value && "text-white/20",
          className
        )}
      >
        {placeholder && <option value="" className="bg-[#111]">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#111] text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
