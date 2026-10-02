"use client";

import { useEffect } from "react";
import { SelectField } from "@/components/ui/select-field";
import { useFetch } from "@/lib/hooks";
import { EXPENSE_PAYMENT_OPTIONS } from "@/lib/expense-payments";

export type CreditCardInfo = {
  id: string; name: string; bank: string | null; brand: string | null; color: string; isActive: boolean;
};

export type ExpensePaymentInfo = {
  paymentMethod: string | null; creditCardId: string | null; creditCard: CreditCardInfo | null;
};

export function ExpensePaymentFields({ paymentMethod, creditCardId, selectedCard, onChange }: {
  paymentMethod: string;
  creditCardId: string;
  selectedCard?: CreditCardInfo | null;
  onChange: (payment: { paymentMethod: string; creditCardId: string }) => void;
}) {
  const { data, loading, error, refetch } = useFetch<CreditCardInfo[]>("/api/financeiro/credit-cards");
  // Recarrega ao escolher crédito para incluir cartões cadastrados em outra aba.
  useEffect(() => { if (paymentMethod === "CREDIT_CARD") refetch(); }, [paymentMethod, refetch]);
  const cards = (data ?? []).filter((card) => card.isActive || card.id === selectedCard?.id);
  if (selectedCard && !cards.some((card) => card.id === selectedCard.id)) cards.push(selectedCard);

  return (
    <div className="space-y-4">
      <SelectField label="Forma de pagamento" value={paymentMethod} placeholder="Selecione como foi pago"
        options={[...EXPENSE_PAYMENT_OPTIONS]}
        onChange={(value) => onChange({ paymentMethod: value, creditCardId: value === "CREDIT_CARD" ? creditCardId : "" })} />
      {paymentMethod === "CREDIT_CARD" && (
        <div className="space-y-2">
          <SelectField label="Cartão de crédito" value={creditCardId}
            placeholder={loading ? "Carregando cartões..." : "Selecione o cartão"}
            options={cards.map((card) => ({ value: card.id, label: `${card.name}${card.bank ? ` · ${card.bank}` : ""}${!card.isActive ? " (inativo)" : ""}` }))}
            onChange={(value) => onChange({ paymentMethod, creditCardId: value })} />
          {error ? <p role="alert" className="text-xs text-red-600">Não foi possível carregar os cartões. <button type="button" onClick={refetch} className="underline">Tentar novamente</button></p>
            : !loading && cards.length === 0 && <p className="text-xs text-gray-500">Cadastre um cartão na aba Cartões para selecioná-lo aqui.</p>}
        </div>
      )}
    </div>
  );
}
