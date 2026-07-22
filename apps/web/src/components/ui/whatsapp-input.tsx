"use client";

import { useEffect, useState } from "react";

interface WhatsappInputProps {
  id?: string;
  name?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Notifica o valor E.164 atual (inclusive incompleto) a cada mudança. */
  onValueChange?: (e164: string) => void;
}

export function WhatsappInput({
  id = "whatsapp",
  name = "whatsapp",
  required = true,
  defaultValue = "",
  placeholder = "(51) 99999-8888",
  className,
  onValueChange,
}: WhatsappInputProps) {
  // Extrai apenas digitos do valor inicial (ex: +5551999998888 -> 51999998888)
  const initialDigits = defaultValue.replace(/\D/g, "").replace(/^55/, "");

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10)
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const [formatted, setFormatted] = useState(formatPhoneNumber(initialDigits));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatted(formatPhoneNumber(e.target.value));
  };

  // Garante que o input hidden mande o formato E.164 limpo (+5511999998888) para o formulário
  const digitsOnly = formatted.replace(/\D/g, "");
  const e164Value = digitsOnly ? `+55${digitsOnly}` : "";

  useEffect(() => {
    onValueChange?.(e164Value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- excluir onValueChange de propósito:
    // consumidores inline (`onValueChange={setX}`) são estáveis, mas uma closure nova a cada
    // render do pai não deve reexecutar este efeito — só a mudança do próprio valor importa.
  }, [e164Value]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {/* Combo de DDI */}
        <div className="h-9 px-2.5 flex items-center gap-1 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-[var(--radius-input)] text-xs font-medium text-[var(--text-1)] shrink-0 select-none">
          <span>🇧🇷</span>
          <span>+55</span>
        </div>

        {/* Input Mascarado para o usuário — recebe o `id` público (o rótulo aponta pra este). */}
        <input
          type="tel"
          id={id}
          value={formatted}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          className={
            className ??
            "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
          }
        />
      </div>

      {/* Input Oculto enviado ao Server Action no formato E.164 */}
      <input type="hidden" id={`${id}_e164`} name={name} value={e164Value} />
    </div>
  );
}
