import React from 'react';

export interface AgriCurrencyProps {
  amount: number | string;
  unit?: string;
  className?: string;
  amountClassName?: string;
  unitClassName?: string;
  symbol?: string;
}

/**
 * Standardized Agricultural Currency & Unit Typographic Rhythm
 * Strict glyph tight-binding ৳1,150 with muted secondary unit subscript (/মণ, /কেজি)
 * Completely prevents awkward line wrapping on mobile viewport widths.
 */
export const AgriCurrency: React.FC<AgriCurrencyProps> = ({
  amount,
  unit,
  className = '',
  amountClassName = '',
  unitClassName = '',
  symbol = '৳',
}) => {
  const formattedAmount =
    typeof amount === 'number'
      ? amount.toLocaleString('en-US')
      : isNaN(Number(amount))
      ? amount
      : Number(amount).toLocaleString('en-US');

  return (
    <span
      className={`inline-flex items-baseline whitespace-nowrap tabular-nums font-mono ${className}`}
    >
      <span className={`font-bold tracking-tight ${amountClassName}`}>
        {symbol}
        {formattedAmount}
      </span>
      {unit && (
        <span
          className={`text-[0.75em] font-sans font-normal opacity-70 ml-0.5 select-none ${unitClassName}`}
        >
          {unit.startsWith('/') ? unit : `/${unit}`}
        </span>
      )}
    </span>
  );
};

export default AgriCurrency;
