import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface CounterInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  colorClass?: string;
  bgClass?: string;
  btnClass?: string;
}

const CounterInput: React.FC<CounterInputProps> = ({
  label,
  value,
  onChange,
  colorClass = "text-emerald-600",
  bgClass = "bg-emerald-50",
  btnClass = "bg-emerald-100 text-emerald-700"
}) => {
  const handleDecrease = () => {
    if (value > 0) onChange(value - 1);
  };
  const handleIncrease = () => {
    onChange(value + 1);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    if (val >= 0) onChange(val);
  };

  return (
    <div className={`flex flex-col items-center p-4 rounded-xl border border-slate-100 ${bgClass}`}>
      <span className="text-xl font-bold text-slate-700 mb-4">{label}</span>
      <div className="flex items-center gap-2 w-full justify-center">
        <button
          type="button"
          onClick={handleDecrease}
          disabled={value <= 0}
          className={`w-[100px] sm:w-[140px] h-[60px] sm:h-[80px] rounded-xl flex items-center justify-center transition-active active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed bg-white border border-slate-200 text-slate-500 shadow-sm`}
        >
          <Minus className="w-8 h-8 sm:w-12 sm:h-12" />
        </button>

        <input
          type="number"
          min="0"
          value={value}
          onChange={handleInputChange}
          className={`w-20 sm:w-28 text-center text-3xl sm:text-4xl font-bold bg-transparent outline-none ${colorClass}`}
        />
        <button
          type="button"
          onClick={handleIncrease}
          className={`w-[100px] sm:w-[140px] h-[60px] sm:h-[80px] rounded-xl flex items-center justify-center transition-active active:scale-95 shadow-sm ${btnClass}`}
        >
          <Plus className="w-8 h-8 sm:w-12 sm:h-12" />
        </button>
      </div>
    </div>
  );
};

export default CounterInput;
