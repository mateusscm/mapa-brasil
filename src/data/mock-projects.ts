import type { ProjectData } from "@/types/projects";

export type { ProjectData };

export const mockProjectData: ProjectData = {
  SP: {
    "sao Carlos": 10,
    "Ribeirão Preto": 2,
    "São Paulo": 25,
    Campinas: 8,
    "São José dos Campos": 5,
    Santos: 3,
  },
  RJ: {
    "Rio de Janeiro": 18,
    Niterói: 4,
    Petrópolis: 2,
  },
  MG: {
    "Belo Horizonte": 12,
    Uberlândia: 6,
    "Juiz de Fora": 3,
    "Ouro Preto": 1,
  },
  BA: {
    Salvador: 9,
    "Feira de Santana": 2,
    Ilhéus: 1,
  },
  RS: {
    "Porto Alegre": 7,
    Canoas: 2,
    Pelotas: 3,
  },
  PR: {
    Curitiba: 11,
    Londrina: 4,
    Maringá: 3,
  },
  PE: {
    Recife: 6,
    Olinda: 2,
    Caruaru: 1,
  },
  CE: {
    Fortaleza: 8,
    "Juazeiro do Norte": 1,
  },
  PA: {
    Belém: 5,
    Ananindeua: 1,
  },
  SC: {
    Florianópolis: 4,
    Joinville: 3,
    Blumenau: 2,
  },
  GO: {
    Goiânia: 6,
    "Aparecida de Goiânia": 2,
  },
  AM: {
    Manaus: 4,
  },
  MA: {
    "São Luís": 3,
  },
  ES: {
    Vitória: 3,
    "Vila Velha": 2,
  },
  DF: {
    Brasília: 15,
  },
  MT: {
    Cuiabá: 2,
    Rondonópolis: 1,
  },
  MS: {
    "Campo Grande": 3,
  },
  RN: {
    Natal: 2,
  },
  PB: {
    "João Pessoa": 3,
  },
  AL: {
    Maceió: 2,
  },
  SE: {
    Aracaju: 1,
  },
  PI: {
    Teresina: 2,
  },
  RO: {
    "Porto Velho": 1,
  },
  TO: {
    Palmas: 1,
  },
  AC: {
    "Rio Branco": 1,
  },
  AP: {
    Macapá: 1,
  },
  RR: {
    "Boa Vista": 1,
  },
};

/** Aggregate project counts per state */
export function getStateProjectCounts(
  data: ProjectData,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [state, municipalities] of Object.entries(data)) {
    counts[state] = Object.values(municipalities).reduce(
      (sum, n) => sum + n,
      0,
    );
  }
  return counts;
}
