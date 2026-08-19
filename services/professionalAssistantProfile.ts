import {
  ProfessionalAssistantSettings,
  ProfessionalAssistantTone,
} from "../types";

export const PROFESSIONAL_ASSISTANT_TONES: Array<{
  value: ProfessionalAssistantTone;
  label: string;
}> = [
  { value: "professional_warm", label: "Profissional e Acolhedora" },
  { value: "direct_clinical", label: "Direta e Clínica" },
  { value: "empathetic_educational", label: "Empática e Educada" },
  { value: "casual_friendly", label: "Descontraída e Amigável" },
];

export function defaultProfessionalAssistantSettings(
  accountId: string,
  professionalId: string,
): ProfessionalAssistantSettings {
  return {
    accountId,
    professionalId,
    enabled: true,
    name: "Sofia",
    tone: "professional_warm",
    serviceContext: "",
  };
}
