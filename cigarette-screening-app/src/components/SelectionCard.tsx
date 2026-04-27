import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface SelectionCardProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  smallText?: boolean;
}

const SelectionCard: React.FC<SelectionCardProps> = ({
  selected,
  onClick,
  title,
  subtitle,
  icon,
  smallText
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${
      selected
        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
        : 'border-slate-100 bg-white text-slate-500 hover:border-emerald-200'
    }`}
  >
    {icon && <div className="mb-2">{icon}</div>}
    <div className={`${smallText ? 'text-xs' : 'text-sm'} font-bold`}>{title}</div>
    {subtitle && <div className="text-[10px] opacity-75 mt-1">{subtitle}</div>}
    {selected && (
      <div className="absolute top-1 right-1">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      </div>
    )}
  </button>
);

export default SelectionCard;
